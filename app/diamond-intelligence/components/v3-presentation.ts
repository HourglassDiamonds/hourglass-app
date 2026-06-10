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
  resolveHourglassClarityPolicy,
  SI2_PRESENTATION_TIER_CEILING,
} from "@/lib/diamond-intelligence/hourglass-clarity-policy";

export type V3PublicTier =
  | "Rare"
  | "Exceptional"
  | "Distinctive"
  | "Strong"
  | "Balanced"
  | "Open";

export type V3Gcal8xTier = "Rare" | "Exceptional";

export type V3PercentilePresentation = {
  topLine: string;
  topSubline: string;
  betterThanPercent: number;
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
function scoreToV3PublicTier(
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
  clarity?: string,
): V3PercentilePresentation | null {
  const policy = resolveHourglassClarityPolicy(clarity);
  if (policy.suppressFavorablePercentile) return null;

  if (displayScore === null || !Number.isFinite(displayScore)) return null;

  const topPercent = Math.min(99, Math.max(1, Math.round(100 - displayScore)));
  const betterThan = Math.min(99, Math.max(1, Math.round(displayScore)));

  return {
    topLine: `Top ${topPercent}%`,
    topSubline: "of diamonds we typically evaluate",
    betterThanPercent: betterThan,
  };
}

export function resolveV3HeroVerdictLabel(input: {
  clarity?: string;
  lowInterpretationConfidence: boolean;
  opticalUnavailable: boolean;
  isGcal8x: boolean;
  gcal8xTier: V3Gcal8xTier | null;
  publicTier: V3PublicTier;
}): string {
  const policy = resolveHourglassClarityPolicy(input.clarity);
  if (policy.heroVerdictLabel) return policy.heroVerdictLabel;

  if (input.lowInterpretationConfidence) {
    return input.opticalUnavailable
      ? "Limited Information Available"
      : "Preliminary Assessment";
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
    return "Clarity Concern · Visibility Risk · Not Recommended";
  }

  if (isGcal8x) {
    return "Bright · Precise · Strong Optical Support";
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

  if (words.length === 0) return "Balanced · Steady · Report-Based Read";
  return words.slice(0, 3).join(" · ");
}

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
