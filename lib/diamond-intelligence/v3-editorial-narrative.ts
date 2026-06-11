import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import type { DiamondDecisionProfile } from "./diamond-decision-profile";
import type { HourglassClarityDisplayPolicy } from "./hourglass-clarity-policy";
import { SI2_INSPECTION_REQUIRED_MESSAGE } from "./hourglass-clarity-policy";
import type { PrimaryLimitingFactorKey } from "./primary-limiting-factor";
import type { VisualPersonality } from "./visual-personality";
import type { ReportGradeHints } from "./report-grade-hints";
import {
  formatColorForSummary,
  warmColorPreferenceContextCopy,
} from "./color-grade-policy";
import type { PurchaseRecommendationLabel } from "./purchase-recommendation-presentation";

/** Consumer-facing tier label — internal `Open` stays unchanged in logic. */
export function displayV3PublicTierLabel(tier: string): string {
  return tier === "Open" ? "Needs Review" : tier;
}

const FORBIDDEN_NOTICE_TITLES = new Set([
  "more information needed",
  "not recommended",
  "preliminary assessment",
  "outside hourglass standards",
  "limited information available",
  "justin inspection required",
  "worth reviewing after additional information",
]);

function formatGradeScope(
  fields: CalibrationReportFields,
  hints?: ReportGradeHints | null,
): string | null {
  const parts: string[] = [];
  const color = hints?.color?.trim();
  const clarity = hints?.clarity?.trim();
  const cut = fields?.cutGrade?.trim();

  if (color) parts.push(`${color} color`);
  if (clarity) parts.push(`${clarity} clarity`);
  if (cut) parts.push(`${cut} cut grade`);

  if (parts.length === 0) return null;
  return `This assessment evaluated the report's ${parts.join(", ")}, alongside proportion measurements where present.`;
}

function isPreliminaryPurchase(
  purchaseRecommendation: PurchaseRecommendationLabel,
): boolean {
  return purchaseRecommendation === "Worth Reviewing After Additional Information";
}

function pickIncompleteArchitectureTitle(input: {
  purchaseRecommendation: PurchaseRecommendationLabel;
  opticalBand: string;
}): string {
  if (isPreliminaryPurchase(input.purchaseRecommendation)) {
    return "Refined with some unanswered questions.";
  }
  if (input.opticalBand === "Preliminary" || input.opticalBand === "Unavailable") {
    return "Bright but not fully verified.";
  }
  return "Organized and controlled.";
}

function pickIncompleteArchitectureBody(): string[] {
  return [
    "The report suggests a structured, report-driven optical story — brightness and pattern may read steadily even where full proportion confirmation is still limited.",
    "Compare beside other candidates once imagery or additional measurement detail is available.",
  ];
}

function buildGradeConstrainedSummary(input: {
  clarityPolicy: HourglassClarityDisplayPolicy;
  gradeHints?: ReportGradeHints | null;
  uncappedOpticalTier: string;
  purchaseRecommendation: PurchaseRecommendationLabel;
}): string | null {
  const color = formatColorForSummary(input.gradeHints?.color);
  const clarity = input.gradeHints?.clarity?.trim();
  const premiumOptics =
    input.uncappedOpticalTier === "Rare" ||
    input.uncappedOpticalTier === "Exceptional" ||
    input.uncappedOpticalTier === "Distinctive" ||
    input.uncappedOpticalTier === "Strong";

  if (input.clarityPolicy.isExcluded && clarity) {
    return `The report includes an ${clarity} clarity grade, which falls outside Hourglass standards. Even if some proportions are workable, the diamond is not recommended.`;
  }

  if (
    input.clarityPolicy.isSi2 &&
    color &&
    clarity &&
    premiumOptics
  ) {
    const warmNote = warmColorPreferenceContextCopy(input.gradeHints?.color);
    const warmClause = warmNote
      ? ` ${warmNote}`
      : color
        ? ` The ${color} color profile is a preference signal — not an automatic rejection.`
        : "";
    return `This report shows strong optical proportions, but ${clarity} clarity requires human review before a complete purchase recommendation can be made.${warmClause}`;
  }

  if (
    input.purchaseRecommendation === "Strong Candidate" ||
    input.purchaseRecommendation === "Recommended"
  ) {
    if (premiumOptics) {
      return "The report supports a strong candidate profile, with favorable proportions and no major grade-based concerns.";
    }
  }

  if (input.purchaseRecommendation === "Justin Inspection Required") {
    const colorPart = color ? `the ${color} color profile` : "the reported color";
    const clarityPart = clarity ? `${clarity} clarity` : "the reported clarity";
    if (premiumOptics) {
      return `This report shows strong optical proportions, but ${colorPart} and ${clarityPart} require human review before a purchase recommendation can be made.`;
    }
  }

  return null;
}

