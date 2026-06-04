import type {
  CalibrationReportFields,
  CalibrationReportMetadata,
} from "@/lib/calibration-library/types";
import { spreadProfileValue } from "./client-balance-profile";
import type { ClientInterpretationScore } from "./client-score-present";
import type { DiamondInterpretationContext } from "./client-interpretation-context";
import {
  claritySeverity,
  fluorescenceConcern,
  parseReportGradeHints,
  type ReportGradeHints,
} from "./report-grade-hints";
import {
  applyRecommendationCeilings,
  deriveBaseRecommendation,
  mergeRiskBand,
} from "./decision-profile-recommendation";
import { buildDecisionConfidence } from "./decision-profile-confidence";
import { derivePrimaryLimitingFactor } from "./primary-limiting-factor";
import type { ClientSafeReportCapability } from "./client-api";

export type OpticalPerformanceBand =
  | "Strong"
  | "Solid"
  | "Moderate"
  | "Mixed"
  | "Preliminary"
  | "Unavailable";

export type VisualPresenceBand =
  | "Generous face-up"
  | "Balanced presence"
  | "Compact depth"
  | "Spread-forward"
  | "Preliminary";

export type RiskProfileBand = "Low" | "Moderate" | "Elevated" | "High";

export type OverallRecommendationBand =
  | "Strong Candidate"
  | "Worth Reviewing"
  | "Compare Carefully"
  | "Not Recommended"
  | "Worth Reviewing After Additional Information"
  | "Needs More Information";

export type ProportionArchetype =
  | "tolkowsky-balanced"
  | "spread-oriented"
  | "fire-forward"
  | "compact-deep"
  | "shallow-spread"
  | "non-canonical-mix"
  | "incomplete-proportions";

export type DecisionDimension = {
  label: string;
  band: string;
  score?: number | null;
  explanation: string;
};

export type DiamondDecisionProfile = {
  opticalPerformance: DecisionDimension;
  visualPresence: DecisionDimension;
  confidence: DecisionDimension;
  riskProfile: DecisionDimension;
  overallRecommendation: DecisionDimension;
  primaryLimitingFactor: {
    display: string;
    key: import("./primary-limiting-factor").PrimaryLimitingFactorKey;
  };
  archetype: ProportionArchetype;
  gradeHints: ReportGradeHints;
};

