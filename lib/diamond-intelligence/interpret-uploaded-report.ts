import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import { isImageMime, isPdfMime } from "@/lib/calibration-library/document-extract";
import { inferReportSourceFromUpload } from "@/lib/calibration-library/infer-report-source";
import {
  CalibrationTimeoutError,
  timeoutErrorMessage,
  validateCalibrationUpload,
  withTimeout,
} from "@/lib/calibration-library/runtime-guard";
import {
  CLIENT_GIA_DIAGRAM_INTERPRET_ROUTE_TIMEOUT_MS,
  CLIENT_GIA_DIAGRAM_PIPELINE_TIMEOUT_MS,
  CLIENT_GIA_DIAGRAM_REGION_OCR_TIMEOUT_MS,
  CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
  CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
} from "@/lib/calibration-library/runtime-limits";
import {
  getOcrRuntimeProbeSnapshot,
  isOcrDisabledByEnv,
} from "@/lib/calibration-library/ocr";
import { isDiamondIntelligenceAcceptedMime } from "@/lib/diamond-intelligence/upload-validation";
import { toClientSafeInterpretationPayload } from "@/lib/diamond-intelligence/client-api";
import {
  getCachedClientInterpretation,
  setCachedClientInterpretation,
} from "@/lib/diamond-intelligence/client-interpret-cache";
import {
  CLIENT_GIA_DIAGRAM_OCR_TIMEOUT_ERROR,
  CLIENT_OCR_RUNTIME_UNAVAILABLE_ERROR,
  CLIENT_PARTIAL_INTERPRETATION_NOTE,
  CLIENT_UPLOAD_INTERPRET_ERROR,
} from "@/lib/diamond-intelligence/client-interpret-messages";
import { classifyFinalized } from "@/lib/diamond-intelligence/client-interpretation-pipeline";
import { shouldPresentScoredCoreRead } from "@/lib/diamond-intelligence/client-presentation-gates";
import { assessExtractionCompleteness } from "@/lib/diamond-intelligence/extraction-completeness";
import { traceClientPayloadStages } from "@/lib/diamond-intelligence/gia-qa-pipeline-trace";
import { parseReportGradeHints, buildReportGradeHintSource } from "@/lib/diamond-intelligence/report-grade-hints";
import type { ClientSafeInterpretationPayload } from "@/lib/diamond-intelligence/client-api";
import type { ClientInterpretationDecision } from "@/lib/diamond-intelligence/client-interpretation-pipeline";
import type { UploadExtractionOutput } from "@/lib/calibration-library/extract-upload-pipeline";
import { activateClientBundledTesseractRuntime } from "@/lib/diamond-intelligence/client-tesseract-runtime";
import {
  CLIENT_UNSUPPORTED_REPORT_FORMAT_HEADLINE,
} from "@/lib/diamond-intelligence/unsupported-report-format-copy";
import { probeClientUnsupportedReportFormat } from "@/lib/diamond-intelligence/unsupported-format-probe";
import type { UnsupportedReportFormatMatch } from "@/lib/diamond-intelligence/unsupported-report-format";
import {
  createInterpretRequestId,
  logDiamondIntelligenceInterpretObservability,
  logDiamondIntelligenceInterpretStage,
} from "@/lib/diamond-intelligence/interpret-observability";
export type InterpretUploadedReportInput = {
  bytes: Buffer;
  mime: string;
  sourceFilename?: string;
};

export type InterpretUploadedReportSuccess = {
  ok: true;
  interpretation: ClientSafeInterpretationPayload;
  partial: boolean;
  cacheHit: boolean;
  finalized: UploadExtractionOutput;
  decision: ClientInterpretationDecision;
};

export type InterpretUploadedReportFailure = {
  ok: false;
  error: string;
  httpStatus: number;
  code?: string;
  timedOut?: boolean;
  pipelineError?: string;
  finalized?: UploadExtractionOutput;
  decision?: ClientInterpretationDecision;
  unsupportedFormat?: UnsupportedReportFormatMatch;
};

export type InterpretUploadedReportResult =
  | InterpretUploadedReportSuccess
  | InterpretUploadedReportFailure;

function diagramProportionOcrRequired(
  finalized: UploadExtractionOutput,
): boolean {
  return (
    Boolean(finalized.giaDiagramProportionWait) ||
    Boolean(finalized.gcalSarineDiagramProportionWait) ||
    finalized.gcalSarineDiagramOcrFailure === "F-ocr-runtime-unavailable"
  );
}

