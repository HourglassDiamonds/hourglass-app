import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { applyCorpusSaveGuardrails } from "./corpus-save-guardrails";
import {
  isActiveCorpusRecord,
  shouldQuarantineSeedFromActiveCorpus,
} from "./corpus-core";
import type { RecoveryCandidateClassification } from "./corpus-active-unsafe-triage";
import { assessCalibrationInclusion } from "./calibration-inclusion-policy";
import {
  assessCalibrationSafety,
  type CalibrationSafetyAssessment,
} from "./calibration-safety";
import { runCalibrationUploadExtraction } from "./extract-upload-pipeline";
import {
  evaluateQuarantineDecision,
  quarantineCalibrationRecord,
} from "./corpus-quarantine";
import { listMissingFieldKeys, normalizeCalibrationFields } from "./field-normalization";
import { scoreRoundBrilliant } from "./scoring/round-brilliant";
import type { CalibrationWorkbookEntry } from "./types";
import { REPORT_FIELD_KEYS } from "./types";
import { getCalibrationDataDir } from "./workbook-file";

export type ResolvedUploadFile = {
  path: string;
  filename: string;
  mtimeMs: number;
};

export type TargetedRecoveryAttempt = {
  id: string;
  reportNumber: string;
  lab: string;
  classification: RecoveryCandidateClassification;
  uploadResolved: boolean;
  uploadPath?: string;
  before: CalibrationSafetyAssessment;
  after: CalibrationSafetyAssessment;
  inclusionAfter: boolean;
  promotedToCalibrationSafe: boolean;
  fieldsGained: string[];
  error?: string;
  timedOut?: boolean;
};

export type ActiveArtifactQuarantineResult = {
  quarantined: number;
  ids: string[];
};

/** Resolve newest upload file matching sourceFilename suffix in uploads/. */
export function resolveUploadFileForEntry(
  entry: CalibrationWorkbookEntry,
): ResolvedUploadFile | null {
  const hint = entry.sourceFilename?.trim();
  if (!hint) return null;
  const uploadsDir = join(getCalibrationDataDir(), "uploads");
  let best: ResolvedUploadFile | null = null;
  try {
    for (const name of readdirSync(uploadsDir)) {
      if (!name.toLowerCase().endsWith(hint.toLowerCase()) && !name.includes(hint)) {
        continue;
      }
      const path = join(uploadsDir, name);
      const st = statSync(path);
      if (!st.isFile()) continue;
      if (!best || st.mtimeMs > best.mtimeMs) {
        best = { path, filename: name, mtimeMs: st.mtimeMs };
      }
    }
  } catch {
    return null;
  }
  return best;
}

