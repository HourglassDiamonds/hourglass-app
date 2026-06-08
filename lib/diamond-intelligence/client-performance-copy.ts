import type { ClientInterpretationScore } from "./client-score-present";
import type { DiamondCopyTone } from "./client-interpretation-context";
import type { OverallReadLabel } from "./client-percentile-present";
import type { ClientSafeReportCapability } from "./client-api";
import type { ClientInterpretationLevel } from "./types";
import {
  editorialFaceUpSummary,
  resolveEditorialFaceUpTier,
} from "./client-editorial-language";

export type PerformanceReadCopy = {
  /** One-line plain-English read directly under the score. */
  scoreHeadline: string;
  whatThisMeans: string;
  visualNote: string;
  confidenceNote: string;
  /** Why the score stays conservative when diagram detail is incomplete. */
  conservativeNote: string | null;
};

export type FaceUpPresenceCopy = {
  tierLabel: string | null;
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

function conservativeDiagramNote(): string {
  return "Some optical characteristics require diagram-level detail that is not fully visible on this report. Rather than guessing, the interpretation stays conservative until verified.";
}

/**
 * Humble Performance Read copy for careful/orientation display tone.
 * Avoids confident/exceptional language; leans on "based on the information
 * visible in the report" framing without sounding penalizing.
 */
function confidenceAdjustedReadCopy(
  level: "medium" | "low",
  conservativeNote: string | null,
): PerformanceReadCopy {
  if (level === "medium") {
    return {
      scoreHeadline:
        "Based on the information visible in the report, this appears to be a balanced overall read.",
      whatThisMeans:
        "We can read the main details on your report, and this diamond appears to present a balanced light return. Additional diagram-level detail would improve confidence in the deeper optical read.",
      visualNote:
        "In person you may well notice lively sparkle; this read reflects what the report supports today.",
      confidenceNote:
        "Adding the remaining proportion details — or an expert review with Justin — would sharpen this read.",
      conservativeNote,
    };
  }
  return {
    scoreHeadline:
      "A preliminary read — a useful starting point from the information visible in the report.",
    whatThisMeans:
      "This report gives a useful starting point. A fuller light-performance picture becomes available as more proportion detail is confirmed.",
    visualNote:
      "This is an early read, not a verdict — the diamond may still look beautiful in person.",
    confidenceNote:
      "Justin can help confirm the next details and translate what they may mean for how the diamond will look.",
    conservativeNote,
  };
}

/** Plain-English Performance Read — display only; does not change scoring. */
export function buildPerformanceReadCopy(input: {
  overallScore: number | null;
  overallLabel: OverallReadLabel;
  clientScore: ClientInterpretationScore | null;
  interpretationLevel: ClientInterpretationLevel;
  needsExpertDiagramReview: boolean;
  copyTone?: DiamondCopyTone;
}): PerformanceReadCopy {
  const bucket = scoreBucket(input.overallScore, input.overallLabel);

  const conservativeNote = input.needsExpertDiagramReview
    ? conservativeDiagramNote()
    : null;

  // Tone gate: never sound more certain than the data supports.
  if (input.copyTone === "careful") {
    return confidenceAdjustedReadCopy("medium", conservativeNote);
  }
  if (input.copyTone === "orientation") {
    return confidenceAdjustedReadCopy("low", conservativeNote);
  }

  if (!input.clientScore?.eligible || input.overallScore === null) {
    return {
      scoreHeadline:
        input.interpretationLevel === "proportion"
          ? "A proportion-based read — the overall score will sharpen as the report fills in."
          : "An early orientation from your report — not a final verdict on the diamond.",
      whatThisMeans:
        input.interpretationLevel === "proportion"
          ? "We can read the main proportions from your report, but the overall light-performance score needs a few more fields before it feels complete."
          : "This is an early read from what the report shows so far — helpful context, not a final verdict on the diamond.",
      visualNote:
        "In person, you may still see pleasing sparkle; this score reflects what the report text and diagram support today.",
      confidenceNote: input.needsExpertDiagramReview
        ? "Additional diagram detail is worth verifying with Justin before you rely on a full optical story."
        : "Adding a few proportion values from your report can sharpen this read — or Justin can walk through it with you.",
      conservativeNote,
    };
  }

  switch (bucket) {
    case "exceptional":
      return {
        scoreHeadline:
          "An outstanding proportion read with confident overall light return.",
        whatThisMeans:
          "This is an outstanding overall light-performance read. In practical terms, the proportions suggest lively brightness, strong fire, and healthy contrast — the kind of balance many buyers hope for in a round brilliant.",
        visualNote:
          "Visually, you would typically expect confident sparkle, crisp flashes of color, and a face-up presence that feels lively rather than flat.",
        confidenceNote: input.needsExpertDiagramReview
          ? "The overall read is strong; Justin can still verify additional diagram detail if you want extra certainty before you decide."
          : "This is a confident interpretation from your report — still not a laboratory grade, but a strong signal for everyday decision-making.",
        conservativeNote,
      };
    case "strong":
      return {
        scoreHeadline:
          "A strong overall proportion read with no major visual red flags.",
        whatThisMeans:
          "This is a strong overall light-performance read. In practical terms, the proportions suggest balanced brightness, lively fire, and no major proportion red flags.",
        visualNote:
          "You would usually notice pleasing brilliance and movement in the diamond — a balanced, engaging look rather than a dull or overly shallow read.",
        confidenceNote: input.needsExpertDiagramReview
          ? "The big picture looks strong; additional diagram detail is best confirmed with Justin if you want every optical nuance verified."
          : "You can feel reasonably confident in this read for comparing options — and Justin can always sanity-check tradeoffs with you.",
        conservativeNote,
      };
    case "balanced":
      return {
        scoreHeadline:
          "A balanced read — steady brightness and fire without a single dramatic standout on paper.",
        whatThisMeans:
          "This is a balanced overall light-performance read — neither flashy nor problematic on paper. The proportions suggest steady brightness and fire with a few areas worth understanding, not alarm bells.",
        visualNote:
          "In person, the diamond may still look beautiful; this read highlights where the report supports a middle-ground optical story.",
        confidenceNote:
          "Worth a conversation with Justin if you are deciding between similar stones — he can translate what the numbers mean for how it will look to your eye.",
        conservativeNote,
      };
    case "mixed":
      return {
        scoreHeadline:
          "A mixed read — some proportion choices work well; others are worth understanding before you decide.",
        whatThisMeans:
          "This is a mixed overall light-performance read. Some proportion choices work well; others suggest tradeoffs in brightness, fire, or contrast that are worth understanding before you commit.",
        visualNote:
          "You might notice perfectly acceptable beauty in person, but the report suggests the cut is not maximizing every optical trait equally.",
        confidenceNote:
          "This is worth reviewing with Justin — not a rejection, just a signal to compare how the tradeoffs matter to you.",
        conservativeNote,
      };
    default:
      return {
        scoreHeadline:
          "A preliminary read — helpful orientation until the report supports more detail.",
        whatThisMeans:
          "This read reflects what is visible so far — useful context today, with a fuller picture available as additional detail is confirmed.",
        visualNote:
          "A lower number here usually reflects an early read — not a final view of the diamond's beauty.",
        confidenceNote:
          "Justin can help confirm the next details and translate what they may mean for how the diamond will look.",
        conservativeNote,
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

  let tierLabel: string | null = null;
  let summary =
    "How large a diamond looks on the hand depends on its measurements and weight together — we'll describe that once both are clear from your report.";

  if (
    diameter !== null &&
    Number.isFinite(caratNum) &&
    caratNum > 0 &&
    Number.isFinite(diameter)
  ) {
    const expectedApprox = 6.4 + Math.cbrt(caratNum) * 2.2;
    const ratio = diameter / expectedApprox;
    const tier = resolveEditorialFaceUpTier(ratio);
    tierLabel = tier;
    summary = editorialFaceUpSummary(tier);
  } else if (input.measurements.trim()) {
    summary =
      "From the measurements on your report, this diamond's face-up size looks close to what most people expect for its weight.";
  }

  return {
    tierLabel,
    summary,
    footnote:
      "Face-up size is an interpretation from measurements and weight — not a separate laboratory grade.",
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
  copyTone?: DiamondCopyTone;
}): string {
  // Tone gate first — humble framing when data is incomplete.
  if (input.copyTone === "orientation") {
    return "This report gives a useful starting point. A fuller light-performance picture becomes available as more proportion detail is confirmed. Justin can help confirm the next details and translate what they may mean for how the diamond will look.";
  }
  if (input.copyTone === "careful") {
    return "Based on the information visible in the report, this diamond appears to have a balanced overall presentation. Additional diagram-level detail would improve confidence in the deeper optical read.";
  }

  const bucket = scoreBucket(
    input.clientScore?.overall ?? null,
    input.overallLabel,
  );
  const tone = traitTone(input.clientScore);

  const expertClose = input.needsExpertDiagramReview
    ? " Additional diagram-level optical detail would be best verified in an expert review rather than assumed here."
    : "";

  if (bucket === "exceptional" || bucket === "strong") {
    return `Based on the report information available, this diamond appears to show a balanced overall presentation with ${tone.fire} fire and ${tone.contrast} contrast. Its proportions suggest a favorable read for brightness and sparkle in everyday viewing.${expertClose}`;
  }

  if (bucket === "balanced") {
    return `This diamond appears to show a steady, balanced presentation — ${tone.brightness} brightness, ${tone.fire} fire, and ${tone.contrast} contrast working together without a single dramatic standout. That can still be very appealing in person; the report simply reads as middle-of-the-road on paper.${expertClose}`;
  }

  if (bucket === "mixed") {
    return `This diamond appears to show a mixed optical picture on paper — some traits read ${tone.brightness} while others are ${tone.scintillation} or ${tone.contrast}. That often means real-world beauty with tradeoffs worth understanding before you choose.${expertClose}`;
  }

  if (input.capability.interpretationLevel === "basic") {
    return `This report gives a useful starting point. A fuller light-performance picture becomes available as more proportion detail is confirmed. Justin can help you see what matters visually as additional details are confirmed.${expertClose}`;
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
