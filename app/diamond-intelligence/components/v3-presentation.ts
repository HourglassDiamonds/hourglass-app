import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import type { ClientLightTrait } from "@/lib/diamond-intelligence/client-score-present";
import type { EditorialLightPerformanceTier } from "@/lib/diamond-intelligence/client-editorial-language";
import type { ClientReportFormat, ClientSafeMetadata } from "@/lib/diamond-intelligence/client-api";
import {
  debugGcal8xDisplay,
  isGcal8xDisplayFramework,
  looksLikeGcal8xDisplayText,
} from "@/lib/diamond-intelligence/gcal-8x-display";
import {
  isPurchaseRecommendationEligibleForBroadPercentile,
  type PurchaseRecommendationLabel,
  buildPurchaseConstrainedOpticalDetail,
} from "@/lib/diamond-intelligence/purchase-recommendation-presentation";
import {
  type V3IncompleteAssessmentCopy,
  CONSUMER_COPY,
  V3_INCOMPLETE_GRADE_ASSESSMENT,
  V3_INCOMPLETE_PROPORTION_ASSESSMENT,
} from "./consumer-display-labels";
import {
  resolveHourglassClarityPolicy,
  SI2_PRESENTATION_TIER_CEILING,
} from "@/lib/diamond-intelligence/hourglass-clarity-policy";
import type { DecisionConfidenceBand } from "@/lib/diamond-intelligence/decision-profile-confidence";
export type V3PublicTier =
  | "Rare"
  | "Exceptional"
  | "Distinctive"
  | "Strong"
  | "Balanced"
  | "Open";

export type V3Gcal8xTier = "Rare" | "Exceptional";

export type V3PercentileScope = "broad" | "optical";

export type V3PercentilePresentation = {
  topLine: string;
  topSubline: string;
  betterThanPercent?: number;
  scope: V3PercentileScope;
};

export type V3HeroPresentation = {
  purchaseHeadline: string;
  purchaseSubline: string | null;
  opticalPerformanceLine: string | null;
  opticalDetailLine: string | null;
  percentile: V3PercentilePresentation | null;
};

const STANDARD_TIER_LADDER: V3PublicTier[] = [
  "Rare",
  "Exceptional",
  "Distinctive",
  "Strong",
  "Balanced",
  "Open",
];

export const V3_TIER_DESCRIPTIONS: Record<
  V3PublicTier,
  { range: string; description: string }
> = {
  Rare: {
    range: "Top 1–3%",
    description:
      "Top-performing report read with very little meaningful compromise.",
  },
  Exceptional: {
    range: "Top 4–8%",
    description:
      "Highly desirable read with strong brightness, fire potential, balance, and limited report-level risk.",
  },
  Distinctive: {
    range: "Top 9–15%",
    description:
      "Better than most diamonds reviewed; favorable proportions and strong light-return indicators.",
  },
  Strong: {
    range: "Top 16–30%",
    description:
      "Good candidate with several favorable indicators, but more visible tradeoffs.",
  },
  Balanced: {
    range: "Middle Range",
    description:
      "Serviceable read with a more ordinary performance profile.",
  },
  Open: {
    range: "Needs Review",
    description:
      "Needs human review or has enough compromise that the report alone should not drive the decision.",
  },
};

export { debugGcal8xDisplay, looksLikeGcal8xDisplayText } from "@/lib/diamond-intelligence/gcal-8x-display";

/** Display-only GCAL 8X framework gate — does not affect scoring or extraction. */
export function isGcal8xReport(
  metadata?: ClientSafeMetadata | null,
  fields?: CalibrationReportFields | null,
): boolean {
  if (!metadata) return false;

  return isGcal8xDisplayFramework({
    lab: metadata.lab,
    reportFormat: metadata.reportFormat,
    parserFamily: metadata.parserFamily,
    reportTextHint: metadata.reportTextHint,
    fields,
  });
}

/** @deprecated Use isGcal8xReport(metadata) */
export function isGcal8xPresentation(reportFormat?: ClientReportFormat): boolean {
  if (!reportFormat) return false;
  return isGcal8xDisplayFramework({
    lab: "GCAL",
    reportFormat,
  });
}

