import { verifyCalibrationAccess } from "@/lib/calibration-library/auth";
import { isAcceptedReportMime } from "@/lib/calibration-library/document-extract";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import { toJsonSafe } from "@/lib/calibration-library/gcal-api-error";
import { inferReportSourceFromUpload } from "@/lib/calibration-library/infer-report-source";
import {
  CalibrationTimeoutError,
  timeoutErrorMessage,
  validateCalibrationUpload,
  withTimeout,
} from "@/lib/calibration-library/runtime-guard";
import {
  CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
  CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
} from "@/lib/calibration-library/runtime-limits";
import { labFamilyLabel } from "@/lib/calibration-library/upload-pipeline-timing";
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
  classifyFinalized,
  snapshotFieldSummary,
  type ClientInterpretationTier,
} from "@/lib/diamond-intelligence/client-interpretation-pipeline";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(toJsonSafe(body), { status });
}

type LogStage = "received" | "extracted" | "classified" | "responded";

function logClientInterpret(input: {
  stage: LogStage;
  lab?: string;
  parser?: string;
  fields?: string;
  useful?: boolean;
  response?: "full" | "partial" | "failure";
  routeMs: number;
  detail?: string;
}): void {
  if (process.env.NODE_ENV !== "development") return;
  console.log("[client-interpret]", {
    stage: input.stage,
    lab: input.lab ? labFamilyLabel(input.lab, input.parser) : undefined,
    fields: input.fields,
    useful: input.useful,
    response: input.response,
    routeMs: input.routeMs,
    detail: input.detail,
  });
}

const TIER_TO_RESPONSE: Record<
  ClientInterpretationTier,
  "full" | "partial" | "failure"
> = {
  full: "full",
  partial: "partial",
  failure: "failure",
};

export async function POST(request: Request) {
  const started = Date.now();
  const ms = () => Date.now() - started;

  if (!verifyCalibrationAccess(request)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  // ── STATE 1: FILE RECEIVED ──────────────────────────────────────────────
  let bytes: Buffer;
  let mime: string;
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return json({ ok: false, error: "A report file is required." }, 400);
    }
    if (!isAcceptedReportMime(file.type)) {
      return json(
        { ok: false, error: "Please upload a PDF or image of your lab report." },
        400,
      );
    }

    bytes = Buffer.from(await file.arrayBuffer());
    mime = file.type;

    const uploadCheck = await validateCalibrationUpload(bytes, mime);
    if (!uploadCheck.ok) {
      return json({ ok: false, error: uploadCheck.error }, 400);
    }
  } catch {
    return json({ ok: false, error: CLIENT_UPLOAD_INTERPRET_ERROR }, 400);
  }

  logClientInterpret({ stage: "received", routeMs: ms() });

  const cached = getCachedClientInterpretation(bytes);
  if (cached) {
    logClientInterpret({
      stage: "responded",
      lab: cached.metadata.lab,
      response: "full",
      useful: true,
      routeMs: ms(),
      detail: "cache-hit",
    });
    return json({ ok: true, interpretation: cached, partial: false });
  }

  // ── STATE 2: FAST EXTRACTION (region-only, no full-page OCR) ─────────────
  try {
    const finalized = await withTimeout(
      runCalibrationUploadExtraction({
        bytes,
        mime,
        reportSource: inferReportSourceFromUpload(mime, false),
        mode: "client",
        initialPipelineNotices: [],
        pipelineTimeoutMs: CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
      }),
      CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
      "diamond-intelligence-interpret",
    );

    logClientInterpret({
      stage: "extracted",
      lab: finalized.metadata.lab,
      parser: finalized.parserType,
      routeMs: ms(),
      detail: finalized.timedOut ? "timed-out-with-snapshot" : "complete",
    });

    // ── STATE 3 + 4: SNAPSHOT + USEFULNESS GATE (single source of truth) ──
    const decision = classifyFinalized(finalized);
    const fieldSummary = snapshotFieldSummary(decision.snapshot);

    logClientInterpret({
      stage: "classified",
      lab: finalized.metadata.lab,
      parser: finalized.parserType,
      fields: fieldSummary,
      useful: decision.useful,
      response: TIER_TO_RESPONSE[decision.tier],
      routeMs: ms(),
    });

    // ── STATE 5: RESPONSE ─────────────────────────────────────────────────
    if (decision.tier === "failure") {
      logClientInterpret({
        stage: "responded",
        lab: finalized.metadata.lab,
        parser: finalized.parserType,
        fields: fieldSummary,
        useful: false,
        response: "failure",
        routeMs: ms(),
      });
      return json({ ok: false, error: CLIENT_UPLOAD_INTERPRET_ERROR }, 422);
    }

    const partial = decision.tier === "partial";
    const statusNote = partial ? CLIENT_PARTIAL_INTERPRETATION_NOTE : undefined;

    const interpretation = toClientSafeInterpretationPayload(
      finalized,
      undefined,
      { clientStatusNote: statusNote, partial },
    );

    if (decision.tier === "full") {
      setCachedClientInterpretation(bytes, interpretation);
    }

    logClientInterpret({
      stage: "responded",
      lab: finalized.metadata.lab,
      parser: finalized.parserType,
      fields: fieldSummary,
      useful: true,
      response: TIER_TO_RESPONSE[decision.tier],
      routeMs: ms(),
    });

    return json({ ok: true, interpretation, partial });
  } catch (err) {
    // Route-level backstop — pipeline normally returns a snapshot before this.
    const timedOut = err instanceof CalibrationTimeoutError;
    logClientInterpret({
      stage: "responded",
      response: "failure",
      useful: false,
      routeMs: ms(),
      detail: timedOut ? "route-timeout-backstop" : timeoutErrorMessage(err),
    });
    return json(
      { ok: false, error: CLIENT_UPLOAD_INTERPRET_ERROR },
      timedOut ? 504 : 500,
    );
  }
}