function num(s: string): number | null {
  const n = parseFloat(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function avgDiameterMm(measurements: string): number | null {
  const m = measurements.match(
    /(\d+\.\d{2})\s*[-–—]\s*(\d+\.\d{2})\s*x\s*(\d+\.\d{2})/i,
  );
  if (!m) return null;
  return (parseFloat(m[1]!) + parseFloat(m[2]!)) / 2;
}

export function classifyProportionArchetype(
  fields: CalibrationReportFields,
): ProportionArchetype {
  const table = num(fields.tablePercent);
  const depth = num(fields.depthPercent);
  const crown = num(fields.crownAngle);
  const pavilion = num(fields.pavilionAngle);

  if (
    table === null ||
    depth === null ||
    crown === null ||
    pavilion === null
  ) {
    return "incomplete-proportions";
  }

  if (table >= 62 && depth <= 60) return "spread-oriented";
  if (crown >= 35.5 && pavilion >= 41 && depth >= 61) return "fire-forward";
  if (table >= 58 && depth <= 59.5) return "shallow-spread";
  if (depth >= 62.5 && table <= 57) return "compact-deep";
  if (
    table >= 55 &&
    table <= 59 &&
    depth >= 60 &&
    depth <= 62 &&
    crown >= 33 &&
    crown <= 35.5 &&
    pavilion >= 40.2 &&
    pavilion <= 41.2
  ) {
    return "tolkowsky-balanced";
  }
  return "non-canonical-mix";
}

function opticalBandFromScore(score: number | null, eligible: boolean): OpticalPerformanceBand {
  if (!eligible || score === null) return "Unavailable";
  if (score >= 90) return "Strong";
  if (score >= 82) return "Solid";
  if (score >= 74) return "Moderate";
  if (score >= 65) return "Mixed";
  return "Mixed";
}

function opticalExplanation(
  band: OpticalPerformanceBand,
  archetype: ProportionArchetype,
  ctx: DiamondInterpretationContext,
): string {
  if (band === "Unavailable" || ctx.readState === "orientation") {
    return "Core proportion detail is not available yet, so an optical architecture read cannot be stated with confidence.";
  }
  if (band === "Preliminary" || ctx.readState === "partial") {
    return "Some proportion detail is visible, but the light-performance read stays preliminary until the diagram fields are complete.";
  }

  switch (archetype) {
    case "spread-oriented":
      return "The proportions read spread-forward — a wider table and shallower depth may favor face-up size over the tightest fire architecture.";
    case "fire-forward":
      return "Crown and pavilion angles read steeper — this often favors fire and contrast over the broadest brightness spread.";
    case "compact-deep":
      return "Depth reads on the fuller side for the spread — light may travel differently than a shallow, spread-oriented cut.";
    case "shallow-spread":
      return "A shallower total depth with a relatively open table can look lively in size, with brightness tradeoffs worth comparing in person.";
    case "tolkowsky-balanced":
      if (band === "Strong" || band === "Solid") {
        return "Proportions sit in a tight, balanced band on paper — the architecture supports a confident everyday light read when other grades cooperate.";
      }
      return "Proportions are in a mainstream balanced zone — capable in person, with a few proportion choices worth understanding rather than alarming.";
    default:
      return "The proportion mix is workable but not textbook — compare how brightness, fire, and contrast feel relative to other options you like.";
  }
}

function visualPresenceBand(
  fields: CalibrationReportFields,
  archetype: ProportionArchetype,
): { band: VisualPresenceBand; score: number | null } {
  const carat = num(fields.carat);
  const depth = num(fields.depthPercent);
  const table = num(fields.tablePercent);
  const dia = avgDiameterMm(fields.measurements);
  const spread = spreadProfileValue({
    avgDiameterMm: dia,
    carat: fields.carat,
  });

  if (archetype === "incomplete-proportions" || !fields.measurements.trim()) {
    return { band: "Preliminary", score: null };
  }

  if (archetype === "spread-oriented" || archetype === "shallow-spread") {
    return { band: "Spread-forward", score: spread.value };
  }
  if (archetype === "compact-deep" || (depth !== null && depth >= 63)) {
    return { band: "Compact depth", score: spread.value };
  }
  if (spread.value !== null && spread.value >= 78) {
    return { band: "Generous face-up", score: spread.value };
  }
  if (table !== null && table >= 60 && depth !== null && depth <= 60) {
    return { band: "Spread-forward", score: spread.value };
  }
  return { band: "Balanced presence", score: spread.value };
}

function visualExplanation(
  band: VisualPresenceBand,
  archetype: ProportionArchetype,
): string {
  switch (band) {
    case "Preliminary":
      return "Measurements are incomplete, so face-up presence relative to carat cannot be described reliably yet.";
    case "Generous face-up":
      return "For its weight, this stone is likely to face up generously on the hand — a practical plus when size impression matters.";
    case "Spread-forward":
      return "The spread profile suggests the diamond may carry its carat weight well in diameter — compare against deeper stones at the same weight.";
    case "Compact depth":
      return "The stone may read slightly smaller face-up while carrying weight in depth — worth comparing beside a spreadier option.";
    case "Balanced presence":
      if (archetype === "tolkowsky-balanced") {
        return "Face-up size should look appropriate for the carat — neither unusually spread nor unusually small on paper.";
      }
      return "Visual presence looks mainstream for the weight — confirm side-by-side if size impression is a deciding factor.";
  }
}

function computeRiskPoints(input: {
  fields: CalibrationReportFields;
  hints: ReportGradeHints;
  capability: ClientSafeReportCapability;
  ctx: DiamondInterpretationContext;
}): number {
  let points = 0;
  points += claritySeverity(input.hints.clarity);
  points += fluorescenceConcern(input.fields.fluorescence);
  if (input.hints.fancyColor || input.hints.coloredDiamondReport) {
    points += 4;
  }
  if (input.capability.needsExpertDiagramReview) points += 1;
  const finish = [input.fields.polish, input.fields.symmetry, input.fields.cutGrade]
    .join(" ")
    .toLowerCase();
  if (finish.includes("fair")) points += 3;
  else if (finish.includes("good")) points += 2;
  return points;
}

function riskBand(points: number): RiskProfileBand {
  if (points >= 8) return "High";
  if (points >= 6) return "Elevated";
  if (points >= 4) return "Moderate";
  return "Low";
}

function riskExplanation(
  band: RiskProfileBand,
  hints: ReportGradeHints,
  ctx: DiamondInterpretationContext,
): string {
  const clarity = hints.clarity;
  if (band === "High" && clarity && /^I[123]$/.test(clarity)) {
    return `Clarity grade ${clarity} introduces meaningful inclusions risk — optical proportions alone do not offset that for a confident recommendation.`;
  }
  if (band === "High") {
    return "Several buyer-relevant concerns stack together — clarity, fluorescence, or finish deserve close review before you rely on this read.";
  }
  if (band === "Elevated") {
    if (clarity && /^I[12]$/.test(clarity)) {
      return `Clarity grade ${clarity} keeps buyer risk elevated — proportions alone should not drive a confident recommendation.`;
    }
    if (hints.fancyColor) {
      return "Fancy-color reports follow different buying rules than white round brilliants — treat optical reads as context, not a full colored-stone verdict.";
    }
    return "One or more factors — clarity, fluorescence, or finish — warrant a closer look even if proportions look acceptable on paper.";
  }
  if (band === "Moderate") {
    if (clarity === "SI2" || clarity === "SI1") {
      return "Clarity sits in a range where eye-clean appearance and in-person viewing matter as much as the proportion read.";
    }
    if (hints.fancyColor) {
      return "Fancy-color reports follow different buying rules than white round brilliants — treat optical reads as context, not a full colored-stone verdict.";
    }
    return "No single red flag dominates, but routine verification (clarity eye-clean, fluorescence in your lighting) still makes sense.";
  }
  if (hints.fancyColor) {
    return "Fancy-color context applies — white-diamond proportion logic is only a partial guide here.";
  }
  return "On paper, clarity and report completeness look manageable relative to the optical read — still confirm in person before you commit.";
}

function overallRecommendationBand(input: {
  optical: OpticalPerformanceBand;
  visual: VisualPresenceBand;
  risk: RiskProfileBand;
  ctx: DiamondInterpretationContext;
  hints: ReportGradeHints;
  confidenceBand: import("./decision-profile-confidence").DecisionConfidenceBand;
}): OverallRecommendationBand {
  const base = deriveBaseRecommendation(input);
  return applyRecommendationCeilings(base, {
    risk: input.risk,
    ctx: input.ctx,
    hints: input.hints,
    confidenceBand: input.confidenceBand,
  });
}

function recommendationExplanation(
  band: OverallRecommendationBand,
  optical: OpticalPerformanceBand,
  risk: RiskProfileBand,
  archetype: ProportionArchetype,
  hints: ReportGradeHints,
  limitingDisplay: string,
): string {
  switch (band) {
    case "Strong Candidate":
      return "Strong optical architecture on paper, manageable risk flags, and complete report data — a practical strong candidate worth comparing in person.";
    case "Compare Carefully":
      if (limitingDisplay === "Clarity") {
        return `Primary limitation: ${limitingDisplay}. Proportions may be workable, but clarity is the deciding factor — compare carefully and prioritize eye-clean appearance.`;
      }
      if (limitingDisplay === "Color") {
        return `Primary limitation: ${limitingDisplay}. Architecture may be strong, but body color is the tradeoff worth weighing against other options.`;
      }
      if (limitingDisplay === "Strong Fluorescence") {
        return `Primary limitation: ${limitingDisplay}. Review the stone in lighting similar to where you will wear it before you commit.`;
      }
      if (hints.clarity === "I2") {
        return "Solid proportions on paper, but clarity I2 is the deciding factor — compare carefully and prioritize eye-clean appearance over the optical read.";
      }
      if (hints.clarity === "I1") {
        return "Proportions may be workable, but clarity grade I1 keeps this in compare-carefully territory — eye-clean appearance matters more than the optical number alone.";
      }
      if (archetype === "spread-oriented") {
        return "Spread and presence may impress, but proportion tradeoffs and supporting grades deserve a side-by-side look before you commit.";
      }
      return "Mixed signals on paper — strong in one dimension should not automatically mean a strong overall buy without closer review.";
    case "Worth Reviewing":
      if (limitingDisplay === "Clarity" && hints.clarity === "SI2") {
        return `Primary limitation: ${limitingDisplay}. Strong architecture on paper, but SI2 clarity is the tradeoff — worth reviewing for eye-clean appearance before you treat it as a strong buy.`;
      }
      if (limitingDisplay === "Color") {
        return `Primary limitation: ${limitingDisplay}. Worth a side-by-side look against higher-color options at similar architecture.`;
      }
      if (optical === "Preliminary" || optical === "Unavailable") {
        return "Worth a careful review once proportion detail is confirmed — not a final yes/no from today's read alone.";
      }
      return "Promising in some dimensions but not a clean overall yes — Justin can help weigh proportions against clarity and how you want it to look.";
    case "Not Recommended":
      if (hints.clarity && /^I[23]$/.test(hints.clarity)) {
        return `Clarity ${hints.clarity} is the dominant concern — even decent proportions do not make this a confident overall recommendation without a very specific price and appearance trade you accept.`;
      }
      return "Risk factors outweigh the optical read for a confident recommendation — treat as a compare-or-pass unless price and in-person viewing change the story.";
    case "Worth Reviewing After Additional Information":
      return "The architectural read is preliminary — worth revisiting once proportion detail is confirmed, not a pass/fail verdict today.";
    case "Needs More Information":
      return "More report detail is needed before a fair overall recommendation — upload a clearer diagram or review with an expert.";
  }
}

export function buildDiamondDecisionProfile(input: {
  fields: CalibrationReportFields;
  metadata: Pick<CalibrationReportMetadata, "stoneType" | "lab">;
  capability: ClientSafeReportCapability;
  context: DiamondInterpretationContext;
  clientScore: ClientInterpretationScore | null;
  displayScore: number | null;
  gradeHints?: ReportGradeHints;
  reportTextHint?: string;
}): DiamondDecisionProfile {
  const hints =
    input.gradeHints ??
    (input.reportTextHint
      ? parseReportGradeHints(input.reportTextHint)
      : {});

  const archetype = classifyProportionArchetype(input.fields);
  const opticalScore =
    input.displayScore ??
    (input.clientScore?.eligible ? input.clientScore.overall : null);
  const opticalEligible =
    input.context.scoreEligible && input.context.canShowScore;
  const opticalBand =
    input.context.readState === "orientation" || !opticalEligible
      ? input.context.readState === "partial"
        ? "Preliminary"
        : "Unavailable"
      : input.context.readState === "partial"
        ? "Preliminary"
        : opticalBandFromScore(opticalScore, true);

  const visual = visualPresenceBand(input.fields, archetype);
  const riskPoints = computeRiskPoints({
    fields: input.fields,
    hints,
    capability: input.capability,
    ctx: input.context,
  });
  const risk = mergeRiskBand(riskBand(riskPoints), hints);
  const confidence = buildDecisionConfidence({
    context: input.context,
    capability: input.capability,
  });
  const recommendation = overallRecommendationBand({
    optical: opticalBand,
    visual: visual.band,
    risk,
    ctx: input.context,
    hints,
    confidenceBand: confidence.band,
  });
  const primaryLimitingFactor = derivePrimaryLimitingFactor({
    hints,
    fields: input.fields,
    context: input.context,
    confidenceBand: confidence.band,
    risk,
    recommendation,
    archetype,
  });

  return {
    archetype,
    gradeHints: hints,
    opticalPerformance: {
      label: "Optical Performance",
      band: opticalBand,
      score: opticalEligible ? opticalScore : null,
      explanation: opticalExplanation(opticalBand, archetype, input.context),
    },
    visualPresence: {
      label: "Visual Presence",
      band: visual.band,
      score: visual.score,
      explanation: visualExplanation(visual.band, archetype),
    },
    confidence: {
      label: confidence.label,
      band: confidence.band,
      explanation: confidence.explanation,
    },
    riskProfile: {
      label: "Risk Profile",
      band: risk,
      explanation: riskExplanation(risk, hints, input.context),
    },
    overallRecommendation: {
      label: "Overall Recommendation",
      band: recommendation,
      explanation: recommendationExplanation(
        recommendation,
        opticalBand,
        risk,
        archetype,
        hints,
        primaryLimitingFactor.display,
      ),
    },
    primaryLimitingFactor,
  };
}
