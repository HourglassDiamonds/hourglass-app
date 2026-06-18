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
import { isDiamondIntelligenceAcceptedMime } from "@/lib/diamond-intelligence/upload-validation";
import { toClientSafeInterpretationPayload } from "@/lib/diamond-intelligence/client-api";
import {
  getCachedClientInterpretation,
  setCachedClientInterpretation,
} from "@/lib/diamond-intelligence/client-interpret-cache";
import {
  CLIENT_GIA_DIAGRAM_OCR_TIMEOUT_ERROR,
  CLIENT_PARTIAL_INTERPRETATION_NOTE,
  CLIENT_UPLOAD_INTERPRET_ERROR,
} from "@/lib/diamond-intelligence/client-interpret-messages";
import { classifyFinalized } from "@/lib/diamond-intelligence/client-interpretation-pipeline";
import { shouldPresentScoredCoreRead } from "@/lib/diamond-intelligence/client-presentation-gates";
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

export async function interpretUploadedReport(
  input: InterpretUploadedReportInput,
): Promise<InterpretUploadedReportResult> {
  activateClientBundledTesseractRuntime();

  const { bytes, mime, sourceFilename } = input;

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
    const clientPdf = isPdfMime(mime);
    const routeTimeoutMs = clientPdf
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
        pipelineTimeoutMs: clientPdf
          ? CLIENT_GIA_DIAGRAM_PIPELINE_TIMEOUT_MS
          : CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
        regionOcrTimeoutMs: clientPdf
          ? CLIENT_GIA_DIAGRAM_REGION_OCR_TIMEOUT_MS
          : undefined,
      }),
      routeTimeoutMs,
      "diamond-intelligence-interpret",
    );

    const decision = classifyFinalized(finalized);

    if (finalized.diagramOcrTimedOut) {
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

    if (decision.tier === "failure") {
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
    return {
      ok: false,
      error: CLIENT_UPLOAD_INTERPRET_ERROR,
      httpStatus: timedOut ? 504 : 500,
      timedOut,
      pipelineError: timeoutErrorMessage(err),
    };
  }
}