export async function runTargetedReExtractionForEntry(
  entry: CalibrationWorkbookEntry,
): Promise<{ entry: CalibrationWorkbookEntry; attempt: TargetedRecoveryAttempt }> {
  const before = assessCalibrationSafety(entry);
  const baseAttempt: TargetedRecoveryAttempt = {
    id: entry.id,
    reportNumber: entry.metadata.reportNumber,
    lab: entry.metadata.lab,
    classification: "HIGH_RECOVERY_PROBABILITY",
    uploadResolved: false,
    before,
    after: before,
    inclusionAfter: assessCalibrationInclusion(entry).includedInCalibrationStatistics,
    promotedToCalibrationSafe: false,
    fieldsGained: [],
  };

  const resolved = resolveUploadFileForEntry(entry);
  if (!resolved) {
    return {
      entry,
      attempt: {
        ...baseAttempt,
        error: "No matching upload file in data/light-performance-calibration/uploads",
      },
    };
  }

  const bytes = readFileSync(resolved.path);
  const mime = resolved.filename.toLowerCase().endsWith(".png")
    ? "image/png"
    : "application/pdf";

  const pipeline = await runCalibrationUploadExtraction({
    bytes,
    mime,
    lab: entry.metadata.lab,
    reportNumber: entry.metadata.reportNumber,
    reportSource: entry.metadata.reportSource,
  });

  if (pipeline.timedOut) {
    const after = assessCalibrationSafety(entry);
    return {
      entry,
      attempt: {
        ...baseAttempt,
        uploadResolved: true,
        uploadPath: resolved.path,
        after,
        timedOut: true,
        error: "Pipeline timed out",
      },
    };
  }

  const prevFields = entry.fieldsNormalized ?? entry.fields;
  const extractedFieldsRaw = pipeline.fields;
  const fields = pipeline.fields;
  const fieldsNormalized = pipeline.fieldsNormalized ?? normalizeCalibrationFields(fields);
  const fieldsGained = REPORT_FIELD_KEYS.filter(
    (k) => !prevFields[k]?.trim() && fields[k]?.trim(),
  );

  const fieldProvenance =
    pipeline.fieldProvenance ??
    ({} as CalibrationWorkbookEntry["fieldProvenance"]);

  const valueProvenance =
    pipeline.valueProvenance ??
    Object.fromEntries(REPORT_FIELD_KEYS.map((k) => [k, "extracted" as const]));

  let updated: CalibrationWorkbookEntry = {
    ...entry,
    fields,
    fieldsNormalized,
    confidence: pipeline.confidence,
    extractedFieldsRaw,
    extractedConfidence: pipeline.confidence,
    parserType: pipeline.parserType,
    parserConfidence: pipeline.parserConfidence,
    textMethod: pipeline.textMethod,
    warnings: [...pipeline.warnings],
    missingFields: listMissingFieldKeys(fields),
    roundBrilliantScore: scoreRoundBrilliant(fieldsNormalized),
    fieldProvenance,
    valueProvenance,
    parserMetadata: {
      ...entry.parserMetadata,
      parserType: pipeline.parserType,
      parserConfidence: pipeline.parserConfidence,
      textMethod: pipeline.textMethod,
      extractionMeta: pipeline.extractionMeta,
      fieldProvenance,
      giaInternal: pipeline.giaInternal,
      gcalInternal: pipeline.gcalInternal,
      igiInternal: pipeline.igiInternal,
    },
    updatedAt: new Date().toISOString(),
  };

  const after = assessCalibrationSafety(updated);
  updated.calibrationEligible = after.calibrationEligible;
  updated = applyCorpusSaveGuardrails(updated);

  const inclusionAfter = assessCalibrationInclusion(updated).includedInCalibrationStatistics;

  return {
    entry: updated,
    attempt: {
      ...baseAttempt,
      uploadResolved: true,
      uploadPath: resolved.path,
      after: assessCalibrationSafety(updated),
      inclusionAfter,
      promotedToCalibrationSafe:
        !before.calibrationEligible && after.calibrationEligible,
      fieldsGained,
    },
  };
}

/** Quarantine active seed/test/runtime artifacts — does not modify already-quarantined rows. */
export function quarantineActiveCorpusArtifacts(
  entries: CalibrationWorkbookEntry[],
): { entries: CalibrationWorkbookEntry[]; result: ActiveArtifactQuarantineResult } {
  const result: ActiveArtifactQuarantineResult = { quarantined: 0, ids: [] };
  const out = entries.map((entry) => {
    if (!isActiveCorpusRecord(entry)) return entry;
    if (!shouldQuarantineSeedFromActiveCorpus(entry)) return entry;
    const decision = evaluateQuarantineDecision(entry);
    const reason =
      decision.reason === "runtime_dup_test_artifact"
        ? "runtime_dup_test_artifact"
        : "incomplete_core_proportions";
    const q = quarantineCalibrationRecord(
      entry,
      reason,
      decision.detail ??
        `seed_test_artifact: ${entry.metadata.reportNumber}`,
    );
    result.quarantined++;
    result.ids.push(entry.id);
    return q;
  });
  return { entries: out, result };
}
