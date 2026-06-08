import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import type { DecisionConfidenceBand } from "./decision-profile-confidence";
import type {
  OpticalPerformanceBand,
  OverallRecommendationBand,
  ProportionArchetype,
  RiskProfileBand,
  VisualPresenceBand,
} from "./diamond-decision-profile";
import type { PrimaryLimitingFactor } from "./primary-limiting-factor";
import {
  claritySeverity,
  fluorescenceConcern,
  type ReportGradeHints,
} from "./report-grade-hints";
import {
  hourglassClarityStandardsNote,
  isBelowHourglassClarityStandard,
} from "./hourglass-clarity-standards";

export type DiamondPurchasePersonalityTone =
  | "positive"
  | "neutral"
  | "caution"
  | "negative";

export type DiamondIdentityLabel =
  | "Performance-Led Choice"
  | "Balanced Everyday Choice"
  | "Value-Oriented Candidate"
  | "Appearance-Led Choice"
  | "Spread-Oriented Choice"
  | "Conservative Candidate"
  | "Review-Dependent Candidate"
  | "Architecture-Limited Candidate"
  | "Outside Hourglass Standards";

export type DiamondPurchasePersonality = {
  label: DiamondIdentityLabel;
  /** Fixed plain-English meaning for consumers — paired with label, not a replacement. */
  translation: string;
  tone: DiamondPurchasePersonalityTone;
  summary: string;
  why: string[];
  bestFor?: string;
  watchOutFor?: string;
};

/** Deterministic subtitle for each identity label — presentation only. */
export const IDENTITY_TRANSLATIONS: Record<DiamondIdentityLabel, string> = {
  "Performance-Led Choice":
    "Often attractive for buyers who prioritize sparkle and light performance.",
  "Balanced Everyday Choice":
    "Well-rounded with no major concerns identified from the report.",
  "Value-Oriented Candidate":
    "May offer attractive value if you're comfortable with the tradeoffs.",
  "Appearance-Led Choice":
    "Cleaner color and clarity may matter more than standout sparkle on paper.",
  "Spread-Oriented Choice":
    "Appears larger than expected for its carat weight.",
  "Conservative Candidate":
    "Straightforward on paper with few obvious concerns to weigh.",
  "Review-Dependent Candidate":
    "Additional information or direct review is needed before drawing conclusions.",
  "Architecture-Limited Candidate":
    "Worth understanding the proportion tradeoff before moving forward.",
  "Outside Hourglass Standards":
    "Falls outside the standards typically recommended by Hourglass.",
};

export function translationForIdentityLabel(
  label: DiamondIdentityLabel,
): string {
  return IDENTITY_TRANSLATIONS[label];
}

function colorWeight(color?: string): number {
  const c = (color ?? "").trim().toUpperCase();
  if (!c || /^[D-G]$/.test(c)) return 0;
  if (/^[H-K]$/.test(c)) return 1;
  if (/^[L-N]$/.test(c)) return 2;
  if (/^[O-Z]/.test(c) || c.startsWith("FANCY")) return 4;
  return 1;
}

function isOpticalStrong(band: OpticalPerformanceBand): boolean {
  return band === "Strong" || band === "Solid";
}

function isOpticalModerateOrWeaker(band: OpticalPerformanceBand): boolean {
  return band === "Moderate" || band === "Mixed";
}

function isSpreadStory(input: {
  visualBand: VisualPresenceBand;
  archetype: ProportionArchetype;
  primaryKey: PrimaryLimitingFactor["key"];
}): boolean {
  if (input.primaryKey === "spread-architecture") return true;
  if (
    input.visualBand === "Spread-forward" ||
    input.visualBand === "Generous face-up"
  ) {
    return true;
  }
  return (
    input.archetype === "spread-oriented" ||
    input.archetype === "shallow-spread"
  );
}

function isArchitectureLimitedStory(input: {
  primaryKey: PrimaryLimitingFactor["key"];
  archetype: ProportionArchetype;
  visualBand: VisualPresenceBand;
}): boolean {
  if (input.primaryKey === "deep-architecture") return true;
  return (
    input.archetype === "compact-deep" ||
    input.visualBand === "Compact depth"
  );
}

