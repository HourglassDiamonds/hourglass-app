import type { AnchorPdfSpec } from "./anchor-pdf-paths";
import { applyCorpusSaveGuardrails } from "./corpus-save-guardrails";
import {
  assessCalibrationSafety,
  type CalibrationSafetyAssessment,
} from "./calibration-safety";
import {
  buildFieldProvenanceFromExtraction,
  type FieldProvenanceMap,
  type ValueProvenanceMap,
} from "./extraction-provenance";
import { finalizeExtractionFields } from "./fields";
import { enrichGiaFacsimileExtractionPolicy } from "./gia-facsimile-calibration-policy";
import { normalizeCalibrationFields } from "./field-normalization";
import type {
  CalibrationReportFields,
  CalibrationWorkbookEntry,
  ExtractionResult,
  ReportFieldKey,
} from "./types";
import { REPORT_FIELD_KEYS } from "./types";

/** Canonical output after OCR hydration — all entry points must return this shape. */
export type FinalizedCalibrationExtraction = ExtractionResult & {
  fieldsNormalized: CalibrationReportFields;
  valueProvenance: ValueProvenanceMap;
  calibrationSafety: CalibrationSafetyAssessment;
  calibrationEligible: boolean;
  excludedFromCalibrationStats: boolean;
  corpusReviewFlags?: string[];
};

export type FinalizeCalibrationExtractionInput = {
  /** Post-parse / post-OCR extraction payload (fields may be pre-sanitized). */
  parsed: ExtractionResult;
  /** Full document text for provenance + GIA facsimile policy. */
  combinedText?: string;
  usedImageOCR?: boolean;
  /** When set, builds the same safety entry shape as anchor-live audit. */
  auditSpec?: Pick<AnchorPdfSpec, "reportNumber" | "lab" | "scenarioId">;
};

function applyIgiExtractionGuards(
  parsed: ExtractionResult,
  fields: CalibrationReportFields,
): void {
  if (parsed.metadata.lab !== "IGI") return;

  const pavilionDepth = parsed.igiInternal?.pavilionDepthPercent?.trim();
  const lower = fields.lowerHalfPercent.trim();

  // Never map pavilion depth % (43) into lowerHalfPercent.
  if (pavilionDepth === "43" && lower === "43") {
    fields.lowerHalfPercent = "";
  }

  const uncertainCandidate =
    parsed.extractionMeta?.igiDiagramLowerGirdleCandidate?.trim();
  if (
    uncertainCandidate &&
    lower === uncertainCandidate &&
    lower === pavilionDepth
  ) {
    fields.lowerHalfPercent = "";
  }
}

function buildProvisionalWorkbookEntry(
  parsed: ExtractionResult,
  fields: CalibrationReportFields,
  fieldsNormalized: CalibrationReportFields,
  fieldProvenance: FieldProvenanceMap,
  valueProvenance: ValueProvenanceMap,
  auditSpec?: Pick<AnchorPdfSpec, "reportNumber" | "lab" | "scenarioId">,
): CalibrationWorkbookEntry {
  return {
    id: `finalize-${parsed.metadata.reportNumber || "unknown"}`,
    savedAt: new Date().toISOString(),
    metadata: auditSpec
      ? {
          ...parsed.metadata,
          reportNumber: auditSpec.reportNumber,
          lab: auditSpec.lab,
        }
      : parsed.metadata,
    fields,
    fieldsNormalized,
    confidence: parsed.confidence,
    extractedFieldsRaw: { ...fields },
    extractedConfidence: { ...parsed.confidence },
    parserType: parsed.parserType,
    parserConfidence: parsed.parserConfidence,
    textMethod: parsed.textMethod,
    warnings: parsed.warnings,
    missingFields: REPORT_FIELD_KEYS.filter((k) => !fields[k]?.trim()),
    parserMetadata: {
      parserType: parsed.parserType,
      parserConfidence: parsed.parserConfidence,
      textMethod: parsed.textMethod,
      extractionMeta: parsed.extractionMeta,
      igiInternal: parsed.igiInternal,
      giaInternal: parsed.giaInternal,
      gcalInternal: parsed.gcalInternal,
      fieldProvenance,
      valueProvenance,
    },
    roundBrilliantScore: null,
    recordVersion: 1,
    schemaVersion: 1,
    fieldProvenance,
    valueProvenance,
  };
}

/**
 * Single deterministic final normalized result path:
 * lab guards → field formatting → whitelist sanitation → GIA policy → provenance → safety.
 */
export function finalizeCalibrationExtractionResult(
  input: FinalizeCalibrationExtractionInput,
): FinalizedCalibrationExtraction {
  const { parsed, auditSpec } = input;
  const combinedText =
    input.combinedText?.trim() || parsed.rawTextSnippet?.trim() || "";

  const preSanitize: CalibrationReportFields = { ...parsed.fields };
  applyIgiExtractionGuards(parsed, preSanitize);

  const fields = finalizeExtractionFields(preSanitize);
  const fieldsNormalized = normalizeCalibrationFields(fields);

  const result: ExtractionResult = {
    ...parsed,
    fields,
    warnings: [...parsed.warnings],
  };

  enrichGiaFacsimileExtractionPolicy(result, combinedText);

  const fieldProvenance =
    parsed.fieldProvenance ??
    buildFieldProvenanceFromExtraction(result, combinedText, {
      usedImageOCR: input.usedImageOCR,
    });

  const valueProvenance: ValueProvenanceMap = Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, "extracted" as const]),
  ) as ValueProvenanceMap;

  const provisional = buildProvisionalWorkbookEntry(
    result,
    fields,
    fieldsNormalized,
    fieldProvenance,
    valueProvenance,
    auditSpec,
  );

  const guarded = applyCorpusSaveGuardrails(provisional);
  const calibrationSafety = assessCalibrationSafety(guarded);

  return {
    ...result,
    fields,
    fieldsNormalized,
    fieldProvenance,
    valueProvenance,
    calibrationSafety,
    calibrationEligible:
      guarded.calibrationEligible ?? calibrationSafety.calibrationEligible,
    excludedFromCalibrationStats: guarded.excludedFromCalibrationStats ?? true,
    corpusReviewFlags: guarded.corpusReviewFlags,
  };
}

/** Parity helper: canonical field map for the 15 core review fields. */
export function finalizedParityFieldMap(
  finalized: FinalizedCalibrationExtraction,
): Record<ReportFieldKey, string> {
  return finalized.fields;
}
