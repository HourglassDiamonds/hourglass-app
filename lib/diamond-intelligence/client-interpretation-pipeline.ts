import type { FinalizedCalibrationExtraction } from "@/lib/calibration-library/finalize-calibration-extraction";
import type {
  CalibrationReportFields,
  FieldConfidence,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import { clientExtractionSufficient } from "./client-extraction-sufficient";

/**
 * Single source of truth for the CLIENT interpretation path.
 *
 * Responsibilities:
 *  - Build ONE normalized snapshot from finalized extraction.
 *  - Decide usefulness with ONE deterministic gate.
 *  - Classify into full | partial | failure.
 *
 * Calibration/admin scoring and parser behavior are untouched.
 */

export type ClientFieldSnapshot = {
  lab: string;
  reportNumber: string;
  shape: string;
  carat: string;
  measurements: string;
  table: string;
  depth: string;
  crownAngle: string;
  pavilionAngle: string;
  polish: string;
  symmetry: string;
  fluorescence: string;
  missingFields: ReportFieldKey[];
  extractionConfidence?: Record<ReportFieldKey, FieldConfidence>;
};

export type ClientInterpretationTier = "full" | "partial" | "failure";

export type ClientInterpretationDecision = {
  tier: ClientInterpretationTier;
  useful: boolean;
  sufficient: boolean;
  snapshot: ClientFieldSnapshot;
};

function val(fields: CalibrationReportFields, key: ReportFieldKey): string {
  return (fields[key] ?? "").trim();
}

export function buildClientFieldSnapshot(input: {
  fields: CalibrationReportFields;
  metadata: { lab: string; reportNumber: string };
  confidence?: Record<ReportFieldKey, FieldConfidence>;
}): ClientFieldSnapshot {
  const { fields, metadata, confidence } = input;
  const missingFields = REPORT_FIELD_KEYS.filter((k) => !val(fields, k));

  return {
    lab: (metadata.lab ?? "").trim(),
    reportNumber: (metadata.reportNumber ?? "").trim(),
    shape: val(fields, "shape"),
    carat: val(fields, "carat"),
    measurements: val(fields, "measurements"),
    table: val(fields, "tablePercent"),
    depth: val(fields, "depthPercent"),
    crownAngle: val(fields, "crownAngle"),
    pavilionAngle: val(fields, "pavilionAngle"),
    polish: val(fields, "polish"),
    symmetry: val(fields, "symmetry"),
    fluorescence: val(fields, "fluorescence"),
    missingFields,
    extractionConfidence: confidence,
  };
}

/**
 * Lenient gate — TRUE when ANY meaningful cluster exists.
 * Only FALSE when essentially no report data was read.
 */
export function isUsefulClientInterpretation(
  snapshot: ClientFieldSnapshot,
): boolean {
  const hasReportIdentity = Boolean(snapshot.lab && snapshot.reportNumber);
  const hasShapeCarat = Boolean(snapshot.shape && snapshot.carat);
  const hasMeasurements = Boolean(snapshot.measurements);

  const proportionCount = [
    snapshot.table,
    snapshot.depth,
    snapshot.crownAngle,
    snapshot.pavilionAngle,
  ].filter(Boolean).length;
  const proportionsCluster = proportionCount >= 2;

  const finishCount = [
    snapshot.polish,
    snapshot.symmetry,
    snapshot.fluorescence,
  ].filter(Boolean).length;
  const finishCluster = finishCount >= 2;

  return (
    hasReportIdentity ||
    hasShapeCarat ||
    hasMeasurements ||
    proportionsCluster ||
    finishCluster
  );
}

/**
 * ONE classifier used by the route. Maps extraction quality to a tier:
 *  - full:    proportion/deep-capable interpretation (cacheable)
 *  - partial: useful but incomplete (200, calm missing-data messaging)
 *  - failure: essentially no usable data (422)
 */
export function classifyClientInterpretation(input: {
  fields: CalibrationReportFields;
  metadata: { lab: string; reportNumber: string };
  confidence?: Record<ReportFieldKey, FieldConfidence>;
}): ClientInterpretationDecision {
  const snapshot = buildClientFieldSnapshot(input);
  const useful = isUsefulClientInterpretation(snapshot);
  const sufficient = clientExtractionSufficient({
    fields: input.fields,
    confidence: input.confidence,
  });

  let tier: ClientInterpretationTier;
  if (!useful) {
    tier = "failure";
  } else if (sufficient) {
    tier = "full";
  } else {
    tier = "partial";
  }

  return { tier, useful, sufficient, snapshot };
}

export function classifyFinalized(
  finalized: Pick<FinalizedCalibrationExtraction, "fields" | "confidence" | "metadata">,
): ClientInterpretationDecision {
  return classifyClientInterpretation({
    fields: finalized.fields,
    confidence: finalized.confidence,
    metadata: {
      lab: finalized.metadata.lab,
      reportNumber: finalized.metadata.reportNumber,
    },
  });
}

/** Compact field summary for deterministic logging (no values, counts only). */
export function snapshotFieldSummary(snapshot: ClientFieldSnapshot): string {
  const present = REPORT_FIELD_KEYS.length - snapshot.missingFields.length;
  const flags = [
    snapshot.lab && snapshot.reportNumber ? "id" : "",
    snapshot.shape && snapshot.carat ? "shape+carat" : "",
    snapshot.measurements ? "meas" : "",
    [snapshot.table, snapshot.depth, snapshot.crownAngle, snapshot.pavilionAngle].filter(
      Boolean,
    ).length >= 2
      ? "props"
      : "",
    [snapshot.polish, snapshot.symmetry, snapshot.fluorescence].filter(Boolean)
      .length >= 2
      ? "finish"
      : "",
  ].filter(Boolean);
  return `${present}/${REPORT_FIELD_KEYS.length}[${flags.join(",")}]`;
}