export function buildV3ReportSummaryParagraphs(input: {
  clarityPolicy: HourglassClarityDisplayPolicy;
  isGcal8x: boolean;
  fields: CalibrationReportFields;
  gradeHints?: ReportGradeHints | null;
  purchaseRecommendation: PurchaseRecommendationLabel;
  uncappedOpticalTier: string;
  interpretationSummary: string;
}): string[] {
  const {
    clarityPolicy,
    isGcal8x,
    fields,
    gradeHints,
    purchaseRecommendation,
    uncappedOpticalTier,
    interpretationSummary,
  } = input;

  if (clarityPolicy.isExcluded) {
    const constrained = buildGradeConstrainedSummary({
      clarityPolicy,
      gradeHints,
      uncappedOpticalTier,
      purchaseRecommendation,
    });
    return constrained
      ? [constrained]
      : [
          "This assessment reviewed the color, clarity, and proportion information present on the uploaded report.",
          "Clarity characteristics were weighed alongside cut proportions and overall report context — not price or sourcing availability.",
        ];
  }

  if (isGcal8x) {
    return [
      "This diamond enters the assessment from a different starting point than a standard report-only stone.",
      "The GCAL 8X designation means it has passed a high-performance cut verification process supported by optical evidence.",
      "Rather than treating this as an ordinary report comparison, this read evaluates whether the individual diamond appears Rare or Exceptional within an already elite performance class.",
    ];
  }

  const constrained = buildGradeConstrainedSummary({
    clarityPolicy,
    gradeHints,
    uncappedOpticalTier,
    purchaseRecommendation,
  });
  if (constrained) {
    return [constrained];
  }

  if (
    clarityPolicy.isSi2 ||
    isPreliminaryPurchase(purchaseRecommendation)
  ) {
    const scope = formatGradeScope(fields, gradeHints);
    return [
      scope ??
        "This read is built from the color, clarity, and proportion information present on the uploaded report.",
      "Where measurements were available, they were weighed for brightness, balance, and everyday visual performance potential.",
    ];
  }

  const scope = formatGradeScope(fields, gradeHints);
  if (scope) {
    return [
      scope,
      interpretationSummary ||
        "Proportion and performance indicators on the report were evaluated for how the diamond is likely to look in person.",
    ].filter(Boolean);
  }

  return [interpretationSummary].filter(Boolean);
}

export type V3NoticePresentation = {
  lead: string;
  body: string[];
  quote: string | null;
};