function finishTier(fields: CalibrationReportFields): "excellent" | "good" | "other" {
  const text = [fields.cutGrade, fields.polish, fields.symmetry]
    .join(" ")
    .toLowerCase();
  if (text.includes("excellent")) return "excellent";
  if (text.includes("very good") || text.includes("good")) return "good";
  return "other";
}

function appearanceReadsClean(hints: ReportGradeHints, fields: CalibrationReportFields): boolean {
  const clarity = claritySeverity(hints.clarity);
  const color = colorWeight(hints.color);
  const finish = finishTier(fields);
  return clarity <= 2 && color <= 1 && finish === "excellent";
}

function resolveLabel(input: {
  recommendation: OverallRecommendationBand;
  risk: RiskProfileBand;
  confidenceBand: DecisionConfidenceBand;
  opticalBand: OpticalPerformanceBand;
  visualBand: VisualPresenceBand;
  primaryLimitingFactor: PrimaryLimitingFactor;
  archetype: ProportionArchetype;
  hints: ReportGradeHints;
  fields: CalibrationReportFields;
}): DiamondIdentityLabel {
  const clarity = (input.hints.clarity ?? "").trim().toUpperCase();
  const clarityW = claritySeverity(input.hints.clarity);
  const primaryKey = input.primaryLimitingFactor.key;

  if (input.recommendation === "Not Recommended") {
    return "Outside Hourglass Standards";
  }

  if (clarity === "I3") {
    return "Outside Hourglass Standards";
  }

  if (clarity === "I1" || clarity === "I2") {
    return "Outside Hourglass Standards";
  }

  if (
    input.confidenceBand === "Low" ||
    primaryKey === "incomplete-data" ||
    input.recommendation === "Needs More Information" ||
    input.recommendation === "Worth Reviewing After Additional Information"
  ) {
    return "Review-Dependent Candidate";
  }

  if (
    isArchitectureLimitedStory({
      primaryKey,
      archetype: input.archetype,
      visualBand: input.visualBand,
    }) &&
    !isSpreadStory({
      visualBand: input.visualBand,
      archetype: input.archetype,
      primaryKey,
    })
  ) {
    return "Architecture-Limited Candidate";
  }

  if (
    isSpreadStory({
      visualBand: input.visualBand,
      archetype: input.archetype,
      primaryKey,
    })
  ) {
    return "Spread-Oriented Choice";
  }

  if (
    input.opticalBand === "Strong" &&
    input.risk !== "High" &&
    input.risk !== "Elevated" &&
    clarityW <= 3 &&
    primaryKey === "none"
  ) {
    return "Performance-Led Choice";
  }

  if (
    isOpticalModerateOrWeaker(input.opticalBand) &&
    input.risk !== "High" &&
    appearanceReadsClean(input.hints, input.fields)
  ) {
    return "Appearance-Led Choice";
  }

  if (
    input.recommendation === "Strong Candidate" &&
    input.risk === "Low" &&
    primaryKey === "none" &&
    input.opticalBand === "Solid"
  ) {
    return "Conservative Candidate";
  }

  if (
    input.recommendation === "Compare Carefully" ||
    input.recommendation === "Worth Reviewing" ||
    input.risk === "Elevated" ||
    clarityW >= 4 ||
    primaryKey === "clarity" ||
    primaryKey === "color" ||
    primaryKey === "fluorescence" ||
    primaryKey === "finish"
  ) {
    return "Value-Oriented Candidate";
  }

  return "Balanced Everyday Choice";
}

function toneForLabel(label: DiamondIdentityLabel): DiamondPurchasePersonalityTone {
  switch (label) {
    case "Outside Hourglass Standards":
      return "negative";
    case "Review-Dependent Candidate":
    case "Architecture-Limited Candidate":
      return "caution";
    case "Value-Oriented Candidate":
      return "neutral";
    case "Performance-Led Choice":
    case "Conservative Candidate":
    case "Balanced Everyday Choice":
    case "Appearance-Led Choice":
    case "Spread-Oriented Choice":
      return "positive";
  }
}