/** Map editorial / score read to V3 public tier — display only. */
export function scoreToV3PublicTier(
  displayScore: number | null,
  editorialTier: EditorialLightPerformanceTier,
  canShowScore: boolean,
): V3PublicTier {
  if (!canShowScore || editorialTier === "Open") return "Open";

  if (displayScore !== null) {
    if (displayScore >= 97) return "Rare";
    if (displayScore >= 92) return "Exceptional";
    if (displayScore >= 85) return "Distinctive";
    if (displayScore >= 70) return "Strong";
    if (displayScore >= 50) return "Balanced";
    return "Open";
  }

  switch (editorialTier) {
    case "Distinctive":
      return "Distinctive";
    case "Strong":
      return "Strong";
    case "Balanced":
      return "Balanced";
    case "Nuanced":
      return "Balanced";
    default:
      return "Open";
  }
}

const TIER_RANK: Record<V3PublicTier, number> = {
  Rare: 0,
  Exceptional: 1,
  Distinctive: 2,
  Strong: 3,
  Balanced: 4,
  Open: 5,
};

/** Presentation-only — cap premium tier labels (e.g. SI2 ceiling). */
export function capV3PublicTier(
  tier: V3PublicTier,
  ceiling: V3PublicTier,
): V3PublicTier {
  return TIER_RANK[tier] < TIER_RANK[ceiling] ? ceiling : tier;
}

export function resolveV3PublicTier(input: {
  editorialTier: EditorialLightPerformanceTier;
  displayScore: number | null;
  canShowScore: boolean;
  clarity?: string;
}): V3PublicTier {
  const policy = resolveHourglassClarityPolicy(input.clarity);
  if (policy.isExcluded) return "Open";

  let tier = scoreToV3PublicTier(
    input.displayScore,
    input.editorialTier,
    input.canShowScore,
  );

  if (policy.suppressPremiumTierLabels) {
    tier = capV3PublicTier(tier, SI2_PRESENTATION_TIER_CEILING);
  }

  return tier;
}

export function standardTierLadder(): V3PublicTier[] {
  return STANDARD_TIER_LADDER;
}

/** GCAL 8X visual tier — presentation remap only. SI2 and below excluded clarity cap separately. */
export function resolveGcal8xVisualTier(
  displayScore: number | null,
  clarity?: string,
): V3Gcal8xTier | null {
  if (resolveHourglassClarityPolicy(clarity).suppressPremiumTierLabels) {
    return null;
  }
  if (displayScore !== null && displayScore >= 94) return "Rare";
  return "Exceptional";
}

export function buildV3PercentilePresentation(
  displayScore: number | null,
  input?: {
    clarity?: string;
    color?: string;
    purchaseLabel?: PurchaseRecommendationLabel;
  },
): V3PercentilePresentation | null {
  const clarity = input?.clarity;
  const policy = resolveHourglassClarityPolicy(clarity);
  if (policy.suppressFavorablePercentile) return null;

  if (displayScore === null || !Number.isFinite(displayScore)) return null;

  const topPercent = Math.min(99, Math.max(1, Math.round(100 - displayScore)));
  const betterThan = Math.min(99, Math.max(1, Math.round(displayScore)));

  const broadEligible =
    input?.purchaseLabel &&
    isPurchaseRecommendationEligibleForBroadPercentile({
      purchaseLabel: input.purchaseLabel,
      clarityPolicy: policy,
      color: input?.color,
    });

  if (broadEligible) {
    return {
      topLine: `Top ${topPercent}%`,
      topSubline: "of diamonds we typically evaluate",
      betterThanPercent: betterThan,
      scope: "broad",
    };
  }

  return {
    topLine: `Top ${topPercent}%`,
    topSubline: "for reported optical proportions",
    scope: "optical",
  };
}

function displayTierLabel(tier: V3PublicTier): string {
  return tier === "Open" ? "Needs Review" : tier;
}

