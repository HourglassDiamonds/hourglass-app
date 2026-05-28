import type { ClientLightTrait } from "./client-score-present";

export const ESTIMATED_COMPARISON_BAND_CAPTION =
  "Estimated comparison band";

export type OverallReadLabel =
  | "Top 0.5%"
  | "Top 1%"
  | "Top 5%"
  | "Strong"
  | "Balanced"
  | "Mixed"
  | "Needs review";

export type TraitReadLabel =
  | "Rare · Top 0.5%"
  | "Exceptional · Top 1%"
  | "Elite · Top 5%"
  | "Strong"
  | "Balanced"
  | "Mixed"
  | "Needs review";

/** Calm client-facing labels when a trait cannot be inferred without guessing. */
export type TraitCalmLabel =
  | "Diagram detail required"
  | "Needs deeper optical review"
  | "Best confirmed in person";

export type TraitDisplayLabel = TraitReadLabel | TraitCalmLabel;

const DIAGRAM_SENSITIVE_TRAITS = new Set(["Scintillation", "Leakage control"]);

export type TraitLabelContext = {
  needsExpertDiagramReview?: boolean;
};

export type RareTopPill = "Top 0.5%" | "Top 1%" | "Top 5%";

export type OverallReadPresentation = {
  label: OverallReadLabel;
  showRarePill: boolean;
  pillText: RareTopPill | null;
};

function finiteScore(score: number | null | undefined): number | null {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return null;
  }
  return score;
}

function overallLabelFromScore(score: number): OverallReadLabel {
  if (score >= 99) return "Top 0.5%";
  if (score >= 97) return "Top 1%";
  if (score >= 94) return "Top 5%";
  if (score >= 88) return "Strong";
  if (score >= 82) return "Balanced";
  if (score >= 75) return "Mixed";
  return "Needs review";
}

function isRareTopLabel(
  label: OverallReadLabel,
): label is RareTopPill {
  return label === "Top 0.5%" || label === "Top 1%" || label === "Top 5%";
}

/** Overall Performance Read — pill only for Top 5% or better. */
export function presentOverallReadLabel(
  score: number | null | undefined,
): OverallReadPresentation {
  const s = finiteScore(score);
  if (s === null) {
    return {
      label: "Needs review",
      showRarePill: false,
      pillText: null,
    };
  }
  const label = overallLabelFromScore(s);
  const showRarePill = isRareTopLabel(label);
  return {
    label,
    showRarePill,
    pillText: showRarePill ? label : null,
  };
}

function qualitativeTraitFromScore(score: number): TraitReadLabel {
  if (score >= 88) return "Strong";
  if (score >= 82) return "Balanced";
  if (score >= 75) return "Mixed";
  return "Needs review";
}

function rawTraitLabelFromScore(score: number): TraitReadLabel {
  if (score >= 99) return "Rare · Top 0.5%";
  if (score >= 97) return "Exceptional · Top 1%";
  if (score >= 94) return "Elite · Top 5%";
  return qualitativeTraitFromScore(score);
}

/**
 * Trait read with coherence vs overall score — suppresses rare Top % labels
 * when they would read stronger than the overall interpretation.
 */
function calmLabelForUncertainTrait(
  trait: ClientLightTrait,
  context?: TraitLabelContext,
): TraitCalmLabel {
  if (
    context?.needsExpertDiagramReview &&
    DIAGRAM_SENSITIVE_TRAITS.has(trait.label)
  ) {
    return "Diagram detail required";
  }
  if (DIAGRAM_SENSITIVE_TRAITS.has(trait.label)) {
    return "Needs deeper optical review";
  }
  return "Best confirmed in person";
}

export function presentTraitReadLabel(
  trait: ClientLightTrait,
  overallScore: number | null | undefined,
  context?: TraitLabelContext,
): TraitDisplayLabel {
  if (trait.level === "Needs review" || trait.fillPercent <= 0) {
    return calmLabelForUncertainTrait(trait, context);
  }

  const traitScore = trait.fillPercent;
  const overall = finiteScore(overallScore);

  if (overall === null) {
    if (traitScore >= 94) return rawTraitLabelFromScore(traitScore);
    return qualitativeTraitFromScore(traitScore);
  }

  if (overall < 88) {
    return qualitativeTraitFromScore(traitScore);
  }

  if (overall < 94) {
    if (traitScore >= 94) return "Elite · Top 5%";
    return qualitativeTraitFromScore(traitScore);
  }

  if (overall < 97) {
    if (traitScore >= 97) return "Exceptional · Top 1%";
    if (traitScore >= 94) return "Elite · Top 5%";
    return qualitativeTraitFromScore(traitScore);
  }

  return rawTraitLabelFromScore(traitScore);
}

export function formatTraitReadDisplay(
  trait: ClientLightTrait,
  overallScore: number | null | undefined,
  context?: TraitLabelContext,
): string {
  return presentTraitReadLabel(trait, overallScore, context);
}