export function buildV3NoticePresentation(input: {
  clarityPolicy: HourglassClarityDisplayPolicy;
  isGcal8x: boolean;
  visualPersonality: VisualPersonality | null;
  purchaseRecommendation: PurchaseRecommendationLabel;
  opticalBand: string;
}): V3NoticePresentation {
  const {
    clarityPolicy,
    isGcal8x,
    visualPersonality,
    purchaseRecommendation,
    opticalBand,
  } = input;

  if (clarityPolicy.isExcluded) {
    return {
      lead: "Visible clarity character.",
      body: [
        "You may notice inclusions when looking closely — their size, position, and transparency can affect how crisp or muted the diamond appears in person.",
        "Face-up sparkle may still be present, but clarity grade often drives whether the stone reads clean or busy under everyday viewing.",
      ],
      quote: "“clarity-forward, with inclusions that may read in direct view.”",
    };
  }

  if (isGcal8x) {
    return {
      lead: "Optically refined.",
      body: [
        "This diamond should present with a controlled balance of brightness, contrast, and fire rather than relying on a single standout trait.",
        "The 8X support suggests a more complete performance picture than proportion data alone can provide.",
      ],
      quote: "“bright, precise, and confidently balanced.”",
    };
  }

  if (
    visualPersonality?.archetype === "Architecture Unclear" ||
    opticalBand === "Preliminary" ||
    opticalBand === "Unavailable"
  ) {
    const lead = pickIncompleteArchitectureTitle({
      purchaseRecommendation,
      opticalBand,
    });
    return {
      lead,
      body: pickIncompleteArchitectureBody(),
      quote: `“${lead.replace(/\.$/, "").toLowerCase()}.”`,
    };
  }

  const rawTitle = visualPersonality?.displayTitle ?? "Bright.";
  const lead = FORBIDDEN_NOTICE_TITLES.has(rawTitle.toLowerCase())
    ? "Balanced everyday sparkle."
    : rawTitle;

  const body = visualPersonality?.explanation
    ? [visualPersonality.explanation]
    : [
        "You may notice a comfortable, everyday sparkle — neither especially wide on the hand nor especially deep in profile.",
      ];

  return {
    lead,
    body,
    quote: `“${lead.replace(/\.$/, "").toLowerCase()}.”`,
  };
}

function justinForExcluded(): string[] {
  return [
    "Even when proportions read acceptably on paper, I would not treat I-grade clarity as a candidate I would normally put forward without a very specific, expert-reviewed reason.",
    "If you are still considering it, the next step is a direct review of inclusion visibility and eye-clean appearance — not a proportion-only read.",
  ];
}

function justinForGcal8x(): string[] {
  return [
    "With GCAL 8X, I would be confident treating this diamond as a serious, high-performance candidate.",
    "The report already gives us more evidence than a standard grading report alone, and the 8X classification supports a strong overall read.",
    "That said, even within GCAL 8X, there are still details worth evaluating in person — visual personality, transparency, pattern preference, and how this diamond compares against other top performers within the same class.",
    "In other words, this looks like a solid choice. The final review is about confirming it is the right solid choice.",
  ];
}

