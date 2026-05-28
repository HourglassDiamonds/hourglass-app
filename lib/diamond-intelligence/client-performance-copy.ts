import type { ClientInterpretationScore } from "./client-score-present";
import type { OverallReadLabel } from "./client-percentile-present";
import type { ClientSafeReportCapability } from "./client-api";
import type { ClientInterpretationLevel } from "./types";

export type PerformanceReadCopy = {
  whatThisMeans: string;
  visualNote: string;
  confidenceNote: string;
};

export type FaceUpPresenceCopy = {
  summary: string;
  footnote: string;
};

function scoreBucket(
  overallScore: number | null,
  overallLabel: OverallReadLabel,
): "exceptional" | "strong" | "balanced" | "mixed" | "review" {
  if (overallLabel === "Top 0.5%" || overallLabel === "Top 1%" || overallLabel === "Top 5%") {
    return "exceptional";
  }
  if (overallLabel === "Strong" || (overallScore !== null && overallScore >= 88)) {
    return "strong";
  }
  if (overallLabel === "Balanced" || (overallScore !== null && overallScore >= 82)) {
    return "balanced";
  }
  if (overallLabel === "Mixed" || (overallScore !== null && overallScore >= 75)) {
    return "mixed";
  }
  return "review";
}

/** Plain-English Performance Read — display only; does not change scoring. */
export function buildPerformanceReadCopy(input: {
  overallScore: number | null;
  overallLabel: OverallReadLabel;
  clientScore: ClientInterpretationScore | null;
  interpretationLevel: ClientInterpretationLevel;
  needsExpertDiagramReview: boolean;
}): PerformanceReadCopy {
  const bucket = scoreBucket(input.overallScore, input.overallLabel);

  if (!input.clientScore?.eligible || input.overallScore === null) {
    return {
      whatThisMeans:
        input.interpretationLevel === "proportion"
          ? "We can read the main proportions from your report, but the overall light-performance score needs a few more fields before it feels complete."
          : "This is an early read from what the report shows so far — helpful context, not a final verdict on the diamond.",
      visualNote:
        "In person, you may still see pleasing sparkle; this score reflects what the report text and diagram support today.",
      confidenceNote: input.needsExpertDiagramReview
        ? "Deeper diagram details are worth verifying with Justin before you rely on a full optical story."
        : "Adding a few proportion values from your report can sharpen this read — or Justin can walk through it with you.",
    };
  }

  switch (bucket) {
    case "exceptional":
      return {
        whatThisMeans:
          "This is an outstanding overall light-performance read. In practical terms, the proportions suggest lively brightness, strong fire, and healthy contrast — the kind of balance many buyers hope for in a round brilliant.",
        visualNote:
          "Visually, you would typically expect confident sparkle, crisp flashes of color, and a face-up presence that feels lively rather than flat.",
        confidenceNote: input.needsExpertDiagramReview
          ? "The overall read is strong; Justin can still verify finer diagram details if you want extra certainty before you decide."
          : "This is a confident interpretation from your report — still not a laboratory grade, but a strong signal for everyday decision-making.",
      };
    case "strong":
      return {
        whatThisMeans:
          "This is a strong overall light-performance read. In practical terms, the proportions suggest balanced brightness, lively fire, and no major proportion red flags.",
        visualNote:
          "You would usually notice pleasing brilliance and movement in the diamond — a balanced, engaging look rather than a dull or overly shallow read.",
        confidenceNote: input.needsExpertDiagramReview
          ? "The big picture looks strong; deeper diagram details are best confirmed with Justin if you want every optical nuance verified."
          : "You can feel reasonably confident in this read for comparing options — and Justin can always sanity-check tradeoffs with you.",
      };
    case "balanced":
      return {
        whatThisMeans:
          "This is a balanced overall light-performance read — neither flashy nor problematic on paper. The proportions suggest steady brightness and fire with a few areas worth understanding, not alarm bells.",
        visualNote:
          "In person, the diamond may still look beautiful; this read highlights where the report supports a middle-ground optical story.",
        confidenceNote:
          "Worth a conversation with Justin if you are deciding between similar stones — he can translate what the numbers mean for how it will look to your eye.",
      };
    case "mixed":
      return {
        whatThisMeans:
          "This is a mixed overall light-performance read. Some proportion choices work well; others suggest tradeoffs in brightness, fire, or contrast that are worth understanding before you commit.",
        visualNote:
          "You might notice perfectly acceptable beauty in person, but the report suggests the cut is not maximizing every optical trait equally.",
        confidenceNote:
          "This is worth reviewing with Justin — not a rejection, just a signal to compare how the tradeoffs matter to you.",
      };
    default:
      return {
        whatThisMeans:
          "This read is incomplete or uneven on the report we received — not necessarily a bad diamond, but not enough for a confident overall light-performance story yet.",
        visualNote:
          "Do not read a low number here as a final judgment; missing or unclear report fields often drive this result.",
        confidenceNote:
          "Justin can review the report with you and explain what is worth verifying before you decide.",
      };
  }
}

