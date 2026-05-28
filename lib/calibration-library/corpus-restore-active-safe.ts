import { assessCalibrationSafety } from "./calibration-safety";
import {
  isCalibrationSeedOrTestArtifact,
  isRuntimeDupTestReport,
} from "./corpus-core";
import { applyCorpusSaveGuardrails } from "./corpus-save-guardrails";
import type { CalibrationWorkbookEntry } from "./types";

/** Undo mistaken quarantine on production-safe rows (structural junk patterns only). */
export function restoreWronglyQuarantinedProductionSafe(
  entries: CalibrationWorkbookEntry[],
): { entries: CalibrationWorkbookEntry[]; restored: number; ids: string[] } {
  const ids: string[] = [];
  const out = entries.map((entry) => {
    if (entry.corpusStatus !== "quarantined") return entry;
    if (entry.syntheticCalibration) return entry;
    if (isCalibrationSeedOrTestArtifact(entry)) return entry;
    if (isRuntimeDupTestReport(entry.metadata.reportNumber)) return entry;
    const safety = assessCalibrationSafety(entry);
    if (!safety.calibrationEligible) return entry;

    const restored = applyCorpusSaveGuardrails({
      ...entry,
      corpusStatus: "active",
      quarantineReason: undefined,
      calibrationEligible: safety.calibrationEligible,
      parserMetadata: {
        ...entry.parserMetadata,
        corpusStatus: "active",
        quarantineReason: undefined,
      },
    });
    ids.push(entry.id);
    return restored;
  });
  return { entries: out, restored: ids.length, ids };
}
