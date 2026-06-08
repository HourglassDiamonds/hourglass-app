import type { ProfileAxis } from "@/lib/diamond-intelligence/client-balance-profile";
import type { ClientLightTrait } from "@/lib/diamond-intelligence/client-score-present";
import type { ClarityReviewGuidance } from "@/lib/diamond-intelligence/clarity-review-guidance";
import type { DiamondDecisionProfile } from "@/lib/diamond-intelligence/diamond-decision-profile";
import type { DiamondPurchasePersonality } from "@/lib/diamond-intelligence/diamond-purchase-personality";
import type { FaceUpPresenceCopy } from "@/lib/diamond-intelligence/client-performance-copy";
import { humanizeStrengthLabel } from "./consumer-display-labels";
function traitStrengthLabel(trait: ClientLightTrait): string | null {
  if (trait.level !== "Strong" || trait.fillPercent <= 0) return null;
  const base = trait.label.toLowerCase();
  if (base.includes("leakage")) return "Well-controlled light leakage";
  return `Strong ${base}`;
}

function axisStrengthLabel(axis: ProfileAxis): string | null {
  if (axis.uncertain || axis.value === null || axis.value < 72) return null;
  if (axis.key === "spread") {
    return axis.value >= 78 ? "Generous face-up spread" : "Balanced spread";
  }
  if (axis.key === "balance") return "Harmonious overall balance";
  if (axis.key === "leakage") return "Well-controlled light leakage";
  return `Strong ${axis.label.toLowerCase()}`;
}

export function buildAdvisoryHighlights(input: {
  lightTraits: ClientLightTrait[];
  profileAxes: ProfileAxis[];
  decisionProfile: DiamondDecisionProfile;
  purchasePersonality: DiamondPurchasePersonality;
  clarityReviewGuidance: ClarityReviewGuidance | null;
  faceUpCopy: FaceUpPresenceCopy | null;
  fluorescence?: string;
}): { strengths: string[]; worthKnowing: string[] } {
  const strengths = new Set<string>();
  const worthKnowing = new Set<string>();

  for (const trait of input.lightTraits) {
    const label = traitStrengthLabel(trait);
    if (label) strengths.add(label);
  }

  for (const axis of input.profileAxes) {
    const label = axisStrengthLabel(axis);
    if (label) strengths.add(label);
  }

  const optical = input.decisionProfile.opticalPerformance.band;
  if (optical === "Strong" || optical === "Solid") {
    strengths.add(`${optical} optical architecture`);
  }

  for (const item of input.purchasePersonality.why.slice(0, 2)) {
    strengths.add(item);
  }

  const limitation = input.decisionProfile.primaryLimitingFactor.display;
  if (
    limitation &&
    limitation !== "No Significant Concerns Identified"
  ) {
    worthKnowing.add(`Primary consideration: ${limitation}`);
  }

  if (input.purchasePersonality.watchOutFor) {
    worthKnowing.add(input.purchasePersonality.watchOutFor);
  }

  if (input.clarityReviewGuidance?.show) {
    worthKnowing.add(input.clarityReviewGuidance.body);
  }

  if (
    input.faceUpCopy?.tierLabel &&
    (input.faceUpCopy.tierLabel.includes("Focused") ||
      input.faceUpCopy.tierLabel.includes("Compact"))
  ) {
    worthKnowing.add(input.faceUpCopy.summary);
  }

  const fluo = input.fluorescence?.trim();
  if (fluo && !/^none$/i.test(fluo)) {
    worthKnowing.add(`${fluo} fluorescence present on the report`);
  }

  if (input.decisionProfile.confidence.band === "Low") {
    worthKnowing.add(input.decisionProfile.confidence.explanation);
  }

  if (strengths.size === 0) {
    strengths.add("Report proportions reviewed in a consistent, lab-neutral way");
  }

  return {
    strengths: [...strengths].map(humanizeStrengthLabel).slice(0, 5),
    worthKnowing: [...worthKnowing].slice(0, 5),
  };
}
