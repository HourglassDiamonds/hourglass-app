import { isRoundBrilliantShape } from "@/lib/calibration-library/fields";
import { scoreRoundBrilliant } from "@/lib/calibration-library/scoring/round-brilliant";
import type {
  CalibrationReportFields,
  RoundBrilliantScoreDimension,
} from "@/lib/calibration-library/types";
import type { ClientInterpretationLevel } from "./types";

export type ClientLightTrait = {
  label: string;
  level: "Strong" | "Balanced" | "Limited" | "Needs review";
  fillPercent: number;
};

export type ClientInterpretationScore = {
  eligible: boolean;
  overall: number | null;
  bandLabel: string;
  summaryLine: string;
  lightTraits: ClientLightTrait[];
};

function traitLevel(score: number | null): ClientLightTrait["level"] {
  if (score === null) return "Needs review";
  if (score >= 82) return "Strong";
  if (score >= 65) return "Balanced";
  if (score >= 45) return "Limited";
  return "Needs review";
}

function avgDimensionScore(
  dimensions: RoundBrilliantScoreDimension[],
  keys: string[],
): number | null {
  const scores = dimensions
    .filter((d) => keys.includes(d.key) && d.score > 0)
    .map((d) => d.score);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function buildLightTraits(
  dimensions: RoundBrilliantScoreDimension[],
): ClientLightTrait[] {
  const specs: { label: string; keys: string[] }[] = [
    { label: "Brightness", keys: ["tablePercent", "depthPercent"] },
    { label: "Fire", keys: ["crownAngle", "pavilionAngle"] },
    { label: "Scintillation", keys: ["lowerHalfPercent", "starLengthPercent"] },
    { label: "Contrast", keys: ["polish", "symmetry"] },
    { label: "Leakage control", keys: ["depthPercent", "tablePercent"] },
  ];

  return specs.map(({ label, keys }) => {
    const score = avgDimensionScore(dimensions, keys);
    return {
      label,
      level: traitLevel(score),
      fillPercent: score === null ? 0 : Math.min(100, Math.round(score)),
    };
  });
}

function bandLabelClient(band: string): string {
  switch (band) {
    case "strong":
      return "Strong optical read";
    case "balanced":
      return "Balanced optical read";
    case "watch":
      return "Mixed optical read";
    default:
      return "Preliminary read";
  }
}

function levelFallbackScore(level: ClientInterpretationLevel): number {
  switch (level) {
    case "deep":
      return 88;
    case "proportion":
      return 78;
    default:
      return 68;
  }
}

/** Client-safe score presentation — no calibration/corpus language in returned strings. */
export function presentClientInterpretationScore(
  fields: CalibrationReportFields,
  interpretationLevel: ClientInterpretationLevel,
): ClientInterpretationScore {
  if (!isRoundBrilliantShape(fields.shape)) {
    return {
      eligible: false,
      overall: null,
      bandLabel: "Preliminary read",
      summaryLine:
        "Proportion scoring is tuned for round brilliants. Justin can interpret other shapes in context.",
      lightTraits: buildLightTraits([]),
    };
  }

  const raw = scoreRoundBrilliant(fields);

  if (!raw.eligible) {
    return {
      eligible: false,
      overall: null,
      bandLabel: "Preliminary read",
      summaryLine:
        "A few proportion details would strengthen this read. This is an interpretation, not a laboratory grade.",
      lightTraits: buildLightTraits(raw.dimensions),
    };
  }

  const lightTraits = buildLightTraits(raw.dimensions);

  return {
    eligible: true,
    overall: raw.overall,
    bandLabel: bandLabelClient(raw.band),
    summaryLine:
      "Estimated read from reported proportions and finish lines on your report — not an official lab grade.",
    lightTraits,
  };
}

export function opticalBalanceDisplayValue(
  score: ClientInterpretationScore,
  interpretationLevel: ClientInterpretationLevel,
): number {
  if (score.eligible && score.overall !== null) return score.overall;
  return levelFallbackScore(interpretationLevel);
}
