import {
  CORPUS_CORE_PROPORTION_KEYS,
  isRuntimeDupTestReport,
  missingCoreProportionKeys,
  type CorpusStatus,
} from "./corpus-core";
import type { CalibrationWorkbookEntry } from "./types";

export type QuarantineReason =
  | "runtime_dup_test_artifact"
  | "incomplete_core_proportions";

export type QuarantineDecision = {
  shouldQuarantine: boolean;
  reason?: QuarantineReason;
  detail?: string;
};

export function evaluateQuarantineDecision(
  entry: CalibrationWorkbookEntry,
): QuarantineDecision {
  if (entry.syntheticCalibration) {
    return { shouldQuarantine: false };
  }
  if (entry.corpusStatus === "quarantined") {
    return {
      shouldQuarantine: true,
      reason: entry.quarantineReason as QuarantineReason | undefined,
      detail: "already quarantined",
    };
  }

  const reportNumber = entry.metadata.reportNumber.trim();
  if (isRuntimeDupTestReport(reportNumber)) {
    return {
      shouldQuarantine: true,
      reason: "runtime_dup_test_artifact",
      detail: `reportNumber matches RUNTIME-DUP-TEST pattern (${reportNumber})`,
    };
  }

  const fields = entry.fieldsNormalized ?? entry.fields;
  if (!CORPUS_CORE_PROPORTION_KEYS.every((k) => fields[k]?.trim())) {
    const missing = missingCoreProportionKeys(fields);
    return {
      shouldQuarantine: true,
      reason: "incomplete_core_proportions",
      detail: `missing core proportions: ${missing.join(", ")}`,
    };
  }

  return { shouldQuarantine: false };
}

/** Mark record as quarantined — never deletes data. */
export function quarantineCalibrationRecord(
  entry: CalibrationWorkbookEntry,
  reason: QuarantineReason,
  detail?: string,
): CalibrationWorkbookEntry {
  const corpusStatus: CorpusStatus = "quarantined";
  return {
    ...entry,
    corpusStatus,
    quarantineReason: detail ? `${reason}: ${detail}` : reason,
    excludedFromCalibrationStats: true,
    calibrationEligible: false,
    updatedAt: new Date().toISOString(),
    parserMetadata: {
      ...entry.parserMetadata,
      corpusStatus,
      quarantineReason: detail ? `${reason}: ${detail}` : reason,
      excludedFromCalibrationStats: true,
    },
  };
}

export function clearQuarantineIfRecovered(
  entry: CalibrationWorkbookEntry,
): CalibrationWorkbookEntry {
  const decision = evaluateQuarantineDecision(entry);
  if (decision.shouldQuarantine) return entry;
  return {
    ...entry,
    corpusStatus: "active",
    quarantineReason: undefined,
    parserMetadata: {
      ...entry.parserMetadata,
      corpusStatus: "active" as const,
      quarantineReason: undefined,
    },
  };
}

export type QuarantineBatchResult = {
  examined: number;
  newlyQuarantined: number;
  alreadyQuarantined: number;
  skippedSynthetic: number;
  affectedIds: string[];
  reasons: Record<QuarantineReason, number>;
};

export function applyQuarantineBatch(
  entries: CalibrationWorkbookEntry[],
): { entries: CalibrationWorkbookEntry[]; result: QuarantineBatchResult } {
  const result: QuarantineBatchResult = {
    examined: 0,
    newlyQuarantined: 0,
    alreadyQuarantined: 0,
    skippedSynthetic: 0,
    affectedIds: [],
    reasons: {
      runtime_dup_test_artifact: 0,
      incomplete_core_proportions: 0,
    },
  };

  const out = entries.map((entry) => {
    if (entry.syntheticCalibration) {
      result.skippedSynthetic++;
      return entry;
    }
    result.examined++;

    if (entry.corpusStatus === "quarantined") {
      result.alreadyQuarantined++;
      return entry;
    }

    const decision = evaluateQuarantineDecision(entry);
    if (!decision.shouldQuarantine || !decision.reason) {
      return entry;
    }

    result.newlyQuarantined++;
    result.affectedIds.push(entry.id);
    result.reasons[decision.reason]++;
    return quarantineCalibrationRecord(
      entry,
      decision.reason,
      decision.detail,
    );
  });

  return { entries: out, result };
}
