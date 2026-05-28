import { isRoundBrilliantShape } from "../fields";
import type {
  CalibrationReportFields,
  ReportFieldKey,
  RoundBrilliantScoreDimension,
  RoundBrilliantScoreResult,
} from "../types";
import {
  scoreReportedCulet,
  scoreReportedFluorescence,
  scoreReportedGirdle,
  scoreReportedGradeLine,
} from "./reported-finish";

type TargetSpec = {
  label: string;
  ideal: number;
  min: number;
  max: number;
  weight: number;
};

const PROPORTION_KEYS = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "lowerHalfPercent",
  "starLengthPercent",
] as const satisfies readonly ReportFieldKey[];

const FINISH_KEYS = [
  "girdle",
  "culet",
  "polish",
  "symmetry",
  "fluorescence",
] as const satisfies readonly ReportFieldKey[];

const PROPORTION_TARGETS: Record<(typeof PROPORTION_KEYS)[number], TargetSpec> = {
  tablePercent: { label: "Table %", ideal: 57, min: 53, max: 58, weight: 1.2 },
  depthPercent: { label: "Depth %", ideal: 61, min: 59, max: 62.5, weight: 1 },
  crownAngle: { label: "Crown angle", ideal: 34.5, min: 32, max: 36, weight: 1.1 },
  pavilionAngle: {
    label: "Pavilion angle",
    ideal: 40.75,
    min: 40.2,
    max: 41.2,
    weight: 1.3,
  },
  lowerHalfPercent: {
    label: "Lower half %",
    ideal: 77.5,
    min: 75,
    max: 80,
    weight: 0.9,
  },
  starLengthPercent: {
    label: "Star length %",
    ideal: 50,
    min: 45,
    max: 55,
    weight: 0.8,
  },
};

/** Proportions dominate; finish lines use the same neutral scale for every lab. */
const PROPORTION_GROUP_WEIGHT = 0.62;
const FINISH_GROUP_WEIGHT = 0.38;

const DISCLAIMERS = [
  "Calibration score uses reported proportions and finish lines only — laboratory identity is stored as context and is not weighted in v1.",
  "IGI, GIA, GCAL, AGS, and Other reports use the same neutral finish interpretation; no lab reputation penalty.",
  "This is not an official lab grade — values must match your report.",
];

const WEIGHTING_NOTE =
  "v1 weighting: ~62% proportions (table, depth, crown, pavilion, lower half, star) · ~38% reported finish (girdle, culet, polish, symmetry, fluorescence). Lab not used.";

