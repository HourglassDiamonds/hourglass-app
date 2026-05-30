import type { ClientLightTrait } from "./client-score-present";
import type { TraitDisplayLabel } from "./client-percentile-present";

export type ConsumerLightPerformanceDisplay = {
  /** Short phrase shown beside the trait name. */
  label: string;
  /** When true, hide the bar and show the uncertain helper. */
  uncertain: boolean;
};

export const CONSUMER_TRAIT_UNCERTAIN_HELPER =
  "Your report gives a helpful starting point here, but optical images or an in-person view would make this read clearer. The diamond may still look beautiful.";

type QualitativeTier = "strong" | "balanced" | "mixed" | "uncertain";

const CALM_UNCERTAIN_LABELS = new Set<TraitDisplayLabel>([
  "Diagram detail required",
  "Needs deeper optical review",
  "Best confirmed in person",
]);

const SCINTILLATION_UNCERTAIN_COPY =
  "The report does not fully reveal this diamond's sparkle pattern. Optical imagery can provide a clearer picture.";

function qualitativeTier(
  trait: ClientLightTrait,
  internalLabel: TraitDisplayLabel,
): QualitativeTier {
  if (CALM_UNCERTAIN_LABELS.has(internalLabel)) return "uncertain";
  if (
    internalLabel === "Needs review" ||
    trait.level === "Needs review" ||
    trait.fillPercent <= 0
  ) {
    return "uncertain";
  }
  if (internalLabel === "Mixed") return "mixed";
  if (internalLabel === "Balanced") return "balanced";
  return "strong";
}

const TRAIT_COPY: Record<
  string,
  Record<QualitativeTier, string>
> = {
  Brightness: {
    strong: "Expected to return light well in everyday viewing.",
    balanced: "Should appear evenly bright in most everyday lighting.",
    mixed: "Brightness may feel more noticeable in some lighting than others.",
    uncertain:
      "Optical images or video would help confirm how brightly this diamond returns light.",
  },
  Fire: {
    strong: "Expected to show lively flashes of color as the diamond moves.",
    balanced: "Color flashes should feel balanced rather than uneven.",
    mixed:
      "Color flashes may be more noticeable under some lighting than others.",
    uncertain:
      "Additional optical images would help verify how strongly this diamond separates light into flashes of color.",
  },
  Scintillation: {
    strong: "Expected to show lively sparkle as light moves across the stone.",
    balanced: "Sparkle should feel steady and pleasing in everyday viewing.",
    mixed: "Sparkle may feel more dynamic in some lighting than others.",
    uncertain: SCINTILLATION_UNCERTAIN_COPY,
  },
  Contrast: {
    strong:
      "The proportions suggest good visual definition between bright and dark areas.",
    balanced:
      "Bright and dark areas should feel well balanced for a natural, defined look.",
    mixed:
      "The balance of bright and dark areas may feel different under changing light.",
    uncertain:
      "Optical images would help confirm how crisply this diamond defines bright and dark areas.",
  },
  "Leakage control": {
    strong:
      "The available proportions do not suggest significant light loss, though optical imaging would provide stronger confirmation.",
    balanced:
      "Nothing in the available proportions strongly suggests light loss, though optical images would provide stronger confirmation.",
    mixed:
      "Some proportion signals suggest light may exit differently than ideal — worth confirming with optical images or expert review.",
    uncertain:
      "The report does not show enough detail to assess light retention confidently. Optical images would help.",
  },
};

function uncertainCopyForTrait(
  traitLabel: string,
  internalLabel: TraitDisplayLabel,
): string {
  if (traitLabel === "Scintillation") {
    return SCINTILLATION_UNCERTAIN_COPY;
  }
  return TRAIT_COPY[traitLabel]?.uncertain ?? TRAIT_COPY.Brightness!.uncertain;
}

/**
 * Translate internal trait read labels into short consumer-facing phrases.
 * Internal ratings and scoring are unchanged — display only.
 */
export function getConsumerLightPerformanceDisplay(
  trait: ClientLightTrait,
  internalLabel: TraitDisplayLabel,
): ConsumerLightPerformanceDisplay {
  const tier = qualitativeTier(trait, internalLabel);
  if (tier === "uncertain") {
    return {
      label: uncertainCopyForTrait(trait.label, internalLabel),
      uncertain: true,
    };
  }

  const table = TRAIT_COPY[trait.label];
  const label = table?.[tier] ?? table?.balanced ?? internalLabel;

  return { label, uncertain: false };
}

/** @deprecated Use getConsumerLightPerformanceDisplay — kept for direct label-only callers. */
export function getConsumerLightPerformanceLabel(
  trait: ClientLightTrait,
  internalLabel: TraitDisplayLabel,
): string {
  return getConsumerLightPerformanceDisplay(trait, internalLabel).label;
}