/** Display-only editorial subline beneath the purchase headline — outcomes unchanged. */
function buildV3HeroPurchaseSubline(
  label: PurchaseRecommendationLabel,
): string | null {
  switch (label) {
    case "Recommended":
      return "An encouraging read on paper — worth pursuing if it holds up in person.";
    case "Strong Candidate":
      return "A credible candidate on paper — confirm how it looks and feels before committing.";
    case "Justin Inspection Required":
      return "Justin's review is the right next step — advisory, not an automatic pass or fail.";
    case "Outside Hourglass Standards":
      return "Not Recommended";
    case "Not Recommended":
      return "Outside what Hourglass would normally put forward — a firm pass on this read.";
    case "Worth Reviewing After Additional Information":
      return "A useful starting point — confirm what remains before treating this as final.";
    default:
      return null;
  }
}

export function resolveUncappedOpticalTier(input: {
  editorialTier: EditorialLightPerformanceTier;
  displayScore: number | null;
  canShowScore: boolean;
}): V3PublicTier {
  return scoreToV3PublicTier(
    input.displayScore,
    input.editorialTier,
    input.canShowScore,
  );
}

export function buildV3HeroPresentation(input: {
  purchaseRecommendation: PurchaseRecommendationLabel;
  publicTier: V3PublicTier;
  uncappedOpticalTier: V3PublicTier;
  displayScore: number | null;
  clarityPolicy: ReturnType<typeof resolveHourglassClarityPolicy>;
  color?: string;
  clarity?: string;
  canShowScore: boolean;
  lowInterpretationConfidence: boolean;
  opticalUnavailable: boolean;
  isGcal8x: boolean;
  gcal8xTier: V3Gcal8xTier | null;
  confidenceBand?: DecisionConfidenceBand;
}): V3HeroPresentation {
  if (input.clarityPolicy.isExcluded) {
    return {
      purchaseHeadline: "Outside Hourglass Standards",
      purchaseSubline: "Not Recommended",
      opticalPerformanceLine: null,
      opticalDetailLine:
        "This clarity grade falls outside Hourglass standards — a firm pass, regardless of how the proportions read.",
      percentile: null,
    };
  }

  const gradeConstrainedPurchase =
    input.clarityPolicy.isExcluded ||
    input.clarityPolicy.isSi2 ||
    input.purchaseRecommendation === "Justin Inspection Required" ||
    input.purchaseRecommendation === "Outside Hourglass Standards" ||
    input.purchaseRecommendation === "Not Recommended";

  if (input.lowInterpretationConfidence && !gradeConstrainedPurchase) {
    const incomplete = resolveV3IncompleteAssessmentCopy(
      {
        color: input.color,
        clarity: input.clarity,
      },
      { confidenceBand: input.confidenceBand },
    );
    return {
      purchaseHeadline: incomplete.headline,
      purchaseSubline: incomplete.subhead,
      opticalPerformanceLine: null,
      opticalDetailLine: null,
      percentile: null,
    };
  }

  if (input.isGcal8x && input.gcal8xTier) {
    return {
      purchaseHeadline: input.gcal8xTier,
      purchaseSubline: null,
      opticalPerformanceLine: null,
      opticalDetailLine: null,
      percentile: null,
    };
  }

  const opticalTierLabel = displayTierLabel(input.uncappedOpticalTier);
  const opticalPerformanceLine = input.canShowScore
    ? `Performance read: ${opticalTierLabel}`
    : null;

  const opticalDetailLine = buildPurchaseConstrainedOpticalDetail({
    purchaseLabel: input.purchaseRecommendation,
    clarityPolicy: input.clarityPolicy,
    color: input.color,
    clarity: input.clarity,
    displayScore: input.displayScore,
    uncappedOpticalTierLabel: opticalTierLabel,
  });

  const percentile = input.canShowScore
    ? buildV3PercentilePresentation(input.displayScore, {
        clarity: input.clarity,
        color: input.color,
        purchaseLabel: input.purchaseRecommendation,
      })
    : null;

  return {
    purchaseHeadline: input.purchaseRecommendation,
    purchaseSubline: buildV3HeroPurchaseSubline(input.purchaseRecommendation),
    opticalPerformanceLine,
    opticalDetailLine,
    percentile:
      percentile?.scope === "broad" ? percentile : null,
  };
}

