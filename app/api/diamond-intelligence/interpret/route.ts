import { verifyCalibrationAccess } from "@/lib/calibration-library/auth";
import {
  extractTextFromDocument,
  isAcceptedReportMime,
} from "@/lib/calibration-library/document-extract";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import {
  errorMessageFromUnknown,
  toJsonSafe,
} from "@/lib/calibration-library/gcal-api-error";
import { inferReportSourceFromUpload } from "@/lib/calibration-library/infer-report-source";
import {
  CalibrationTimeoutError,
  logCalibrationRuntimeCheck,
  timeoutErrorMessage,
  validateCalibrationUpload,
  withTimeout,
} from "@/lib/calibration-library/runtime-guard";
import { EXTRACT_FILE_PIPELINE_TIMEOUT_MS } from "@/lib/calibration-library/runtime-limits";
import { toClientSafeInterpretationPayload } from "@/lib/diamond-intelligence/client-api";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(toJsonSafe(body), { status });
}

export async function POST(request: Request) {
  const started = Date.now();

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

    const bytes = Buffer.from(await file.arrayBuffer());
    const uploadCheck = await validateCalibrationUpload(bytes, file.type);
    if (!uploadCheck.ok) {
      return json({ ok: false, error: uploadCheck.error }, 400);
    }
    const reportSource = inferReportSourceFromUpload(file.type, false);

    let preExtractedDocument:
      | Awaited<ReturnType<typeof extractTextFromDocument>>
      | undefined;

    try {
      preExtractedDocument = await extractTextFromDocument(bytes, file.type);
    } catch {
      preExtractedDocument = undefined;
    }

    const finalized = await withTimeout(
      runCalibrationUploadExtraction({
        bytes,
        mime: file.type,
        reportSource,
        preExtractedDocument,
        initialPipelineNotices: [],
        pipelineTimeoutMs: EXTRACT_FILE_PIPELINE_TIMEOUT_MS,
      }),
      EXTRACT_FILE_PIPELINE_TIMEOUT_MS,
      "diamond-intelligence-interpret",
    );

    if (finalized.timedOut || finalized.pipelineError) {
      return json(
        {
          ok: false,
          error:
            "We couldn't read enough from this file to build a useful interpretation. You can try another report image or PDF, or send it to Justin for review.",
        },
        504,
      );
    }

    const interpretation = toClientSafeInterpretationPayload(finalized);

    if (!interpretation.capability.canRunClientInterpretation) {
      return json(
        {
          ok: false,
          error:
            "We couldn't read enough from this file to build a useful interpretation. You can try another report image or PDF, or send it to Justin for review.",
        },
        422,
      );
    }

    logCalibrationRuntimeCheck({
      operation: "diamond-intelligence-interpret",
      durationMs: Date.now() - started,
      parserPath: finalized.parserType,
    });

    return json({ ok: true, interpretation });
  } catch (err) {
    const timedOut = err instanceof CalibrationTimeoutError;
    logCalibrationRuntimeCheck({
      operation: "diamond-intelligence-interpret",
      durationMs: Date.now() - started,
      timedOut,
      error: timeoutErrorMessage(err),
    });

    if (timedOut) {
      return json(
        {
          ok: false,
          error:
            "Reading the report took longer than expected. Try a clearer PDF or image, or ask Justin to review the report.",
        },
        504,
      );
    }

    return json(
      {
        ok: false,
        error:
          "We couldn't read enough from this file to build a useful interpretation. You can try another report image or PDF, or send it to Justin for review.",
      },
      500,
    );
  }
}