function buildCopy(
  label: DiamondIdentityLabel,
  input: {
    recommendation: OverallRecommendationBand;
    risk: RiskProfileBand;
    opticalBand: OpticalPerformanceBand;
    visualBand: VisualPresenceBand;
    primaryLimitingFactor: PrimaryLimitingFactor;
    hints: ReportGradeHints;
    fields: CalibrationReportFields;
  },
): Pick<DiamondPurchasePersonality, "summary" | "why" | "bestFor" | "watchOutFor"> {
  const clarity = input.hints.clarity?.trim();
  const clarityUpper = clarity?.toUpperCase();
  const color = input.hints.color?.trim();
  const fluo = input.fields.fluorescence?.trim();
  const primary = input.primaryLimitingFactor.display;
  const primaryKey = input.primaryLimitingFactor.key;
  const why: string[] = [];

  switch (label) {
    case "Outside Hourglass Standards":
      if (isBelowHourglassClarityStandard(input.hints.clarity)) {
        const standards = hourglassClarityStandardsNote(input.hints.clarity);
        why.push(
          `Clarity ${input.hints.clarity} falls outside Hourglass recommended clarity standards for client guidance.`,
        );
        if (standards) why.push(standards);
        return {
          summary:
            "This is best understood as outside Hourglass typical client clarity standards — the lab grade stands; our recommendation reflects how we guide buyers.",
          why,
          bestFor: undefined,
          watchOutFor:
            "Not a candidate Hourglass would typically recommend for client sourcing without a very specific, expert-reviewed reason.",
        };
      }
      if (input.hints.clarity && /^I[23]$/.test(input.hints.clarity)) {
        why.push(`Clarity ${input.hints.clarity} is the dominant concern on paper.`);
      } else {
        why.push("Risk and recommendation signals outweigh the optical read.");
      }
      why.push("This is best understood as a pass unless price and in-person viewing change the story.");
      return {
        summary:
          "On paper, the report-based concerns outweigh the strengths for a confident client recommendation.",
        why,
        bestFor: undefined,
        watchOutFor:
          "Treat as compare-or-pass unless you accept specific tradeoffs with expert confirmation.",
      };

    case "Review-Dependent Candidate":
      if (primary === "Incomplete Report Data") {
        why.push("Key proportion fields are missing — the read stays preliminary.");
        why.push("This reflects incomplete report information, not a judgment on the diamond itself.");
        return {
          summary:
            "The report has useful starting information, but missing detail keeps this read preliminary — not a verdict on the diamond itself.",
          why,
          bestFor:
            "Anyone gathering more report detail or expert confirmation before treating this as a final candidate.",
          watchOutFor:
            "Confirm missing measurements or diagram fields before relying on architecture or recommendation language.",
        };
      }
      if (clarityUpper === "I2") {
        why.push(
          "Clarity I2 carries meaningful inclusion risk — expert review is especially important before this becomes a final candidate.",
        );
        why.push(`Overall recommendation: ${input.recommendation}.`);
        return {
          summary:
            "This could be interesting on paper, but I2 clarity makes direct review essential — not optional.",
          why,
          bestFor: "Buyers willing to review inclusion placement carefully before committing.",
          watchOutFor:
            "Do not rely on the report alone — confirm eye-clean appearance and inclusion visibility in person or on video.",
        };
      }
      if (clarityUpper === "I1") {
        why.push(
          "Clarity I1 may work for some buyers, but inclusion visibility still needs direct review before you commit.",
        );
        why.push(`Overall recommendation: ${input.recommendation}.`);
        return {
          summary:
            "This may be worth exploring, but I1 clarity means the final answer depends on what you see in person.",
          why,
          bestFor: "Buyers open to reviewing inclusions directly if the price and look otherwise align.",
          watchOutFor:
            "Confirm inclusion placement and eye-clean appearance before treating this as a final yes.",
        };
      }
      if (clarity === "SI2" || clarity === "SI1") {
        why.push("Clarity sits where eye-clean appearance cannot be confirmed from the report alone.");
      } else {
        why.push("One or more factors need human confirmation before you rely on this read.");
      }
      why.push(`Overall recommendation: ${input.recommendation}.`);
      return {
        summary:
          "This could be interesting, but the final answer depends on direct review — not the report alone.",
        why,
        bestFor: "Buyers willing to pause for expert or in-person verification before committing.",
        watchOutFor:
          clarity && /^SI[12]$/.test(clarity)
            ? "Confirm eye-clean appearance and inclusion placement in person or on video."
            : "Confirm architecture or supporting grades before treating this as a final yes.",
      };

    case "Architecture-Limited Candidate":
      why.push("Depth and spread read as the main proportion story on paper.");
      if (isOpticalStrong(input.opticalBand)) {
        why.push("Finish may still look strong, but face-up size or depth tradeoffs deserve attention.");
      } else {
        why.push("Optical architecture is not the clearest strength relative to the depth profile.");
      }
      if (input.recommendation === "Strong Candidate") {
        why.push("Recommendation reads strongly — architecture is still the nuance worth comparing in person.");
      } else {
        why.push(`Primary concern: ${primary}.`);
      }
      return {
        summary:
          input.recommendation === "Strong Candidate"
            ? "A strong candidate on paper — but the buying decision should account for depth and face-up presence, not the grade line alone."
            : "This is the kind of diamond where proportion architecture — not just the grade line — shapes the buying decision.",
        why,
        bestFor: "Someone comparing side-by-side with a more balanced or spreadier option at similar weight.",
        watchOutFor:
          "Compare face-up size and side profile against stones you already like before you commit.",
      };

    case "Spread-Oriented Choice":
      why.push("Face-up presence appears generous for the carat weight on paper.");
      if (primary.includes("Spread")) {
        why.push("Spread-forward architecture is part of the story, not just a side note.");
      }
      if (isOpticalStrong(input.opticalBand)) {
        why.push("Optical performance still reads well — the tradeoff is proportion style, not a weak cut grade alone.");
      }
      return {
        summary:
          "This diamond’s main argument may be how large it looks on the hand for its weight — with proportion tradeoffs worth understanding.",
        why,
        bestFor: "Someone who wants visible size impression without jumping carat weight.",
        watchOutFor:
          "Compare brightness and depth beside a more balanced stone — spread-forward profiles can trade differently in person.",
      };

    case "Performance-Led Choice":
      why.push("Optical performance is the clearest strength on the report.");
      if (input.risk === "Low") {
        why.push("No severe clarity or color ceiling is present on paper.");
      }
      if (
        input.visualBand === "Balanced presence" ||
        input.visualBand === "Generous face-up"
      ) {
        why.push("Face-up presence appears balanced for weight.");
      }
      return {
        summary:
          "This diamond’s strongest argument is its likely light performance.",
        why,
        bestFor: "Someone who prioritizes sparkle and overall visual life in everyday lighting.",
        watchOutFor:
          clarity && /^SI[12]$/.test(clarity)
            ? "Confirm the diamond is eye-clean if clarity is SI2 or lower."
            : "Still compare in person — report proportions are a strong starting point, not the full story.",
      };

    case "Appearance-Led Choice":
      why.push("Color, clarity, and finish read cleaner than the optical architecture story.");
      why.push(`Optical performance reads ${input.opticalBand.toLowerCase()} — appearance may outpace the proportion read.`);
      if (color) why.push(`Color grade ${color} supports a cleaner paper presentation.`);
      return {
        summary:
          "This is best understood as a diamond whose cleaner color and clarity may matter more than a standout proportion read.",
        why,
        bestFor: "Someone who notices body color, inclusion visibility, and overall cleanliness before sparkle nuance.",
        watchOutFor:
          "Compare optical life beside a stronger architecture candidate if sparkle is your top priority.",
      };

    case "Conservative Candidate":
      why.push("Recommendation and risk profile read calmly on paper.");
      why.push("No single report-based concern dominates the story.");
      if (isOpticalStrong(input.opticalBand)) {
        why.push("Optical performance supports the case without needing a bold tradeoff narrative.");
      }
      return {
        summary:
          "This is the kind of diamond with few obvious report-based concerns — a lower-drama candidate worth comparing in person.",
        why,
        bestFor: "Someone who wants a straightforward, broadly wearable option without a sharp tradeoff.",
        watchOutFor: "Routine in-person confirmation still matters — no report replaces seeing the stone.",
      };

    case "Value-Oriented Candidate":
      if (primaryKey === "color" && color && colorWeight(color) >= 4) {
        why.push("Optical performance may still read well — body color is the main tradeoff on paper.");
        if (clarity === "SI2" || clarity === "SI1") {
          why.push("SI2 clarity adds a second layer — eye-clean verification still matters.");
        }
        if (fluorescenceConcern(fluo) >= 2) {
          why.push("Medium or stronger fluorescence should be viewed in your typical lighting.");
        }
        why.push(`Recommendation: ${input.recommendation} — a tradeoff-led conversation, not a clean yes.`);
        return {
          summary:
            "This is best understood as a performance-capable stone where body color — and related tradeoffs — shape the value conversation.",
          why,
          bestFor:
            "Someone weighing color and price against optical performance, with realistic expectations about warmth and lighting.",
          watchOutFor:
            "Compare body color and fluorescence beside higher-color options before you commit.",
        };
      }
      if (primary !== "No Significant Concerns Identified") {
        why.push(`The tradeoff appears to be ${primary.toLowerCase()} relative to the optical read.`);
      }
      if (clarity === "SI2") {
        why.push("SI2 clarity can create value, but eye-clean verification matters.");
      }
      if (color && colorWeight(color) >= 2) {
        why.push(`Body color (${color}) is part of the value conversation.`);
      }
      if (fluorescenceConcern(fluo) >= 2) {
        why.push("Fluorescence should be viewed in your typical lighting.");
      }
      why.push(`Recommendation: ${input.recommendation} — promising in places, not a clean overall yes on paper.`);
      return {
        summary:
          "This may be potentially attractive where tradeoffs exist — but review matters before you treat it as a final candidate.",
        why,
        bestFor: "Someone open to a thoughtful tradeoff if price and in-person appearance align.",
        watchOutFor:
          primary === "Clarity"
            ? "Prioritize eye-clean confirmation over the optical number alone."
            : "Weigh the primary concern against comparable options before you commit.",
      };

    case "Balanced Everyday Choice":
    default:
      why.push("No single trait clearly dominates the report-based read.");
      why.push(`Optical performance: ${input.opticalBand}; risk: ${input.risk}.`);
      why.push("This reads as a practical, middle-ground candidate on paper.");
      return {
        summary:
          "This is the kind of diamond that may work well as an everyday choice — balanced strengths without one loud headline.",
        why,
        bestFor: "Someone who wants a sensible all-around option rather than a single standout trait.",
        watchOutFor: "Compare beside stones you already like — balanced profiles can feel different in person.",
      };
  }
}

/** Deterministic consumer identity — interpretation layer only. */
export function buildDiamondPurchasePersonality(input: {
  recommendation: OverallRecommendationBand;
  risk: RiskProfileBand;
  confidenceBand: DecisionConfidenceBand;
  opticalBand: OpticalPerformanceBand;
  visualBand: VisualPresenceBand;
  primaryLimitingFactor: PrimaryLimitingFactor;
  archetype: ProportionArchetype;
  hints: ReportGradeHints;
  fields: CalibrationReportFields;
}): DiamondPurchasePersonality {
  const label = resolveLabel(input);
  const tone = toneForLabel(label);
  const copy = buildCopy(label, input);

  return {
    label,
    translation: translationForIdentityLabel(label),
    tone,
    ...copy,
  };
}