export function resolveV3HeroVerdictLabel(input: {
  color?: string;
  clarity?: string;
  lowInterpretationConfidence: boolean;
  opticalUnavailable: boolean;
  isGcal8x: boolean;
  gcal8xTier: V3Gcal8xTier | null;
  publicTier: V3PublicTier;
  confidenceBand?: DecisionConfidenceBand;
}): string {
  const policy = resolveHourglassClarityPolicy(input.clarity);
  if (policy.heroVerdictLabel) return policy.heroVerdictLabel;

  if (input.lowInterpretationConfidence) {
    return input.opticalUnavailable
      ? "Limited Information Available"
      : resolveV3IncompleteAssessmentCopy(
          {
            color: input.color,
            clarity: input.clarity,
          },
          { confidenceBand: input.confidenceBand },
        ).headline;
  }

  if (input.isGcal8x && input.gcal8xTier) return input.gcal8xTier;
  return input.publicTier === "Open" ? "Needs Review" : input.publicTier;
}

function traitWord(trait: ClientLightTrait): string | null {
  if (trait.level === "Needs review" || trait.fillPercent <= 0) return null;
  const label = trait.label.toLowerCase();
  if (label.includes("brightness")) return "Bright";
  if (label.includes("fire")) return trait.level === "Strong" ? "Lively Fire" : "Balanced Fire";
  if (label.includes("contrast")) return trait.level === "Strong" ? "Crisp Contrast" : "Balanced";
  if (label.includes("scintillation")) return "Lively Sparkle";
  if (label.includes("leakage")) return "Strong Light Return";
  return trait.level === "Strong" ? trait.label : "Balanced";
}

export function buildV3TraitLine(
  traits: ClientLightTrait[],
  isGcal8x: boolean,
  clarity?: string,
): string {
  if (resolveHourglassClarityPolicy(clarity).isExcluded) {
    return "Outside Hourglass Standards · Not Recommended";
  }

  if (isGcal8x) {
    return "Bright · Precise · Performance-Verified";
  }

  const words: string[] = [];
  const brightness = traits.find((t) => t.label === "Brightness");
  const contrast = traits.find((t) => t.label === "Contrast");
  const leakage = traits.find((t) => t.label === "Leakage control");

  if (brightness && brightness.level !== "Needs review") words.push("Bright");
  if (contrast && contrast.level === "Balanced") words.push("Balanced");
  else if (contrast && contrast.level === "Strong") words.push("Crisp");
  if (leakage && leakage.level === "Strong") words.push("Strong Light Return");
  else if (words.length < 3) {
    for (const trait of traits) {
      const w = traitWord(trait);
      if (w && !words.includes(w)) words.push(w);
      if (words.length >= 3) break;
    }
  }

  if (words.length === 0) return "Balanced · Steady · Exceptionally Balanced";
  return words.slice(0, 3).join(" · ");
}

type FinishGradeClass = "missing" | "excellent" | "below";

function classifyFinishGrade(raw: string | undefined | null): FinishGradeClass {
  const value = raw?.trim();
  if (!value || PLACEHOLDER_GRADE.test(value)) return "missing";

  const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();

  if (
    normalized === "excellent" ||
    normalized === "ex" ||
    normalized === "exc" ||
    normalized.startsWith("excellent")
  ) {
    return "excellent";
  }

  if (
    normalized.includes("very good") ||
    normalized === "vg" ||
    normalized === "good" ||
    normalized === "g" ||
    normalized === "fair" ||
    normalized === "f" ||
    normalized === "poor" ||
    normalized === "p"
  ) {
    return "below";
  }

  return "missing";
}

