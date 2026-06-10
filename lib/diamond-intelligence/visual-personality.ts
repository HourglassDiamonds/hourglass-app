import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import type { ProportionArchetype } from "./diamond-decision-profile";
import type { OpticalPerformanceBand } from "./diamond-decision-profile";

/** Internal archetype keys — not shown to consumers. */
export type VisualPersonalityArchetype =
  | "Balanced Performer"
  | "Fire Forward"
  | "Spread Forward"
  | "Compact Architecture"
  | "Bright & Structured"
  | "Broad Flash Style"
  | "Lively Character"
  | "Architecture Unclear";

export type VisualPersonality = {
  label: string;
  archetype: VisualPersonalityArchetype;
  /** Plain-language title for consumers */
  displayTitle: string;
  explanation: string;
};

const CONSUMER_TITLES: Record<VisualPersonalityArchetype, string> = {
  "Balanced Performer": "Balanced Everyday Sparkle",
  "Fire Forward": "Emphasizes Colorful Flashes",
  "Spread Forward": "Looks Larger for Its Weight",
  "Compact Architecture": "Appears Slightly Smaller Than Expected",
  "Bright & Structured": "Bright with Crisp Sparkle",
  "Broad Flash Style": "Broad, Open Sparkle",
  "Lively Character": "Distinctive Sparkle Character",
  "Architecture Unclear": "Organized and controlled.",
};

function finishTier(fields: CalibrationReportFields): "excellent" | "very-good" | "good" | "other" {
  const text = [fields.cutGrade, fields.polish, fields.symmetry]
    .join(" ")
    .toLowerCase();
  if (text.includes("excellent")) return "excellent";
  if (text.includes("very good")) return "very-good";
  if (text.includes("good")) return "good";
  return "other";
}

export function consumerTitleForArchetype(
  archetype: VisualPersonalityArchetype,
): string {
  return CONSUMER_TITLES[archetype];
}

export function buildVisualPersonality(input: {
  proportionArchetype: ProportionArchetype;
  opticalBand: OpticalPerformanceBand;
  fields: CalibrationReportFields;
}): VisualPersonality {
  const { proportionArchetype, opticalBand, fields } = input;
  const finish = finishTier(fields);

  if (
    proportionArchetype === "incomplete-proportions" ||
    opticalBand === "Unavailable" ||
    opticalBand === "Preliminary"
  ) {
    const archetype: VisualPersonalityArchetype = "Architecture Unclear";
    return {
      label: "What You'll Likely Notice",
      archetype,
      displayTitle: CONSUMER_TITLES[archetype],
      explanation:
        "The report suggests a structured optical story — brightness and pattern may read steadily even where full proportion confirmation is still limited.",
    };
  }

  switch (proportionArchetype) {
    case "tolkowsky-balanced":
      if (
        (opticalBand === "Strong" || opticalBand === "Solid") &&
        finish === "excellent"
      ) {
        const archetype: VisualPersonalityArchetype = "Bright & Structured";
        return {
          label: "What You'll Likely Notice",
          archetype,
          displayTitle: CONSUMER_TITLES[archetype],
          explanation:
            "You may notice steady brightness and crisp sparkle in everyday lighting — an even, confident look rather than a size-first impression.",
        };
      }
      {
        const archetype: VisualPersonalityArchetype = "Balanced Performer";
        return {
          label: "What You'll Likely Notice",
          archetype,
          displayTitle: CONSUMER_TITLES[archetype],
          explanation:
            "You may notice a comfortable, everyday sparkle — neither especially wide on the hand nor especially deep in profile.",
        };
      }
    case "fire-forward": {
      const archetype: VisualPersonalityArchetype = "Fire Forward";
      return {
        label: "What You'll Likely Notice",
        archetype,
        displayTitle: CONSUMER_TITLES[archetype],
        explanation:
          "You may notice colorful flashes as the diamond moves — more fire and contrast than a size-first look.",
      };
    }
    case "spread-oriented":
    case "shallow-spread": {
      const archetype: VisualPersonalityArchetype = "Spread Forward";
      return {
        label: "What You'll Likely Notice",
        archetype,
        displayTitle: CONSUMER_TITLES[archetype],
        explanation:
          "You may notice the diamond looks a bit larger on the hand for its weight — diameter may stand out before depth or fire become the story.",
      };
    }
    case "compact-deep": {
      const archetype: VisualPersonalityArchetype = "Compact Architecture";
      return {
        label: "What You'll Likely Notice",
        archetype,
        displayTitle: CONSUMER_TITLES[archetype],
        explanation:
          "You may notice the diamond looks slightly smaller face-up for its weight — more of the carat may read in depth than in spread.",
      };
    }
    default: {
      const table = parseFloat(fields.tablePercent);
      if (Number.isFinite(table) && table >= 61) {
        const archetype: VisualPersonalityArchetype = "Broad Flash Style";
        return {
          label: "What You'll Likely Notice",
          archetype,
          displayTitle: CONSUMER_TITLES[archetype],
          explanation:
            "You may notice a broad, open brightness in casual viewing — compare beside tighter stones if you prefer more contrast.",
        };
      }
      const archetype: VisualPersonalityArchetype = "Lively Character";
      return {
        label: "What You'll Likely Notice",
        archetype,
        displayTitle: CONSUMER_TITLES[archetype],
        explanation:
          "You may notice a lively, distinctive sparkle style. It may not read as perfectly textbook on paper, but the report still suggests a strong visual performer.",
      };
    }
  }
}
