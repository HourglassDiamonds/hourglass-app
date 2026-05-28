import type { AnchorPdfSpec } from "./anchor-pdf-paths";
import type { FieldProvenanceMap } from "./extraction-provenance";
import type { UploadExtractionOutput } from "./extract-upload-pipeline";
import type {
  CalibrationReportFields,
  CalibrationWorkbookEntry,
  ReportFieldKey,
} from "./types";
import { REPORT_FIELD_KEYS } from "./types";

/** Minimal workbook entry for calibration safety assessment during audits. */
export function buildEntryFromSaveInputForAudit(input: {
  spec: AnchorPdfSpec;
  fields: CalibrationReportFields;
  result: UploadExtractionOutput;
  provenance: FieldProvenanceMap;
}): CalibrationWorkbookEntry {
  const confidence = input.result.confidence;
  const extractedFieldsRaw = { ...input.fields };
  const extractedConfidence = { ...confidence };

  return {
    id: `audit-${input.spec.reportNumber}`,
    savedAt: new Date().toISOString(),
    metadata: {
      lab: input.spec.lab,
      reportNumber: input.spec.reportNumber,
      reportSource: "pdf-upload",
      stoneType: "unknown",
    },
    fields: input.fields,
    fieldsNormalized: input.fields,
    confidence,
    extractedFieldsRaw,
    extractedConfidence,
    parserType: input.result.parserType,
    parserConfidence: input.result.parserConfidence,
    textMethod: input.result.textMethod,
    warnings: input.result.warnings,
    missingFields: REPORT_FIELD_KEYS.filter((k) => !input.fields[k]?.trim()),
    parserMetadata: {
      parserType: input.result.parserType,
      extractionMeta: input.result.extractionMeta,
      fieldProvenance: input.provenance,
    },
    roundBrilliantScore: null,
    recordVersion: 1,
    schemaVersion: 1,
    fieldProvenance: input.provenance,
    valueProvenance: Object.fromEntries(
      REPORT_FIELD_KEYS.map((k) => [k, "extracted" as const]),
    ),
  };
}