/** True when cut, polish, or symmetry is present on the report and below Excellent. */
export function shouldShowHourglassPerspective(
  fields: Pick<CalibrationReportFields, "cutGrade" | "polish" | "symmetry">,
): boolean {
  for (const raw of [fields.cutGrade, fields.polish, fields.symmetry]) {
    if (classifyFinishGrade(raw) === "below") return true;
  }
  return false;
}

export const HOURGLASS_PERSPECTIVE_COPY = [
  "The industry often considers a broad range of cut grades acceptable. Our standards are intentionally narrower.",
  "For round diamonds, we generally begin with Excellent cut, polish, and symmetry because craftsmanship has the greatest influence on how a diamond handles light. The goal is simple: maximize brightness, fire, and sparkle whenever possible.",
  "This does not mean a Very Good diamond cannot be attractive. It simply reflects the standards we use when sourcing diamonds for our own clients and the level of performance we aim to deliver whenever possible.",
] as const;

const PLACEHOLDER_GRADE =
  /^(?:unknown|not\s*available|unverified|select|n\/a|na|none|null|undefined|—|-+|\.+)$/i;

const CLARITY_GRADE_RE =
  /^(?:FL|IF|VVS1|VVS2|VS1|VS2|SI1|SI2|I1|I2|I3)$/i;

/** D–Z single-letter grades for V3 partial review UI. */
export const PARTIAL_COLOR_SINGLE_GRADES = [
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
] as const;

/** Common GIA-style adjacent color ranges (K–L through Y–Z). */
export const PARTIAL_COLOR_RANGE_GRADES = [
  "K to L Range",
  "L to M Range",
  "M to N Range",
  "N to O Range",
  "O to P Range",
  "P to Q Range",
  "Q to R Range",
  "R to S Range",
  "S to T Range",
  "T to U Range",
  "U to V Range",
  "V to W Range",
  "W to X Range",
  "X to Y Range",
  "Y to Z Range",
] as const;

/** Clarity grades for V3 partial review UI. */
export const PARTIAL_CLARITY_GRADES = [
  "FL",
  "IF",
  "VVS1",
  "VVS2",
  "VS1",
  "VS2",
  "SI1",
  "SI2",
  "I1",
  "I2",
  "I3",
] as const;

/**
 * Partial-review color dropdown — includes D–Z, common ranges, and any
 * extracted value already present on the report.
 */
export function partialColorSelectOptions(existingColor?: string | null): string[] {
  const options: string[] = [
    ...PARTIAL_COLOR_SINGLE_GRADES,
    ...PARTIAL_COLOR_RANGE_GRADES,
  ];
  const existing = existingColor?.trim();
  if (
    existing &&
    hasUsableDisplayColor(existing) &&
    !options.some((o) => o.toLowerCase() === existing.toLowerCase())
  ) {
    return [existing, ...options];
  }
  return options;
}

export function isListedPartialColor(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return (
    PARTIAL_COLOR_SINGLE_GRADES.some((c) => c.toLowerCase() === lower) ||
    PARTIAL_COLOR_RANGE_GRADES.some((c) => c.toLowerCase() === lower)
  );
}

/** Display-only — accepts single grades, ranges, and common report phrasing. */
export function hasUsableDisplayColor(value?: string | null): boolean {
  const raw = value?.trim();
  if (!raw || PLACEHOLDER_GRADE.test(raw)) return false;

  const upper = raw.toUpperCase();
  if (/[D-Z]/.test(upper)) return true;
  if (/FANCY|COLORED|COLOUR|COLOR|PINK|BLUE|YELLOW|BROWN|CHAMPAGNE/.test(upper)) {
    return true;
  }

  return raw.length >= 1 && raw.length <= 32;
}

/** Display-only — accepts normalized and lightly formatted clarity tokens. */
export function hasUsableDisplayClarity(value?: string | null): boolean {
  const raw = value?.trim();
  if (!raw || PLACEHOLDER_GRADE.test(raw)) return false;

  const compact = raw.replace(/\s+/g, "").toUpperCase().replace(/-/g, "");
  if (CLARITY_GRADE_RE.test(compact)) return true;

  return /\b(?:FL|IF|VVS\s*1|VVS\s*2|VS\s*1|VS\s*2|SI\s*1|SI\s*2|I\s*1|I\s*2|I\s*3)\b/i.test(
    raw,
  );
}

