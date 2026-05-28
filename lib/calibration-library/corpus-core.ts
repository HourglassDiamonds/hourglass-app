import type { CalibrationWorkbookEntry, ReportFieldKey } from "./types";

/** LP calibration drivers — required for corpus safety / quarantine. */
export const CORPUS_CORE_PROPORTION_KEYS: ReportFieldKey[] = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
];

export type CorpusStatus = "active" | "quarantined";

export function isRuntimeDupTestReport(reportNumber: string): boolean {
  return /RUNTIME-DUP-TEST/i.test(reportNumber.trim());
}

export function hasAnyCoreProportion(
  fields: CalibrationWorkbookEntry["fields"],
): boolean {
  return CORPUS_CORE_PROPORTION_KEYS.some((k) => Boolean(fields[k]?.trim()));
}

export function missingCoreProportionKeys(
  fields: CalibrationWorkbookEntry["fields"],
): ReportFieldKey[] {
  return CORPUS_CORE_PROPORTION_KEYS.filter((k) => !fields[k]?.trim());
}

/** Non-synthetic records from real uploads (not manual fixtures or runtime junk). */
export function isRealUploadedCalibrationRecord(
  entry: CalibrationWorkbookEntry,
): boolean {
  if (entry.syntheticCalibration) return false;
  if (isRuntimeDupTestReport(entry.metadata.reportNumber)) return false;
  const src = entry.metadata.reportSource;
  return src === "pdf-upload" || src === "screenshot-upload";
}

export function isActiveCorpusRecord(entry: CalibrationWorkbookEntry): boolean {
  return entry.corpusStatus !== "quarantined";
}

/** Seed scenarios, OCR fixture variants, and runtime test artifacts — not production uploads. */
export function isCalibrationSeedOrTestArtifact(
  entry: CalibrationWorkbookEntry,
): boolean {
  const rn = entry.metadata.reportNumber.trim();
  if (/^SEED-/i.test(rn)) return true;
  if (isRuntimeDupTestReport(rn)) return true;
  if (/^LG773657228-/i.test(rn)) return true;
  return false;
}

/** Seed/fixture rows to move off active corpus — excludes anchor PDF LG773657228 for recovery pass. */
export function shouldQuarantineSeedFromActiveCorpus(
  entry: CalibrationWorkbookEntry,
): boolean {
  if (!isCalibrationSeedOrTestArtifact(entry)) return false;
  const rn = entry.metadata.reportNumber.trim();
  if (
    /^LG773657228$/i.test(rn) &&
    entry.metadata.reportSource === "pdf-upload"
  ) {
    return false;
  }
  return true;
}
