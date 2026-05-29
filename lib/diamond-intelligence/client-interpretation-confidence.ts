import type { CalibrationReportFields } from "@/lib/calibration-library/types";

/**
 * Client-facing DISPLAY confidence.
 *
 * This layer does NOT change calibration scoring, parsers, or the canonical
 * score. It only describes how certain the *presentation* is allowed to sound
 * given the proportion/finish data actually visible on the report, and exposes
 * caps the UI applies to the displayed score, graph strength, and copy tone.
 */

export type ClientInterpretationConfidenceLevel = "high" | "medium" | "low";

export type ClientInterpretationConfidence = {
  level: ClientInterpretationConfidenceLevel;
  reason: string;
  missingCriticalFields: string[];
  hasCoreIdentity: boolean;
  hasMeasurements: boolean;
  hasCoreProportions: boolean;
  hasFullProportions: boolean;
  hasFinishContext: boolean;
  scoreDisplayCap: number;
  graphStrengthMultiplier: number;
  canShowRareLanguage: boolean;
  canShowExceptionalLanguage: boolean;
};

const CORE_PROPORTION_LABELS: Record<string, string> = {
  tablePercent: "table",
  depthPercent: "depth",
  crownAngle: "crown angle",
  pavilionAngle: "pavilion angle",
};

function present(
  fields: Partial<CalibrationReportFields> | null | undefined,
  key: keyof CalibrationReportFields,
): boolean {
  return Boolean((fields?.[key] ?? "").trim());
}

/**
 * Inspect the available fields and return a display-confidence profile.
 *
 * Levels:
 *  - high:   measurements + all 4 core proportions + finish context → cap 100
 *  - medium: measurements + ≥2 core proportions                     → cap 92
 *  - low:    anything less (identity/basic only, sparse proportions) → cap 85
 */
export function buildClientInterpretationConfidence(
  fields: Partial<CalibrationReportFields> | null | undefined,
): ClientInterpretationConfidence {
  const hasMeasurements = present(fields, "measurements");
  const hasCoreIdentity = present(fields, "shape") && present(fields, "carat");

  const coreProportionKeys: (keyof CalibrationReportFields)[] = [
    "tablePercent",
    "depthPercent",
    "crownAngle",
    "pavilionAngle",
  ];
  const presentCoreProportions = coreProportionKeys.filter((k) =>
    present(fields, k),
  );
  const coreProportionCount = presentCoreProportions.length;
  const hasCoreProportions = coreProportionCount === coreProportionKeys.length;
  const hasFullProportions =
    hasCoreProportions &&
    (present(fields, "girdle") || present(fields, "culet"));

  const finishCount = (
    ["polish", "symmetry", "fluorescence"] as (keyof CalibrationReportFields)[]
  ).filter((k) => present(fields, k)).length;
  const hasFinishContext = finishCount >= 1;

  const missingCriticalFields: string[] = [];
  if (!hasMeasurements) missingCriticalFields.push("measurements");
  for (const k of coreProportionKeys) {
    if (!present(fields, k)) {
      missingCriticalFields.push(CORE_PROPORTION_LABELS[k] ?? k);
    }
  }

  // HIGH — full proportion + finish context visible.
  if (hasMeasurements && hasCoreProportions && hasFinishContext) {
    return {
      level: "high",
      reason: "Full proportion and finish detail is visible on the report.",
      missingCriticalFields,
      hasCoreIdentity,
      hasMeasurements,
      hasCoreProportions,
      hasFullProportions,
      hasFinishContext,
      scoreDisplayCap: 100,
      graphStrengthMultiplier: 1,
      canShowRareLanguage: true,
      canShowExceptionalLanguage: true,
    };
  }

  // MEDIUM — measurements + a meaningful proportion cluster.
  if (hasMeasurements && coreProportionCount >= 2) {
    return {
      level: "medium",
      reason:
        "Core proportions are partly visible; deeper diagram detail would improve confidence.",
      missingCriticalFields,
      hasCoreIdentity,
      hasMeasurements,
      hasCoreProportions,
      hasFullProportions,
      hasFinishContext,
      scoreDisplayCap: 92,
      graphStrengthMultiplier: 0.75,
      canShowRareLanguage: false,
      canShowExceptionalLanguage: false,
    };
  }

  // LOW — identity/basic details only, or sparse proportions.
  return {
    level: "low",
    reason:
      "Key proportion details are not visible on this report, so the read stays preliminary.",
    missingCriticalFields,
    hasCoreIdentity,
    hasMeasurements,
    hasCoreProportions,
    hasFullProportions,
    hasFinishContext,
    scoreDisplayCap: 85,
    graphStrengthMultiplier: 0.45,
    canShowRareLanguage: false,
    canShowExceptionalLanguage: false,
  };
}
