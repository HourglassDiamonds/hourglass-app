import type { InterpretUploadedReportFailure } from "./interpret-uploaded-report";
import {
  REPORT_FIELD_KEYS,
  type CalibrationReportFields,
} from "@/lib/calibration-library/types";

export function isInterpretDiagnosticsEnabled(): boolean {
  return process.env.DI_INTERPRET_DIAGNOSTICS === "1";
}

export type InterpretFailureDiagnostics = {
  pdfOpenOk: boolean;
  pageCount: number | null;
  textLayerLength: number;
  extractedCharCount: number;
  labGuess: string;
  parserFamily: string;
  fieldsExtracted: number;
  warnings: string[];
  elapsedMs: number;
  failureReason: string;
  ocrAttempted: boolean;
  renderAttempted: boolean;
  cacheHit: boolean;
  pipelineError: string | null;
  timedOut: boolean;
};

export function buildInterpretFailureDiagnostics(
  result: InterpretUploadedReportFailure,
): InterpretFailureDiagnostics {
  const finalized = result.finalized;
  const fields: CalibrationReportFields =
    finalized?.fields ?? ({} as CalibrationReportFields);
  const fieldsExtracted = REPORT_FIELD_KEYS.filter((k) =>
    Boolean(fields[k]?.trim()),
  ).length;
  const textLayerLength = finalized?.pdfTextLayerLength ?? 0;
  const extractedCharCount = finalized?.extractedCharCount ?? 0;
  const pipelineError = result.pipelineError ?? finalized?.pipelineError ?? null;

  let failureReason = "classification_failure_tier";
  if (pipelineError?.includes("document-extract")) {
    failureReason = "document_extract_timeout";
  } else if (result.timedOut || finalized?.timedOut) {
    failureReason = "pipeline_timeout";
  } else if (textLayerLength === 0 && extractedCharCount === 0) {
    failureReason = "no_extracted_text";
  } else if (fieldsExtracted === 0) {
    failureReason = "parser_no_fields";
  }

  return {
    pdfOpenOk: textLayerLength > 0 || extractedCharCount > 0,
    pageCount: null,
    textLayerLength,
    extractedCharCount,
    labGuess: finalized?.metadata?.lab ?? result.decision?.snapshot?.lab ?? "",
    parserFamily: finalized?.parserType ?? "",
    fieldsExtracted,
    warnings: finalized?.warnings?.slice(0, 8) ?? [],
    elapsedMs: finalized?.timings?.totalMs ?? 0,
    failureReason,
    ocrAttempted: Boolean(finalized?.ocrAttempted),
    renderAttempted: Boolean(
      (finalized?.timings?.imageOcrMs ?? 0) > 0 ||
        (finalized?.timings?.pdfFullPageOcrMs ?? 0) > 0,
    ),
    cacheHit: false,
    pipelineError,
    timedOut: Boolean(result.timedOut || finalized?.timedOut),
  };
}