function isDiagramOcrInfrastructureFailure(
  finalized: UploadExtractionOutput,
): boolean {
  if (!diagramProportionOcrRequired(finalized)) return false;
  if (assessExtractionCompleteness({ fields: finalized.fields }).scoreEligible) {
    return false;
  }
  if (finalized.gcalSarineDiagramOcrFailure === "F-ocr-runtime-unavailable") {
    return true;
  }
  if (isOcrDisabledByEnv()) return true;
  const probe = getOcrRuntimeProbeSnapshot();
  return probe.checked && !probe.available;
}

export async function interpretUploadedReport(
  input: InterpretUploadedReportInput,
): Promise<InterpretUploadedReportResult> {
  const requestId = createInterpretRequestId();
  const interpretStarted = Date.now();
  activateClientBundledTesseractRuntime();
  logDiamondIntelligenceInterpretStage({
    requestId,
    event: { stage: "interpret-start", status: "start", elapsedMs: 0 },
  });

  const { bytes, mime } = input;

  if (!isDiamondIntelligenceAcceptedMime(mime)) {
    return {
      ok: false,
      error: "Please upload a PDF or image of your lab report.",
      httpStatus: 400,
    };
  }

  const uploadCheck = await validateCalibrationUpload(bytes, mime);
  if (!uploadCheck.ok) {
    return {
      ok: false,
      error: uploadCheck.error,
      httpStatus: 400,
    };
  }

  const cached = getCachedClientInterpretation(bytes);
  if (cached) {
    return {
      ok: true,
      interpretation: cached,
      partial: false,
      cacheHit: true,
      finalized: {} as UploadExtractionOutput,
      decision: {
        tier: "full",
        useful: true,
        sufficient: true,
        snapshot: {
          lab: cached.metadata.lab,
          reportNumber: cached.metadata.reportNumber,
          shape: "",
          carat: "",
          measurements: "",
          table: "",
          depth: "",
          crownAngle: "",
          pavilionAngle: "",
          polish: "",
          symmetry: "",
          fluorescence: "",
          missingFields: [],
        },
      },
    };
  }

  try {
    const clientDiagramOcrBudget = isPdfMime(mime) || isImageMime(mime);
    const routeTimeoutMs = clientDiagramOcrBudget
      ? CLIENT_GIA_DIAGRAM_INTERPRET_ROUTE_TIMEOUT_MS
      : CLIENT_INTERPRET_ROUTE_TIMEOUT_MS;

    if (isPdfMime(mime) || isImageMime(mime)) {
      try {
        const unsupportedFormat = await probeClientUnsupportedReportFormat(
          bytes,
          mime,
        );
        if (unsupportedFormat) {
          return {
            ok: false,
            error: CLIENT_UNSUPPORTED_REPORT_FORMAT_HEADLINE,
            httpStatus: 422,
            code: "unsupported_report_format",
            unsupportedFormat,
          };
        }
      } catch {
        // Probe failure — fall through to full pipeline (existing behavior).
      }
    }

    const finalized = await withTimeout(
      runCalibrationUploadExtraction({
        bytes,
        mime,
        reportSource: inferReportSourceFromUpload(mime, false),
        mode: "client",
        initialPipelineNotices: [],
        pipelineTimeoutMs: clientDiagramOcrBudget
          ? CLIENT_GIA_DIAGRAM_PIPELINE_TIMEOUT_MS
          : CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
        regionOcrTimeoutMs: clientDiagramOcrBudget
          ? CLIENT_GIA_DIAGRAM_REGION_OCR_TIMEOUT_MS
          : undefined,
      }),
      routeTimeoutMs,
      "diamond-intelligence-interpret",
    );

    logDiamondIntelligenceInterpretStage({
      requestId,
      event: {
        stage: "extraction-complete",
        status: "complete",
        elapsedMs: Date.now() - interpretStarted,
      },
      extras: {
        imageOcrElapsedMs: finalized.timings?.imageOcrMs ?? 0,
        parserFamily: finalized.parserType ?? null,
        ocrTransport: getOcrRuntimeProbeSnapshot().transport ?? null,
      },
    });

    const decision = classifyFinalized(finalized);

    if (finalized.diagramOcrTimedOut) {
      logDiamondIntelligenceInterpretObservability({
        finalized,
        timedOut: true,
        httpStatus: 504,
        requestId,
      });
      logDiamondIntelligenceInterpretStage({
        requestId,
        event: {
          stage: "interpret-failed",
          status: "failed",
          elapsedMs: Date.now() - interpretStarted,
          errorCategory: "diagram_ocr_timeout",
          errorClass: "CalibrationTimeoutError",
        },
      });
      return {
        ok: false,
        error: CLIENT_GIA_DIAGRAM_OCR_TIMEOUT_ERROR,
        httpStatus: 504,
        timedOut: true,
        finalized,
        decision,
        pipelineError: finalized.pipelineError,
      };
    }

    if (isDiagramOcrInfrastructureFailure(finalized)) {
      logDiamondIntelligenceInterpretObservability({
        finalized,
        httpStatus: 503,
        requestId,
      });
      logDiamondIntelligenceInterpretStage({
        requestId,
        event: {
          stage: "interpret-failed",
          status: "failed",
          elapsedMs: Date.now() - interpretStarted,
          errorCategory: "ocr_runtime_unavailable",
          errorClass:
            getOcrRuntimeProbeSnapshot().error?.split(";")[0] ??
            finalized.gcalSarineDiagramOcrFailure ??
            "ocr-unavailable",
        },
      });
      return {
        ok: false,
        error: CLIENT_OCR_RUNTIME_UNAVAILABLE_ERROR,
        httpStatus: 503,
        code: "ocr_runtime_unavailable",
        finalized,
        decision,
        pipelineError:
          finalized.gcalSarineDiagramOcrFailure ??
          getOcrRuntimeProbeSnapshot().error ??
          "OCR not available in this environment",
      };
    }

    if (decision.tier === "failure") {
      logDiamondIntelligenceInterpretObservability({
        finalized,
        timedOut: finalized.timedOut,
        httpStatus: 422,
        requestId,
      });
      return {
        ok: false,
        error: CLIENT_UPLOAD_INTERPRET_ERROR,
        httpStatus: 422,
        finalized,
        decision,
        timedOut: finalized.timedOut,
        pipelineError: finalized.pipelineError,
      };
    }

    const partial = decision.tier === "partial";
    const gradeHints = parseReportGradeHints(
      buildReportGradeHintSource({
        reportGradeHintText: finalized.reportGradeHintText,
        rawTextSnippet: finalized.rawTextSnippet?.trim(),
        warnings: finalized.warnings,
      }) ?? "",
    );
    const suppressPartialConsumerNote = shouldPresentScoredCoreRead({
      fields: finalized.fields,
      gradeHints,
    });
    const statusNote =
      partial && !suppressPartialConsumerNote
        ? CLIENT_PARTIAL_INTERPRETATION_NOTE
        : undefined;

    const interpretation = toClientSafeInterpretationPayload(
      finalized,
      undefined,
      {
        clientStatusNote: statusNote,
        partial,
        includeDevDiagnostics: process.env.NODE_ENV === "development",
      },
    );

    traceClientPayloadStages(finalized, { partial });

    if (decision.tier === "full" || suppressPartialConsumerNote) {
      setCachedClientInterpretation(bytes, interpretation);
    }

    logDiamondIntelligenceInterpretObservability({
      finalized,
      timedOut: finalized.timedOut,
      httpStatus: 200,
      requestId,
    });
    logDiamondIntelligenceInterpretStage({
      requestId,
      event: {
        stage: "interpret-complete",
        status: "complete",
        elapsedMs: Date.now() - interpretStarted,
      },
      extras: {
        scoreEligible: assessExtractionCompleteness({
          fields: finalized.fields,
        }).scoreEligible,
        partial,
      },
    });

    return {
      ok: true,
      interpretation,
      partial,
      cacheHit: false,
      finalized,
      decision,
    };
  } catch (err) {
    const timedOut = err instanceof CalibrationTimeoutError;
    logDiamondIntelligenceInterpretStage({
      requestId,
      event: {
        stage: "interpret-failed",
        status: "failed",
        elapsedMs: Date.now() - interpretStarted,
        errorCategory: timedOut ? "pipeline_timeout" : "pipeline_error",
        errorClass: timedOut ? "CalibrationTimeoutError" : "Error",
      },
    });
    return {
      ok: false,
      error: CLIENT_UPLOAD_INTERPRET_ERROR,
      httpStatus: timedOut ? 504 : 500,
      timedOut,
      pipelineError: timeoutErrorMessage(err),
    };
  }
}