export function buildFaceUpPresenceCopy(input: {
  measurements: string;
  carat: string;
  avgDiameterMm: number | null;
}): FaceUpPresenceCopy {
  const caratNum = parseFloat(input.carat.replace(/[^\d.]/g, ""));
  const diameter = input.avgDiameterMm;

  let summary =
    "Visual size depends on measurements and carat weight together — how efficiently the stone faces up for its weight.";

  if (
    diameter !== null &&
    Number.isFinite(caratNum) &&
    caratNum > 0 &&
    Number.isFinite(diameter)
  ) {
    const expectedApprox = 6.4 + Math.cbrt(caratNum) * 2.2;
    const ratio = diameter / expectedApprox;
    if (ratio >= 1.03) {
      summary =
        "Faces up slightly broad for its carat weight — the spread can make the diamond look a touch larger on the hand.";
    } else if (ratio <= 0.97) {
      summary =
        "Carries its weight efficiently — a slightly tighter spread can look rich and concentrated face-up.";
    } else {
      summary =
        "Visual size appears balanced for the weight — neither unusually spread nor unusually compact on paper.";
    }
  } else if (input.measurements.trim()) {
    summary =
      "Visual size appears balanced for the weight based on the measurements on your report.";
  }

  return {
    summary,
    footnote:
      "Face-up presence depends on measurements and carat weight together — not a separate laboratory grade.",
  };
}

function traitTone(
  clientScore: ClientInterpretationScore | null,
): { brightness: string; fire: string; contrast: string; scintillation: string } {
  const find = (label: string) =>
    clientScore?.lightTraits.find((t) => t.label === label);

  const word = (t: ReturnType<typeof find>) => {
    if (!t || t.level === "Needs review") return "mixed";
    if (t.level === "Strong") return "strong";
    if (t.level === "Balanced") return "balanced";
    if (t.level === "Limited") return "quieter";
    return "mixed";
  };

  return {
    brightness: word(find("Brightness")),
    fire: word(find("Fire")),
    contrast: word(find("Contrast")),
    scintillation: word(find("Scintillation")),
  };
}

/** Calm expert-style summary for the Optical Interpretation card — display only. */
export function buildOpticalInterpretationSummary(input: {
  capability: ClientSafeReportCapability;
  clientScore: ClientInterpretationScore | null;
  overallLabel: OverallReadLabel;
  needsExpertDiagramReview: boolean;
}): string {
  const bucket = scoreBucket(
    input.clientScore?.overall ?? null,
    input.overallLabel,
  );
  const tone = traitTone(input.clientScore);

  const expertClose = input.needsExpertDiagramReview
    ? " Deeper optical details on the report diagram would be best verified in an expert review."
    : "";

  if (bucket === "exceptional" || bucket === "strong") {
    return `This diamond shows a balanced overall presentation with ${tone.fire} fire and ${tone.contrast} contrast. Its proportions support a confident read for brightness and sparkle in everyday viewing.${expertClose}`;
  }

  if (bucket === "balanced") {
    return `This diamond shows a steady, balanced presentation — ${tone.brightness} brightness, ${tone.fire} fire, and ${tone.contrast} contrast working together without a single dramatic standout. That can still be very appealing in person; the report simply reads as middle-of-the-road on paper.${expertClose}`;
  }

  if (bucket === "mixed") {
    return `This diamond shows a mixed optical picture — some traits read ${tone.brightness} while others are ${tone.scintillation} or ${tone.contrast}. That often means real-world beauty with tradeoffs worth understanding before you choose.${expertClose}`;
  }

  if (input.capability.interpretationLevel === "basic") {
    return `This report gives a useful starting picture, but not enough proportion detail for a full light-performance story yet. Justin can help you see what matters visually and what is still worth confirming on the report.${expertClose}`;
  }

  return `This read is preliminary from what the report shows today — helpful orientation, not a final word on the diamond. Justin can walk through what you are likely to notice in person and what is still worth verifying.${expertClose}`;
}

export function buildOpticalCharacterCopy(input: {
  interpretationLevel: ClientInterpretationLevel;
  overallLabel: OverallReadLabel;
  needsExpertDiagramReview: boolean;
}): string {
  if (input.needsExpertDiagramReview) {
    return "On paper, the proportions support a pleasing balance of brightness and fire — with a few diagram details best confirmed by an expert before you treat the read as complete.";
  }

  switch (input.interpretationLevel) {
    case "deep":
      return "The emotional read here is confident and lively — the kind of optical balance that usually feels bright, crisp, and engaging on the hand.";
    case "proportion":
      if (input.overallLabel === "Strong" || input.overallLabel.startsWith("Top")) {
        return "The emotional read is upbeat and balanced — brightness and fire should feel harmonious rather than flat or harsh.";
      }
      return "The emotional read is steady and approachable — a balanced stone on paper, with room for Justin to nuance how it will feel in person.";
    default:
      return "The emotional read is still forming — enough to orient you, with more detail available as the report fills in or Justin reviews it with you.";
  }
}
