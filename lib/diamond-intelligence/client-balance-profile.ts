import type { ClientInterpretationScore, ClientLightTrait } from "./client-score-present";
import type { ClientInterpretationConfidenceLevel } from "./client-interpretation-confidence";
import type { OverallReadLabel } from "./client-percentile-present";

export type ProfileAxisKey =
  | "brightness"
  | "fire"
  | "contrast"
  | "spread"
  | "leakage"
  | "balance";

export type ProfileAxis = {
  key: ProfileAxisKey;
  label: string;
  /** 0–100 radius scale; null = not enough data to plot confidently. */
  value: number | null;
  uncertain: boolean;
};

const REFERENCE_ENVELOPE = 82;

function traitByLabel(
  traits: ClientLightTrait[],
  label: string,
): ClientLightTrait | undefined {
  return traits.find((t) => t.label === label);
}

function axisFromTrait(trait: ClientLightTrait | undefined): {
  value: number | null;
  uncertain: boolean;
} {
  if (!trait || trait.fillPercent <= 0 || trait.level === "Needs review") {
    return { value: null, uncertain: true };
  }
  return { value: Math.min(100, trait.fillPercent), uncertain: false };
}

/** Display-only spread proxy from face-up measurements — not a scored dimension. */
export function spreadProfileValue(input: {
  avgDiameterMm: number | null;
  carat: string;
}): { value: number | null; uncertain: boolean } {
  const caratNum = parseFloat(input.carat.replace(/[^\d.]/g, ""));
  const diameter = input.avgDiameterMm;
  if (
    diameter === null ||
    !Number.isFinite(caratNum) ||
    caratNum <= 0 ||
    !Number.isFinite(diameter)
  ) {
    return { value: null, uncertain: true };
  }
  const expectedApprox = 6.4 + Math.cbrt(caratNum) * 2.2;
  const ratio = diameter / expectedApprox;
  const value = Math.min(100, Math.max(45, Math.round(72 + (ratio - 1) * 28)));
  return { value, uncertain: false };
}

/** Client-safe performance profile axes for the balance graph — display only. */
export function buildBalanceProfileAxes(input: {
  clientScore: ClientInterpretationScore | null;
  overallScore: number | null;
  spread: { value: number | null; uncertain: boolean };
}): ProfileAxis[] {
  const traits = input.clientScore?.lightTraits ?? [];

  const brightness = axisFromTrait(traitByLabel(traits, "Brightness"));
  const fire = axisFromTrait(traitByLabel(traits, "Fire"));
  const contrast = axisFromTrait(traitByLabel(traits, "Contrast"));
  const leakage = axisFromTrait(traitByLabel(traits, "Leakage control"));

  const balanceUncertain =
    !input.clientScore?.eligible ||
    input.overallScore === null ||
    !Number.isFinite(input.overallScore);

  return [
    { key: "brightness", label: "Brightness", ...brightness },
    { key: "fire", label: "Fire", ...fire },
    { key: "contrast", label: "Contrast", ...contrast },
    { key: "spread", label: "Spread", ...input.spread },
    { key: "leakage", label: "Leakage", ...leakage },
    {
      key: "balance",
      label: "Balance",
      value: balanceUncertain
        ? null
        : Math.min(100, Math.round(input.overallScore!)),
      uncertain: balanceUncertain,
    },
  ];
}

export function referenceEnvelopeRadius(maxRadius: number): number {
  return (REFERENCE_ENVELOPE / 100) * maxRadius;
}

export function centerQualitativeLabel(label: OverallReadLabel): string {
  if (label.startsWith("Top")) return "Exceptional";
  return label;
}

/**
 * Central graph label gated by display confidence.
 *  - high:   the qualitative read (Exceptional / Strong / Balanced …)
 *  - medium: "Preliminary" — restrained, no rare claims
 *  - low:    "Needs detail" — visually reads as incomplete, not poor
 */
export function confidenceCenterLabel(
  level: ClientInterpretationConfidenceLevel,
  cappedLabel: OverallReadLabel,
): string {
  if (level === "high") return centerQualitativeLabel(cappedLabel);
  if (level === "medium") return "Preliminary";
  return "Needs detail";
}
