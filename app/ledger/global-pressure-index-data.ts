/**
 * Global Pressure Index — category weights, scoring, and methodology.
 *
 * Scoring philosophy (July 27, 2026 recalibration):
 * 1. Current pressure and trajectory are separate — the temperature measures
 *    pressure already transmitted into the system; escalation potential is
 *    communicated through direction language, not by inflating the reading.
 * 2. Prevent double counting — a single event may affect several categories,
 *    but should not automatically receive near-crisis scores in every category.
 * 3. Reserve 90°+ for confirmed systemic transmission (credit/funding stress,
 *    market dysfunction, synchronized contraction, sustained shortages,
 *    widespread infrastructure failure, extraordinary intervention, or
 *    major institutional breakdown).
 * 4. Reserve the upper 90s for collapse-level environments (2008 ≈ 96°,
 *    March 2020 ≈ 91°). Dangerous geopolitics without comparable transmission
 *    should remain below those benchmarks.
 *
 * ARCHIVED NUMERICAL SERIES — not rendered on the public Global Pressure
 * Monitor. Category scores remain for rebuild / historical testing. When the
 * revised methodology ships, derive the public reading from the weighted sum —
 * do not hard-code a total that can drift from components.
 */

export type GpiCategoryId =
  | "geopolitics"
  | "energy"
  | "financial"
  | "infrastructure"
  | "supply-chains"
  | "social";

export type GpiCategory = {
  id: GpiCategoryId;
  name: string;
  /** Decimal weight (sums to 1) */
  weight: number;
  score: number;
  reason: string;
};

/** Six-category weighting structure — edit scores weekly; reading is computed. */
export const GPI_CATEGORIES: readonly GpiCategory[] = [
  {
    id: "geopolitics",
    name: "Geopolitics",
    weight: 0.2,
    score: 96,
    reason:
      "Escalation around critical shipping corridors, attacks on energy infrastructure, and contested export routes remain near the extreme end of the scale.",
  },
  {
    id: "energy",
    name: "Energy and commodities",
    weight: 0.2,
    score: 94,
    reason:
      "Energy-corridor disruption and elevated oil risk continue to raise the chance of a broader inflationary and supply shock.",
  },
  {
    id: "financial",
    name: "Financial system",
    weight: 0.2,
    score: 58,
    reason:
      "Credit markets remain functional, spreads comparatively contained, and broader financial-stress measures below crisis levels — the primary offset to geopolitical heat.",
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    weight: 0.15,
    score: 87,
    reason:
      "Physical systems face elevated load and corridor-adjacent strain, but without confirmed widespread infrastructure failure.",
  },
  {
    id: "supply-chains",
    name: "Supply chains",
    weight: 0.15,
    score: 88,
    reason:
      "Shipping disruption is material on energy corridors; transmission into manufacturing, freight, and final-goods availability remains incomplete.",
  },
  {
    id: "social",
    name: "Social stability and coordination",
    weight: 0.1,
    score: 82,
    reason:
      "Coordination strain is elevated under geopolitical and energy pressure, without a synchronized institutional breakdown.",
  },
] as const;

/** Exact weighted sum before public rounding (e.g. 84.05 → ~84.1). */
export function computeGpiWeightedTotal(
  categories: readonly GpiCategory[] = GPI_CATEGORIES,
): number {
  return categories.reduce(
    (sum, category) => sum + category.weight * category.score,
    0,
  );
}

/** Public temperature — derived from category scores. */
export function computeGpiReading(
  categories: readonly GpiCategory[] = GPI_CATEGORIES,
): number {
  return Math.round(computeGpiWeightedTotal(categories));
}

export const GPI_WEIGHTED_TOTAL = computeGpiWeightedTotal();
export const GPI_COMPUTED_READING = computeGpiReading();

export const GPI_CALCULATION_ROWS = GPI_CATEGORIES.map((category) => ({
  category: category.name,
  weight: `${Math.round(category.weight * 100)}%`,
  score: String(category.score),
  contribution: (category.weight * category.score).toFixed(1),
  reason: category.reason,
}));

export const GPI_CALCULATION_TOTAL = {
  contribution: `${GPI_WEIGHTED_TOTAL.toFixed(1)} → ${GPI_COMPUTED_READING}°`,
  reason:
    "High heat with concentrated pressure — geopolitics and energy near extremes, offset by functioning credit markets and continued economic expansion.",
} as const;

/** Date the recalibrated series begins. Historical readings before this remain as published. */
export const GPI_RECALIBRATION_DATE = "July 27, 2026";

export const GPI_CALIBRATION_NOTE = {
  title: `Methodology recalibration — ${GPI_RECALIBRATION_DATE}`,
  body: "The Global Pressure Index has been recalibrated to more clearly separate current system pressure from future escalation risk. Earlier readings could give disproportionate weight to a single event affecting several related categories. The updated methodology places greater emphasis on confirmed transmission into credit markets, economic activity, infrastructure, supply availability, or institutional stability. Historical readings remain visible as originally published. The current reading marks the beginning of the recalibrated series.",
} as const;

export const GPI_METHODOLOGY_PRINCIPLES = [
  {
    title: "Current pressure and trajectory are separate",
    body: "The temperature measures pressure that has already transmitted into the system. Future danger, acceleration, escalation potential, and directional risk are communicated separately through language such as rising, high and unstable, escalation risk, cooling, improving, or deteriorating — not by raising the current reading solely because a severe future outcome is possible.",
  },
  {
    title: "Prevent double counting",
    body: "A single event may affect several categories, but it should not automatically receive near-crisis scores in every category. A shipping-corridor conflict may justify very high geopolitical and energy scores; an equally extreme financial-system score requires measurable transmission such as material credit-spread widening, distress-level volatility, funding-market malfunction, disappearing liquidity, emergency central-bank intervention, or major institutional failures. The same principle applies to infrastructure, supply chains, economic activity, and social stability.",
  },
  {
    title: "Reserve 90° and above for confirmed systemic transmission",
    body: "A reading above 90° should generally require at least one materially active system-level failure channel: broad credit or funding stress, major financial-market dysfunction, synchronized economic contraction, sustained physical shortages across multiple industries, widespread infrastructure failure, extraordinary government or central-bank intervention, or major institutional breakdown.",
  },
  {
    title: "Reserve the upper 90s for collapse-level environments",
    body: "The 2008 financial collapse remains near 96° because it involved institutional failures, frozen credit and funding markets, emergency rescues, severe economic contraction, and broad financial-system transmission. March 2020 remains near 91° because it involved abrupt worldwide shutdowns, extreme financial volatility, severe labor-market disruption, emergency monetary and fiscal intervention, and immediate global economic contraction. A dangerous geopolitical event without comparable transmission should remain below those benchmarks.",
  },
] as const;

export const GPI_METHODOLOGY_SHORT =
  "See methodology recalibration — current pressure is scored on confirmed transmission; escalation risk is stated separately in direction language.";
