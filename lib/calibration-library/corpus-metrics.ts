import { assessCalibrationInclusion } from "./calibration-inclusion-policy";
import { assessCalibrationSafety } from "./calibration-safety";
import { isActiveCorpusRecord } from "./corpus-core";
import type { CalibrationWorkbookEntry } from "./types";

export type CorpusSafetySnapshot = {
  totalRecords: number;
  syntheticRecords: number;
  nonSyntheticRecords: number;
  activeCorpusRecords: number;
  quarantinedRecords: number;
  calibrationSafeAll: number;
  calibrationSafeNonSynthetic: number;
  calibrationSafeActiveCorpus: number;
  calibrationSafePercent: number;
  calibrationSafeNonSyntheticPercent: number;
  calibrationSafeActiveCorpusPercent: number;
  statisticsIncludedActive: number;
  statisticsIncludedActivePercent: number;
  excludedFromStats: number;
};

function pct(n: number, d: number): number {
  return d ? Math.round((n / d) * 100) : 0;
}

export function computeCorpusSafetySnapshot(
  entries: CalibrationWorkbookEntry[],
): CorpusSafetySnapshot {
  const synthetic = entries.filter((e) => e.syntheticCalibration);
  const nonSynthetic = entries.filter((e) => !e.syntheticCalibration);
  const active = nonSynthetic.filter((e) => isActiveCorpusRecord(e));
  const quarantined = nonSynthetic.filter((e) => e.corpusStatus === "quarantined");

  const safeAll = entries.filter(
    (e) => assessCalibrationSafety(e).calibrationEligible,
  ).length;
  const safeNonSynth = nonSynthetic.filter(
    (e) => assessCalibrationSafety(e).calibrationEligible,
  ).length;
  const safeActive = active.filter(
    (e) => assessCalibrationSafety(e).calibrationEligible,
  ).length;

  const statsIncludedActive = active.filter(
    (e) => assessCalibrationInclusion(e).includedInCalibrationStatistics,
  ).length;

  const excludedFromStats = nonSynthetic.filter(
    (e) => e.excludedFromCalibrationStats,
  ).length;

  return {
    totalRecords: entries.length,
    syntheticRecords: synthetic.length,
    nonSyntheticRecords: nonSynthetic.length,
    activeCorpusRecords: active.length,
    quarantinedRecords: quarantined.length,
    calibrationSafeAll: safeAll,
    calibrationSafeNonSynthetic: safeNonSynth,
    calibrationSafeActiveCorpus: safeActive,
    calibrationSafePercent: pct(safeAll, entries.length),
    calibrationSafeNonSyntheticPercent: pct(safeNonSynth, nonSynthetic.length),
    calibrationSafeActiveCorpusPercent: pct(safeActive, active.length),
    statisticsIncludedActive: statsIncludedActive,
    statisticsIncludedActivePercent: pct(statsIncludedActive, active.length),
    excludedFromStats,
  };
}