export type PartialGradeReviewInput = {
  gradeHints?: { color?: string; clarity?: string } | null;
  /** When a full proportion read is already score-eligible, do not block on 4Cs UI. */
  canShowScore?: boolean;
};

export type PartialGradeReviewTrace = {
  needsPartial: boolean;
  reason: string;
  color?: string;
  clarity?: string;
  hasUsableColor: boolean;
  hasUsableClarity: boolean;
  canShowScore: boolean;
};

/** Dev / test — explain why partial grade review would or would not show. */
export function tracePartialGradeReviewGate(
  input: PartialGradeReviewInput,
): PartialGradeReviewTrace {
  const color = input.gradeHints?.color;
  const clarity = input.gradeHints?.clarity;
  const hasUsableColor = hasUsableDisplayColor(color);
  const hasUsableClarity = hasUsableDisplayClarity(clarity);
  const canShowScore = Boolean(input.canShowScore);

  if (hasUsableColor && hasUsableClarity) {
    return {
      needsPartial: false,
      reason: "color and clarity are present and usable",
      color,
      clarity,
      hasUsableColor,
      hasUsableClarity,
      canShowScore,
    };
  }

  if (canShowScore) {
    return {
      needsPartial: false,
      reason: "canShowScore is true — partial gate bypassed",
      color,
      clarity,
      hasUsableColor,
      hasUsableClarity,
      canShowScore,
    };
  }

  if (!hasUsableColor && !hasUsableClarity) {
    return {
      needsPartial: true,
      reason: "missing both usable color and clarity",
      color,
      clarity,
      hasUsableColor,
      hasUsableClarity,
      canShowScore,
    };
  }

  if (!hasUsableColor) {
    return {
      needsPartial: true,
      reason: "missing usable color",
      color,
      clarity,
      hasUsableColor,
      hasUsableClarity,
      canShowScore,
    };
  }

  return {
    needsPartial: true,
    reason: "missing usable clarity",
    color,
    clarity,
    hasUsableColor,
    hasUsableClarity,
    canShowScore,
  };
}

/** V3 orchestrator render gate — exactly one result surface at a time. */
export type V3RenderPhase = "empty" | "partial" | "full";

export function resolveV3RenderPhase(input: {
  hasReport: boolean;
  partialGradeReview: boolean;
  canRenderFullResult: boolean;
}): V3RenderPhase {
  if (!input.hasReport) return "empty";
  if (input.partialGradeReview) return "partial";
  if (input.canRenderFullResult) return "full";
  // Loaded report with no partial gate — never strand the page in marketing empty.
  return "full";
}

/**
 * V3 partial hero gate — display only.
 * Triggers only when color or clarity is truly absent/unusable for presentation,
 * not when ranges (e.g. "O to P Range") or standard clarity grades are present.
 */
export function needsPartialGradeReview(input: PartialGradeReviewInput): boolean {
  return tracePartialGradeReviewGate(input).needsPartial;
}

/**
 * V3 incomplete chapter layout — separate from partial grade review.
 * Grade-disqualified reads (I1/I2/I3) always use the full editorial chapter stack.
 */
export function shouldUseV3IncompleteChapterLayout(input: {
  lowInterpretationConfidence: boolean;
  hasDecisionProfile: boolean;
  clarityExcluded: boolean;
  purchaseRecommendation?: PurchaseRecommendationLabel;
}): boolean {
  if (!input.lowInterpretationConfidence || !input.hasDecisionProfile) return false;
  if (input.clarityExcluded) return false;
  if (
    input.purchaseRecommendation === "Not Recommended" ||
    input.purchaseRecommendation === "Outside Hourglass Standards" ||
    input.purchaseRecommendation === "Justin Inspection Required"
  ) {
    return false;
  }
  return true;
}

