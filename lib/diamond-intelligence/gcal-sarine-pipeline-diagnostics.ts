import type { UploadExtractionOutput } from "@/lib/calibration-library/extract-upload-pipeline";
import type { GcalSarineProportionOcrStepDiagnostics } from "@/lib/calibration-library/parsers/gcal/gcal-sarine-image-ocr";
import {
  getOcrRuntimeProbeSnapshot,
  type OcrRuntimeProbeSnapshot,
} from "@/lib/calibration-library/ocr";
import { describeTesseractRuntimePaths } from "@/lib/calibration-library/tesseract-runtime-paths";
import type { InterpretUploadedReportSuccess } from "./interpret-uploaded-report";

export type GcalSarineInterpretDiagnostics = {
  reportNumber?: string;
  parserFamily?: string;
  partial: boolean;
  tier?: string;
  totalMs: number;
  imageOcrMs: number;
  gcalSarineDiagramProportionWait?: boolean;
  giaDiagramProportionWait?: boolean;
  ocrAttempted: boolean;
  diagramOcrTimedOut?: boolean;
  gcalSarineDiagramOcrFailure?: string;
  pipelineError?: string | null;
  timedOut?: boolean;
  warnings: string[];
  pipelineNotices: string[];
  sarineOcrSteps?: GcalSarineProportionOcrStepDiagnostics;
  tesseractRuntime: OcrRuntimeProbeSnapshot;
  tesseractPaths: Record<string, string>;
  fieldsPresent: {
    tablePercent: boolean;
    depthPercent: boolean;
    crownAngle: boolean;
    pavilionAngle: boolean;
    lowerHalfPercent: boolean;
    starLengthPercent: boolean;
  };
};

function isGcalSarineInterpretReport(
  finalized: UploadExtractionOutput | undefined,
  reportNumber?: string,
  reportFormat?: string,
): boolean {
  if (finalized?.parserType === "gcal-sarine-4cs") return true;
  if (reportFormat === "gcal-8x") return true;
  const rn = reportNumber?.trim() ?? "";
  return /360796191|360796192/i.test(rn);
}

export function buildGcalSarineInterpretDiagnostics(
  result: InterpretUploadedReportSuccess,
): GcalSarineInterpretDiagnostics | null {
  const finalized = result.finalized;
  const interpretation = result.interpretation;
  if (
    !isGcalSarineInterpretReport(
      finalized,
      interpretation.metadata.reportNumber,
      interpretation.metadata.reportFormat,
    )
  ) {
    return null;
  }

  const fields = finalized?.fields ?? interpretation.interpretationFields;
  const has = (key: keyof typeof fields) => Boolean(fields[key]?.trim());

  return {
    reportNumber: interpretation.metadata.reportNumber,
    parserFamily: finalized?.parserType ?? interpretation.metadata.parserFamily,
    partial: result.partial,
    tier: result.decision.tier,
    totalMs: finalized?.timings?.totalMs ?? 0,
    imageOcrMs: finalized?.timings?.imageOcrMs ?? 0,
    gcalSarineDiagramProportionWait: finalized?.gcalSarineDiagramProportionWait,
    ocrAttempted: Boolean(finalized?.ocrAttempted),
    diagramOcrTimedOut: finalized?.diagramOcrTimedOut,
    gcalSarineDiagramOcrFailure: finalized?.gcalSarineDiagramOcrFailure,
    pipelineError: finalized?.pipelineError ?? null,
    timedOut: finalized?.timedOut,
    warnings: (finalized?.warnings ?? []).slice(0, 12),
    pipelineNotices: (finalized?.pipelineNotices ?? []).slice(0, 12),
    sarineOcrSteps: finalized?.gcalSarineOcrDiagnostics,
    tesseractRuntime: getOcrRuntimeProbeSnapshot(),
    tesseractPaths: describeTesseractRuntimePaths(),
    fieldsPresent: {
      tablePercent: has("tablePercent"),
      depthPercent: has("depthPercent"),
      crownAngle: has("crownAngle"),
      pavilionAngle: has("pavilionAngle"),
      lowerHalfPercent: has("lowerHalfPercent"),
      starLengthPercent: has("starLengthPercent"),
    },
  };
}

export function logGcalSarineInterpretDiagnostics(
  diagnostics: GcalSarineInterpretDiagnostics,
): void {
  console.log(
    "[gcal-sarine-pipeline-diag]",
    JSON.stringify({
      parserFamily: diagnostics.parserFamily ?? null,
      partial: diagnostics.partial,
      tier: diagnostics.tier ?? null,
      totalMs: diagnostics.totalMs,
      imageOcrMs: diagnostics.imageOcrMs,
      gcalSarineDiagramProportionWait:
        diagnostics.gcalSarineDiagramProportionWait ?? null,
      ocrAttempted: diagnostics.ocrAttempted,
      diagramOcrTimedOut: diagnostics.diagramOcrTimedOut ?? null,
      gcalSarineDiagramOcrFailure:
        diagnostics.gcalSarineDiagramOcrFailure ?? null,
      pipelineError: diagnostics.pipelineError ? "present" : null,
      timedOut: diagnostics.timedOut ?? null,
      warningCount: diagnostics.warnings.length,
      noticeCount: diagnostics.pipelineNotices.length,
      pageWidth: diagnostics.sarineOcrSteps?.pageWidth ?? null,
      pageHeight: diagnostics.sarineOcrSteps?.pageHeight ?? null,
      cropSucceeded: diagnostics.sarineOcrSteps?.cropSucceeded ?? null,
      ocrTokenCount: diagnostics.sarineOcrSteps?.ocrRawLength ?? null,
      ocrTransport: diagnostics.tesseractRuntime.transport ?? null,
      ocrRuntimeAvailable: diagnostics.tesseractRuntime.available,
      fieldsPresent: diagnostics.fieldsPresent,
    }),
  );
}
