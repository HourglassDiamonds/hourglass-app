import { assessCalibrationSafety } from "./calibration-safety";
import { applyCorpusSaveGuardrails } from "./corpus-save-guardrails";
import {
  CORPUS_CORE_PROPORTION_KEYS,
  isRealUploadedCalibrationRecord,
} from "./corpus-core";
import { enrichGiaFacsimileExtractionPolicy } from "./gia-facsimile-calibration-policy";
import {
  buildFieldProvenanceFromExtraction,
} from "./extraction-provenance";
import type {
  CalibrationWorkbookEntry,
  ExtractionResult,
  FieldConfidence,
  ReportFieldKey,
} from "./types";
import { REPORT_FIELD_KEYS } from "./types";

/** Rebuild confidence for provenance without changing stored field values. */
function rebuildRehydrateConfidence(
  entry: CalibrationWorkbookEntry,
): Record<ReportFieldKey, FieldConfidence> {
  const out = { ...entry.confidence } as Record<ReportFieldKey, FieldConfidence>;
  const fields = entry.fieldsNormalized ?? entry.fields;
  const extracted = entry.extractedFieldsRaw;
  const textMethod = entry.textMethod ?? "none";

  if (textMethod !== "ocr") return out;

  for (const key of CORPUS_CORE_PROPORTION_KEYS) {
    const approved = fields[key]?.trim();
    const raw = extracted[key]?.trim();
    if (!approved) continue;
    if (raw && approved === raw && out[key] === "low") {
      out[key] = "medium";
    }
  }
  return out;
}

function buildRehydrateExtractionResult(
  entry: CalibrationWorkbookEntry,
): ExtractionResult {
  const confidence = rebuildRehydrateConfidence(entry);
  return {
    metadata: entry.metadata,
    fields: entry.fields,
    confidence,
    parserType: entry.parserType,
    parserConfidence: entry.parserConfidence,
    extractionMeta: entry.parserMetadata?.extractionMeta ?? {
      usedImageOCR: false,
      pdfTextLayerLength: 0,
      fallbackStage: "manual-review",
    },
    giaInternal: entry.parserMetadata?.giaInternal,
    gcalInternal: entry.parserMetadata?.gcalInternal,
    igiInternal: entry.parserMetadata?.igiInternal,
    rawTextSnippet: "",
    warnings: [...entry.warnings],
    textMethod: entry.textMethod,
  };
}

/**
 * Re-run provenance, safety, and inclusion metadata only.
 * Does not re-score, re-upload, or overwrite extractedFieldsRaw / approved values.
 */
export function rehydrateCalibrationRecord(
  entry: CalibrationWorkbookEntry,
): CalibrationWorkbookEntry {
  if (entry.syntheticCalibration || entry.corpusStatus === "quarantined") {
    return entry;
  }
  if (!isRealUploadedCalibrationRecord(entry)) {
    return applyCorpusSaveGuardrails(entry);
  }

  const result = buildRehydrateExtractionResult(entry);
  const usedImageOCR = Boolean(
    entry.parserMetadata?.extractionMeta?.usedImageOCR,
  );

  let fieldProvenance = buildFieldProvenanceFromExtraction(result, "", {
    usedImageOCR,
  });

  const girdleEvidence =
    entry.parserMetadata?.extractionMeta?.giaFacsimileGirdleEvidence;
  if (girdleEvidence && !entry.fields.girdle?.trim()) {
    result.extractionMeta = {
      ...result.extractionMeta!,
      giaFacsimileGirdleEvidence: girdleEvidence,
    };
    enrichGiaFacsimileExtractionPolicy(result, "");
    fieldProvenance = result.fieldProvenance ?? fieldProvenance;
  }

  let updated: CalibrationWorkbookEntry = {
    ...entry,
    confidence: result.confidence,
    fieldProvenance,
    parserMetadata: {
      ...entry.parserMetadata,
      fieldProvenance,
      extractionMeta: result.extractionMeta,
    },
    updatedAt: new Date().toISOString(),
  };

  const safety = assessCalibrationSafety(updated);
  updated.calibrationEligible = safety.calibrationEligible;

  return applyCorpusSaveGuardrails(updated);
}

export type RehydrateBatchResult = {
  examined: number;
  rehydrated: number;
  skipped: number;
  skippedReasons: Record<string, number>;
  affectedIds: string[];
};

export function applyRehydrateBatch(
  entries: CalibrationWorkbookEntry[],
): { entries: CalibrationWorkbookEntry[]; result: RehydrateBatchResult } {
  const result: RehydrateBatchResult = {
    examined: 0,
    rehydrated: 0,
    skipped: 0,
    skippedReasons: {},
    affectedIds: [],
  };

  const bumpSkip = (reason: string) => {
    result.skipped++;
    result.skippedReasons[reason] = (result.skippedReasons[reason] ?? 0) + 1;
  };

  const out = entries.map((entry) => {
    if (entry.syntheticCalibration) {
      bumpSkip("synthetic");
      return entry;
    }
    if (entry.corpusStatus === "quarantined") {
      bumpSkip("quarantined");
      return entry;
    }
    if (!isRealUploadedCalibrationRecord(entry)) {
      bumpSkip("not_real_upload");
      return entry;
    }

    result.examined++;
    const beforeEligible = entry.calibrationEligible;
    const beforeProv = JSON.stringify(entry.fieldProvenance ?? {});
    const next = rehydrateCalibrationRecord(entry);
    const afterProv = JSON.stringify(next.fieldProvenance ?? {});

    if (
      beforeEligible !== next.calibrationEligible ||
      beforeProv !== afterProv ||
      entry.excludedFromCalibrationStats !== next.excludedFromCalibrationStats
    ) {
      result.rehydrated++;
      result.affectedIds.push(entry.id);
    }
    return next;
  });

  return { entries: out, result };
}