function parseNum(value: string): number | null {
  const n = parseFloat(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function scoreDimension(value: number, spec: TargetSpec): number {
  if (value >= spec.min && value <= spec.max) {
    const span = Math.max(spec.max - spec.min, 0.01);
    const dist = Math.abs(value - spec.ideal) / span;
    return Math.round(100 - dist * 18);
  }
  const below = value < spec.min ? spec.min - value : 0;
  const above = value > spec.max ? value - spec.max : 0;
  const miss = below || above;
  return Math.max(0, Math.round(72 - miss * 14));
}

function bandFromOverall(overall: number): RoundBrilliantScoreResult["band"] {
  if (overall >= 88) return "strong";
  if (overall >= 74) return "balanced";
  if (overall >= 58) return "watch";
  return "outlier";
}

function scoreFinishField(
  key: (typeof FINISH_KEYS)[number],
  raw: string,
): RoundBrilliantScoreDimension {
  let result;
  switch (key) {
    case "girdle":
      result = scoreReportedGirdle(raw);
      break;
    case "culet":
      result = scoreReportedCulet(raw);
      break;
    case "polish":
    case "symmetry":
      result = scoreReportedGradeLine(raw);
      break;
    case "fluorescence":
      result = scoreReportedFluorescence(raw);
      break;
  }

  const label =
    key === "girdle"
      ? "Girdle (reported)"
      : key === "culet"
        ? "Culet (reported)"
        : key === "polish"
          ? "Polish (reported)"
          : key === "symmetry"
            ? "Symmetry (reported)"
            : "Fluorescence (reported)";

  return {
    key,
    label,
    value: raw.trim() || null,
    targetLabel: "Neutral calibration band (all labs)",
    score: result.score,
    note: result.note,
    group: "reported-finish",
  };
}

/**
 * Lab-neutral round-brilliant calibration score (v1).
 * @param fields — proportion & finish values from the report only
 */
export function scoreRoundBrilliant(
  fields: CalibrationReportFields,
): RoundBrilliantScoreResult {
  const shapeRaw = fields.shape.trim();
  if (!shapeRaw) {
    return {
      overall: 0,
      band: "outlier",
      dimensions: [],
      summary:
        "Round-brilliant scoring requires shape from the report. Values are still saved for the library.",
      disclaimers: DISCLAIMERS,
      eligible: false,
      ineligibleReason: "Shape was not extracted from the report.",
      weightingNote: WEIGHTING_NOTE,
    };
  }

  if (!isRoundBrilliantShape(shapeRaw)) {
    return {
      overall: 0,
      band: "outlier",
      dimensions: [],
      summary:
        "Round-brilliant scoring applies only when shape is round brilliant. Values are still saved for the library.",
      disclaimers: DISCLAIMERS,
      eligible: false,
      ineligibleReason: "Shape is not round brilliant.",
      weightingNote: WEIGHTING_NOTE,
    };
  }

  const dimensions: RoundBrilliantScoreDimension[] = [];
  let proportionSum = 0;
  let proportionWeight = 0;
  let finishSum = 0;
  let finishWeight = 0;
  const missing: string[] = [];

  for (const key of PROPORTION_KEYS) {
    const spec = PROPORTION_TARGETS[key];
    const raw = fields[key];
    const value = parseNum(raw ?? "");
    if (value === null) {
      missing.push(spec.label);
      dimensions.push({
        key,
        label: spec.label,
        value: null,
        targetLabel: `${spec.min}–${spec.max} (ideal ${spec.ideal})`,
        score: 0,
        note: "Missing — enter from report to score",
        group: "proportion",
      });
      continue;
    }
    const score = scoreDimension(value, spec);
    proportionSum += score * spec.weight;
    proportionWeight += spec.weight;
    let note = "Within calibration band";
    if (value < spec.min) note = "Below reference band";
    else if (value > spec.max) note = "Above reference band";
    dimensions.push({
      key,
      label: spec.label,
      value,
      targetLabel: `${spec.min}–${spec.max} (ideal ${spec.ideal})`,
      score,
      note,
      group: "proportion",
    });
  }

  const finishWeightEach = 1;
  for (const key of FINISH_KEYS) {
    const raw = fields[key] ?? "";
    const dim = scoreFinishField(key, raw);
    dimensions.push(dim);
    if (!raw.trim()) {
      missing.push(dim.label);
      continue;
    }
    if (dim.score > 0) {
      finishSum += dim.score * finishWeightEach;
      finishWeight += finishWeightEach;
    }
  }

  const proportionOverall =
    proportionWeight > 0 ? proportionSum / proportionWeight : 0;
  const finishOverall = finishWeight > 0 ? finishSum / finishWeight : 0;

  const hasProportion = proportionWeight > 0;
  const hasFinish = finishWeight > 0;

  let overall = 0;
  if (hasProportion && hasFinish) {
    overall = Math.round(
      proportionOverall * PROPORTION_GROUP_WEIGHT +
        finishOverall * FINISH_GROUP_WEIGHT,
    );
  } else if (hasProportion) {
    overall = Math.round(proportionOverall);
  } else if (hasFinish) {
    overall = Math.round(finishOverall);
  }

  const band = bandFromOverall(overall);

  let summary = `Lab-neutral calibration score ${overall}/100 (${band}).`;
  if (missing.length > 0) {
    summary += ` Incomplete: ${missing.join(", ")}.`;
  }

  return {
    overall,
    band,
    dimensions,
    summary,
    disclaimers: DISCLAIMERS,
    eligible: true,
    weightingNote: WEIGHTING_NOTE,
  };
}