function justinForFactor(
  key: PrimaryLimitingFactorKey,
  input: {
    clarityPolicy: HourglassClarityDisplayPolicy;
    confidenceBand: string;
    recommendationBand: string;
    limitingDisplay: string;
    cutGrade?: string;
  },
): string[] {
  switch (key) {
    case "finish":
      return [
        input.cutGrade?.toLowerCase().includes("fair")
          ? "The first thing I'd investigate is the Fair cut grade and whether the finish characteristics have any real-world visual impact."
          : `The first thing I'd investigate is finish — ${input.limitingDisplay.toLowerCase()} — and whether polish, symmetry, or cut grade show any meaningful visual tradeoff in person.`,
        "On paper, strong color and clarity can still pair with finish compromises. I'd want to see whether brightness, pattern, and fire remain acceptable before getting enthusiastic.",
      ];
    case "clarity":
      if (input.clarityPolicy.isSi2) {
        return [
          SI2_INSPECTION_REQUIRED_MESSAGE,
          "If the inclusions are eye-clean in video and in person, SI2 can still be worth reviewing — but that confirmation has to come before any recommendation.",
        ];
      }
      return [
        "My focus would be inclusion visibility, transparency, and whether the stone is genuinely eye-clean.",
        "Report grades set expectations, but clarity almost always needs direct confirmation before I'd treat a stone as a strong candidate.",
      ];
    case "color":
      return [
        "Body color is the main variable I'd want to evaluate in person — how warm or muted the stone reads under everyday lighting.",
        "The report gives us a starting point, but color perception changes with setting metal, lighting, and personal preference.",
      ];
    case "fluorescence":
      return [
        "I'd want to see this stone under multiple lighting conditions to understand whether fluorescence affects transparency or face-up color.",
        "Strong fluorescence can be harmless or distracting — that distinction rarely shows on the report alone.",
      ];
    case "spread-architecture":
      return [
        "I'd compare face-up size against depth and fire — spread-oriented stones can look impressive on the hand while trading off other visual traits.",
        "The question is whether the spread advantage still feels balanced once you see the diamond move in light.",
      ];
    case "deep-architecture":
      return [
        "I'd check whether the slightly deeper architecture affects face-up size in a way that matters for the buyer's priorities.",
        "Depth isn't automatically a flaw, but it can change how the carat weight reads on the hand.",
      ];
    case "incomplete-data":
      return [
        input.confidenceBand === "Low"
          ? "I would want to confirm the optical structure before drawing stronger conclusions."
          : "There are still gaps in the report picture — I'd want fuller proportion confirmation before treating this as a finished read.",
        "Useful context now, but I'd hold final enthusiasm until imagery or additional measurement detail is available.",
      ];
    case "colored-diamond":
      return [
        "Colored-diamond reports follow a different decision path than standard D–Z assessments.",
        "I'd want to confirm hue, tone, and saturation in person before treating any performance read as complete.",
      ];
    case "none":
      if (
        input.recommendationBand === "Strong Candidate" ||
        input.recommendationBand === "Worth Reviewing"
      ) {
        return [
          "This is the type of report that would typically justify taking the next step.",
          "The paper read is encouraging — I'd still want optical imagery and an in-person check before calling it a final choice.",
        ];
      }
      return [
        "If this diamond were submitted to me as part of a client's search, I would be comfortable keeping it in consideration.",
        "The report presents reasonably well — my next step would be confirming visual performance rather than re-litigating the grades.",
      ];
    default:
      return [
        "I'd want to confirm how this diamond actually looks before treating the report read as final.",
      ];
  }
}

export function buildJustinPerspectiveParagraphs(input: {
  clarityPolicy: HourglassClarityDisplayPolicy;
  isGcal8x: boolean;
  decisionProfile: DiamondDecisionProfile;
  fields: CalibrationReportFields;
}): string[] {
  const { clarityPolicy, isGcal8x, decisionProfile, fields } = input;

  if (clarityPolicy.isExcluded) {
    return justinForExcluded();
  }

  if (isGcal8x) {
    return justinForGcal8x();
  }

  if (input.clarityPolicy.isSi2) {
    return justinForFactor("clarity", {
      clarityPolicy: input.clarityPolicy,
      confidenceBand: decisionProfile.confidence.band,
      recommendationBand: decisionProfile.overallRecommendation.band,
      limitingDisplay: decisionProfile.primaryLimitingFactor.display,
      cutGrade: fields.cutGrade,
    });
  }

  return justinForFactor(decisionProfile.primaryLimitingFactor.key, {
    clarityPolicy,
    confidenceBand: decisionProfile.confidence.band,
    recommendationBand: decisionProfile.overallRecommendation.band,
    limitingDisplay: decisionProfile.primaryLimitingFactor.display,
    cutGrade: fields.cutGrade,
  });
}

export function buildV3EarnedLimitations(input: {
  clarityPolicy: HourglassClarityDisplayPolicy;
  isGcal8x: boolean;
  worthKnowing: string[];
}): string[] {
  const { clarityPolicy, isGcal8x, worthKnowing } = input;

  if (clarityPolicy.isExcluded) {
    return [
      "Inclusion visibility and transparency in person",
      "Whether inclusions affect brightness or face-up beauty under everyday viewing",
    ];
  }

  if (isGcal8x) {
    return [
      "Whether the visual personality matches the buyer's preference",
      "Whether any inclusions affect transparency or real-world beauty",
      "Whether the price is justified relative to comparable 8X options",
    ];
  }

  return worthKnowing;
}
