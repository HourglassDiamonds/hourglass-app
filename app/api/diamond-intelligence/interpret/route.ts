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
import { toClientSafeInterpretationPayload } from "@/lib/diamond-intelligence/client-api";
import {
  getCachedClientInterpretation,
  setCachedClientInterpretation,
} from "@/lib/diamond-intelligence/client-interpret-cache";
import {
  CLIENT_PARTIAL_INTERPRETATION_NOTE,
  CLIENT_UPLOAD_INTERPRET_ERROR,
} from "@/lib/diamond-intelligence/client-interpret-messages";
import { classifyFinalized } from "@/lib/diamond-intelligence/client-interpretation-pipeline";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(toJsonSafe(body), { status });
}

export async function POST(request: Request) {
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

  const cached = getCachedClientInterpretation(bytes);
  if (cached) {
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

    // ── STATE 3 + 4: SNAPSHOT + USEFULNESS GATE (single source of truth) ──
    const decision = classifyFinalized(finalized);

    // ── STATE 5: RESPONSE ─────────────────────────────────────────────────
    if (decision.tier === "failure") {
      return json({ ok: false, error: CLIENT_UPLOAD_INTERPRET_ERROR }, 422);
    }

    const partial = decision.tier === "partial";
    const statusNote = partial ? CLIENT_PARTIAL_INTERPRETATION_NOTE : undefined;

    const interpretation = toClientSafeInterpretationPayload(
      finalized,
      undefined,
      {
        clientStatusNote: statusNote,
        partial,
        includeDevDiagnostics: process.env.NODE_ENV === "development",
      },
    );

    if (decision.tier === "full") {
      setCachedClientInterpretation(bytes, interpretation);
    }

    return json({ ok: true, interpretation, partial });
  } catch (err) {
    const timedOut = err instanceof CalibrationTimeoutError;
    return json(
      { ok: false, error: CLIENT_UPLOAD_INTERPRET_ERROR },
      timedOut ? 504 : 500,
    );
  }
}