/** Missing grade labels for incomplete-assessment technical appendix. */
export function listMissingGradeFields(gradeHints?: {
  color?: string;
  clarity?: string;
} | null): string[] {
  const missing: string[] = [];
  if (!hasUsableDisplayColor(gradeHints?.color)) {
    missing.push("Color Grade");
  }
  if (!hasUsableDisplayClarity(gradeHints?.clarity)) {
    missing.push("Clarity Grade");
  }
  return missing;
}

/** Missing-data row value for incomplete-assessment technical appendix. */
export function resolveV3IncompleteMissingDataValue(gradeHints?: {
  color?: string;
  clarity?: string;
} | null): string {
  return resolveV3IncompleteAssessmentCopy(gradeHints).missingDataValue;
}

export type ResolveV3IncompleteAssessmentOptions = {
  confidenceBand?: DecisionConfidenceBand;
};

function gradeFieldPhrase(label: string): string {
  return label.replace(/ Grade$/, " grade").toLowerCase();
}

function formatGradesConfirmed(gradeHints?: {
  color?: string;
  clarity?: string;
} | null): string | null {
  const color = gradeHints?.color?.trim();
  const clarity = gradeHints?.clarity?.trim();
  if (!hasUsableDisplayColor(color) || !hasUsableDisplayClarity(clarity)) {
    return null;
  }
  return `${color} color · ${clarity} clarity`;
}

function buildGradeIncompleteCopy(missing: string[]): V3IncompleteAssessmentCopy {
  const missingGradeNote = CONSUMER_COPY.trustLayerMissingGradeLimit;
  const softwareLimitNote = CONSUMER_COPY.trustLayerSoftwareReadLimit;
  const manualReviewNote = CONSUMER_COPY.trustLayerManualReviewOffer;

  if (missing.length === 1) {
    const field = missing[0]!;
    return {
      ...V3_INCOMPLETE_GRADE_ASSESSMENT,
      headline: `${field} Still Needed`,
      subhead: `We verified other report details, but ${gradeFieldPhrase(field)} could not be confidently verified from the uploaded file. ${missingGradeNote}`,
      sectionBody: `The missing ${gradeFieldPhrase(field)} can materially affect the recommendation. ${softwareLimitNote} ${manualReviewNote}`,
      chapterNote: `${field} needed before the read can be completed.`,
      missingDataValue: field,
      nextStep: `Confirm ${field}`,
      technicalAppendixNote: `This partial read is waiting on ${gradeFieldPhrase(field)}. Proportions are not the limiting factor here.`,
    };
  }

  const joined = missing.map(gradeFieldPhrase).join(" and ");
  return {
    ...V3_INCOMPLETE_GRADE_ASSESSMENT,
    subhead: `We verified portions of the report, but ${joined} could not be confidently verified from the uploaded file. ${missingGradeNote}`,
    sectionBody: `Missing ${joined} can materially affect the recommendation. ${softwareLimitNote} ${manualReviewNote}`,
    chapterNote: "Grading details needed before the read can be completed.",
    missingDataValue: missing.join(", "),
    technicalAppendixNote:
      "This partial read reflects missing or unverified color and clarity grades — not incomplete proportion detail.",
  };
}

function buildProportionIncompleteCopy(gradeHints?: {
  color?: string;
  clarity?: string;
} | null): V3IncompleteAssessmentCopy {
  const gradesConfirmed = formatGradesConfirmed(gradeHints);
  const color = gradeHints?.color?.trim();
  const clarity = gradeHints?.clarity?.trim();
  const proportionNote = CONSUMER_COPY.trustLayerProportionDetailLimit;
  const softwareLimitNote = CONSUMER_COPY.trustLayerSoftwareReadLimit;
  const manualReviewNote = CONSUMER_COPY.trustLayerManualReviewOffer;

  const subhead = gradesConfirmed
    ? `${color} color and ${clarity} clarity are confirmed on the report. Some proportion measurements could not be confidently verified from the uploaded file. ${proportionNote}`
    : V3_INCOMPLETE_PROPORTION_ASSESSMENT.subhead;

  return {
    ...V3_INCOMPLETE_PROPORTION_ASSESSMENT,
    subhead,
    gradesConfirmed,
    sectionBody: `Diagram proportions can materially affect brightness, balance, and the final recommendation. ${proportionNote} ${softwareLimitNote} ${manualReviewNote}`,
    technicalAppendixNote: gradesConfirmed
      ? `${gradesConfirmed} are confirmed. The outstanding detail is proportion or diagram measurement — not 4Cs.`
      : V3_INCOMPLETE_PROPORTION_ASSESSMENT.technicalAppendixNote,
  };
}

