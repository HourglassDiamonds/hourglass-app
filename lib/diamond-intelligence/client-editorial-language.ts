import type { OverallReadLabel } from "./client-percentile-present";

/** Consumer-facing Light Performance tier — display only. */
export type EditorialLightPerformanceTier =
  | "Distinctive"
  | "Strong"
  | "Balanced"
  | "Nuanced"
  | "Open";

/** Consumer-facing Face-Up Presence tier — display only. */
export type EditorialFaceUpTier =
  | "Expansive Presence"
  | "Generous Presence"
  | "Balanced Presence"
  | "Compact Presence"
  | "Focused Presence";

const LIGHT_PERFORMANCE_PERSONALITY: Record<
  EditorialLightPerformanceTier,
  string
> = {
  Distinctive:
    "An unusual, confident optical personality — likely to feel lively and memorable in everyday light.",
  Strong:
    "A clear, harmonious read — brightness and fire should feel balanced and engaging.",
  Balanced:
    "A steady middle-ground optical story — neither flashy nor flat on paper.",
  Nuanced:
    "Mixed optical signals — some traits read clearly while others trade off with lighting or angle.",
  Open:
    "This is an early read from what your report shows today — useful context now, with more detail available as additional information is confirmed.",
};

const FACE_UP_TIER_SUMMARIES: Record<EditorialFaceUpTier, string> = {
  "Expansive Presence":
    "This diamond faces up noticeably larger than many diamonds of similar weight.",
  "Generous Presence":
    "This diamond may appear slightly larger than many diamonds of similar weight.",
  "Balanced Presence":
    "This diamond faces up close to what most people expect for its weight.",
  "Focused Presence":
    "This diamond may appear slightly smaller than many diamonds of similar weight, with a more concentrated look on the hand.",
  "Compact Presence":
    "This diamond prioritizes depth slightly over visible spread and may appear a bit smaller than some diamonds of similar weight.",
};

/** Map internal overall read label to consumer editorial tier — no scoring changes. */
export function editorialTierFromInternalLabel(
  internalLabel: string,
  opts: { canShowScore: boolean },
): EditorialLightPerformanceTier {
  if (!opts.canShowScore || internalLabel === "Report read") {
    return "Open";
  }
  if (internalLabel.startsWith("Top")) {
    return "Distinctive";
  }
  switch (internalLabel) {
    case "Strong":
      return "Strong";
    case "Balanced":
      return "Balanced";
    case "Mixed":
      return "Nuanced";
    case "Needs review":
      return "Open";
    default:
      return "Open";
  }
}

export function editorialLightPerformancePersonality(
  tier: EditorialLightPerformanceTier,
): string {
  return LIGHT_PERFORMANCE_PERSONALITY[tier];
}

export type EditorialLightPerformancePresentation = {
  tier: EditorialLightPerformanceTier;
  tierLabel: string;
  personalityDescriptor: string;
  /** Neutral editorial pill text, or null when no tier badge should show. */
  editorialPill: string | null;
  graphCenterLabel: string;
};

/** Consumer presentation for hero score, pill, and graph center — display only. */
export function presentEditorialLightPerformance(input: {
  internalLabel: string;
  displayBand: string | null;
  canShowScore: boolean;
  canShowRareLanguage: boolean;
}): EditorialLightPerformancePresentation {
  const tier = editorialTierFromInternalLabel(input.internalLabel, {
    canShowScore: input.canShowScore,
  });
  const personalityDescriptor = editorialLightPerformancePersonality(tier);

  const editorialPill =
    !input.canShowScore || tier === "Open"
      ? null
      : tier === "Distinctive"
        ? input.canShowRareLanguage && input.displayBand
          ? tier
          : null
        : tier;

  return {
    tier,
    tierLabel: tier,
    personalityDescriptor,
    editorialPill,
    graphCenterLabel: tier,
  };
}

/** Resolve face-up tier from spread ratio — same ratio math as buildFaceUpPresenceCopy. */
export function resolveEditorialFaceUpTier(
  ratio: number,
): EditorialFaceUpTier {
  if (ratio >= 1.05) return "Expansive Presence";
  if (ratio >= 1.03) return "Generous Presence";
  if (ratio >= 0.99) return "Balanced Presence";
  if (ratio >= 0.97) return "Focused Presence";
  return "Compact Presence";
}

export function editorialFaceUpSummary(tier: EditorialFaceUpTier): string {
  return FACE_UP_TIER_SUMMARIES[tier];
}

/** Type-safe helper for copy builders that already hold an OverallReadLabel. */
export function editorialTierFromOverallLabel(
  label: OverallReadLabel,
  canShowScore = true,
): EditorialLightPerformanceTier {
  return editorialTierFromInternalLabel(label, { canShowScore });
}
