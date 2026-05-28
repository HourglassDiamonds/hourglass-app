import { verifyCalibrationAccess } from "@/lib/calibration-library/auth";
import { isAcceptedReportMime } from "@/lib/calibration-library/document-extract";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import { toJsonSafe } from "@/lib/calibration-library/gcal-api-error";
import { inferReportSourceFromUpload } from "@/lib/calibration-library/infer-report-source";
import {
  CalibrationTimeoutError,
  logCalibrationRuntimeCheck,
  timeoutErrorMessage,
  validateCalibrationUpload,
  withTimeout,
} from "@/lib/calibration-library/runtime-guard";
import {
  CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
  CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
} from "@/lib/calibration-library/runtime-limits";
import {
  labFamilyLabel,
  logUploadPipelineTiming,
} from "@/lib/calibration-library/upload-pipeline-timing";
import { toClientSafeInterpretationPayload } from "@/lib/diamond-intelligence/client-api";
import {
  getCachedClientInterpretation,
  setCachedClientInterpretation,
} from "@/lib/diamond-intelligence/client-interpret-cache";
import {
  CLIENT_PARTIAL_INTERPRETATION_NOTE,
  CLIENT_UPLOAD_INTERPRET_ERROR,
} from "@/lib/diamond-intelligence/client-interpret-messages";
import {
  clientExtractionSufficient,
  clientExtractionUseful,
} from "@/lib/diamond-intelligence/client-extraction-sufficient";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(toJsonSafe(body), { status });
}

function logClientInterpretOutcome(input: {
  started: number;
  outcome: "cache-hit" | "final" | "partial" | "timeout" | "failure";
  lab?: string;
  parser?: string;
  partial?: boolean;
  totalMs?: number;
  detail?: string;
}): void {
  if (process.env.NODE_ENV !== "development") return;
  console.log("[diamond-intelligence-interpret]", {
    mode: "client",
    outcome: input.outcome,
    labFamily: input.lab ? labFamilyLabel(input.lab, input.parser) : undefined,
    parser: input.parser,
    partial: input.partial ?? false,
    routeMs: input.totalMs ?? Date.now() - input.started,
    detail: input.detail,
  });
}

export async function POST(request: Request) {
  const started = Date.now();
  logUploadPipelineTiming({
    phase: "file-read",
    durationMs: 0,
    detail: "request-start",
  });

  if (!verifyCalibrationAccess(request)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return json({ ok: false, error: "A report file is required." }, 400);
    }

    if (!isAcceptedReportMime(file.type)) {
      return json(
        {
          ok: false,
          error: "Please upload a PDF or image of your lab report.",
        },
        400,
      );
    }

    const readStarted = Date.now();
    const bytes = Buffer.from(await file.arrayBuffer());
    logUploadPipelineTiming({
      phase: "file-read",
      durationMs: Date.now() - readStarted,
    });

    const uploadCheck = await validateCalibrationUpload(bytes, file.type);
    if (!uploadCheck.ok) {
      return json({ ok: false, error: uploadCheck.error }, 400);
    }

    const cached = getCachedClientInterpretation(bytes);
    if (cached) {
      logClientInterpretOutcome({
        started,
        outcome: "cache-hit",
        lab: cached.metadata.lab,
        totalMs: Date.now() - started,
      });
      return json({ ok: true, interpretation: cached });
    }

    const reportSource = inferReportSourceFromUpload(file.type, false);

    const finalized = await withTimeout(
      runCalibrationUploadExtraction({
        bytes,
        mime: file.type,
        reportSource,
        mode: "client",
        initialPipelineNotices: [],
        pipelineTimeoutMs: CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
      }),
      CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
      "diamond-intelligence-interpret",
    );

    const routeMs = Date.now() - started;
    const useful = clientExtractionUseful({
      fields: finalized.fields,
      confidence: finalized.confidence,
    });

    if (finalized.timedOut && !useful) {
      logClientInterpretOutcome({
        started,
        outcome: "timeout",
        lab: finalized.metadata.lab,
        parser: finalized.parserType,
        totalMs: routeMs,
        detail: finalized.pipelineError,
      });
      return json({ ok: false, error: CLIENT_UPLOAD_INTERPRET_ERROR }, 504);
    }

    if (finalized.pipelineError && !useful) {
      logClientInterpretOutcome({
        started,
        outcome: "failure",
        lab: finalized.metadata.lab,
        parser: finalized.parserType,
        totalMs: routeMs,
        detail: finalized.pipelineError,
      });
      return json({ ok: false, error: CLIENT_UPLOAD_INTERPRET_ERROR }, 504);
    }

    const payloadStarted = Date.now();
    const partial =
      Boolean(finalized.clientPartial) ||
      (useful &&
        !clientExtractionSufficient({
          fields: finalized.fields,
          confidence: finalized.confidence,
        }));
    const statusNote = partial ? CLIENT_PARTIAL_INTERPRETATION_NOTE : undefined;

    const interpretation = toClientSafeInterpretationPayload(finalized, undefined, {
      clientStatusNote: statusNote,
      partial: Boolean(statusNote),
    });

    logUploadPipelineTiming({
      phase: "client-payload",
      durationMs: Date.now() - payloadStarted,
      labFamily: finalized.metadata.lab,
      parserPath: finalized.parserType,
      detail: statusNote ? "partial" : "final",
    });

    if (!interpretation.capability.canRunClientInterpretation) {
      logClientInterpretOutcome({
        started,
        outcome: "failure",
        lab: finalized.metadata.lab,
        parser: finalized.parserType,
        totalMs: routeMs,
        detail: "insufficient-fields",
      });
      return json({ ok: false, error: CLIENT_UPLOAD_INTERPRET_ERROR }, 422);
    }

    if (!statusNote) {
      setCachedClientInterpretation(bytes, interpretation);
    }

    logClientInterpretOutcome({
      started,
      outcome: statusNote ? "partial" : "final",
      lab: finalized.metadata.lab,
      parser: finalized.parserType,
      partial: Boolean(statusNote),
      totalMs: routeMs,
    });

    logCalibrationRuntimeCheck({
      operation: "diamond-intelligence-interpret",
      durationMs: routeMs,
      parserPath: finalized.parserType,
      ocrDurationMs: finalized.timings.imageOcrMs || undefined,
    });

    return json({
      ok: true,
      interpretation,
      partial: Boolean(statusNote),
    });
  } catch (err) {
    const routeMs = Date.now() - started;
    const timedOut = err instanceof CalibrationTimeoutError;
    logCalibrationRuntimeCheck({
      operation: "diamond-intelligence-interpret",
      durationMs: routeMs,
      timedOut,
      error: timeoutErrorMessage(err),
    });

    logClientInterpretOutcome({
      started,
      outcome: "timeout",
      totalMs: routeMs,
      detail: timeoutErrorMessage(err),
    });

    return json(
      {
        ok: false,
        error: timedOut
          ? CLIENT_UPLOAD_INTERPRET_ERROR
          : CLIENT_UPLOAD_INTERPRET_ERROR,
      },
      timedOut ? 504 : 500,
    );
  } finally {
    logUploadPipelineTiming({
      phase: "client-payload",
      durationMs: Date.now() - started,
      detail: "request-end",
    });
  }
}