function applyIncompleteConfidenceCopy(
  copy: V3IncompleteAssessmentCopy,
  options?: ResolveV3IncompleteAssessmentOptions,
): V3IncompleteAssessmentCopy {
  const band = options?.confidenceBand;
  if (copy.kind === "grade") {
    if (band === "Low") {
      return {
        ...copy,
        recommendationStatus: "Pending Grades — Limited Data",
        opticalRead: "Preliminary",
        confidenceLevel: "Limited Grading Data",
        technicalAppendixNote: `${copy.technicalAppendixNote} Report confidence is limited until grading detail is confirmed.`,
      };
    }
    if (band === "Moderate") {
      return {
        ...copy,
        recommendationStatus: "Pending Grades — Moderate Confidence",
        opticalRead: "Preliminary",
        confidenceLevel: "Moderate Report Confidence",
      };
    }
    return copy;
  }

  if (band === "Low") {
    return {
      ...copy,
      recommendationStatus: "Partial Read — Proportion Detail Limited",
      opticalRead: "Preliminary",
      confidenceLevel: "Limited Proportion Data",
      technicalAppendixNote: `${copy.technicalAppendixNote} Limited report data affects how far the proportion read can go on its own.`,
    };
  }
  if (band === "Moderate") {
    return {
      ...copy,
      recommendationStatus: "Partial Read — Proportion Detail Pending",
      opticalRead: "Partial",
      confidenceLevel: "Moderate Report Confidence",
    };
  }
  return {
    ...copy,
    recommendationStatus: "Partial Read — Proportion Detail Pending",
    opticalRead: "Partial",
    confidenceLevel: "Partial Proportion Read",
  };
}

export function resolveV3IncompleteAssessmentKind(
  gradeHints?: { color?: string; clarity?: string } | null,
): V3IncompleteAssessmentCopy["kind"] {
  return listMissingGradeFields(gradeHints).length > 0 ? "grade" : "proportion";
}

/**
 * Display-only incomplete-assessment copy — grade-specific when 4Cs are missing,
 * proportion-specific when usable color and clarity are already present.
 */
export function resolveV3IncompleteAssessmentCopy(
  gradeHints?: { color?: string; clarity?: string } | null,
  options?: ResolveV3IncompleteAssessmentOptions,
): V3IncompleteAssessmentCopy {
  const missing = listMissingGradeFields(gradeHints);
  if (missing.length > 0) {
    return applyIncompleteConfidenceCopy(
      buildGradeIncompleteCopy(missing),
      options,
    );
  }
  return applyIncompleteConfidenceCopy(
    buildProportionIncompleteCopy(gradeHints),
    options,
  );
}

/** Display-only technical appendix rows for incomplete assessment surfaces. */
export function buildV3IncompleteTechnicalItems(
  copy: V3IncompleteAssessmentCopy,
): { label: string; value: string }[] {
  const items: { label: string; value: string }[] = [
    {
      label: "Recommendation Status",
      value: copy.recommendationStatus,
    },
  ];

  if (copy.gradesConfirmed) {
    items.push({
      label: "Grades Confirmed",
      value: copy.gradesConfirmed,
    });
  }

  items.push(
    {
      label: copy.missingDataLabel,
      value: copy.missingDataValue,
    },
    {
      label: "Optical Read",
      value: copy.opticalRead,
    },
    {
      label: "Confidence Level",
      value: copy.confidenceLevel,
    },
    {
      label: "Next Step",
      value: copy.nextStep,
    },
  );

  return items;
}
