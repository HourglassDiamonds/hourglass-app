/**
 * Historical anchors for System Temperature sanity checks.
 * Ranges are methodological guides, not false precision.
 */

import type { HistoricalAnchor } from "./types";

export const HISTORICAL_ANCHORS: readonly HistoricalAnchor[] = [
  {
    id: "ordinary-functioning",
    label: "Ordinary functioning environment",
    band: "normal",
    approxRange: [45, 55],
    requiredCharacteristics: [
      "Major systems absorb friction without unusual strain",
      "No broad confirmed transmission crisis",
    ],
    disqualifiers: [
      "Confirmed credit-market seizure",
      "Synchronized global shutdown",
    ],
  },
  {
    id: "elevated-functioning",
    label: "Elevated but functioning environment",
    band: "elevated",
    approxRange: [55, 70],
    requiredCharacteristics: [
      "Meaningful external pressure in one or more channels",
      "Markets and core systems still adaptive",
    ],
    disqualifiers: [
      "Systemic funding-market failure",
      "Widespread infrastructure collapse",
    ],
  },
  {
    id: "multi-system-stress",
    label: "Serious multi-system stress",
    band: "very-high",
    approxRange: [70, 85],
    requiredCharacteristics: [
      "Multiple channels under real pressure",
      "Documented downstream transmission beyond headlines",
    ],
  },
  {
    id: "march-2020-class",
    label: "March 2020-class acute systemic event",
    band: "severe",
    approxRange: [85, 94],
    requiredCharacteristics: [
      "Abrupt multi-system disruption",
      "Broad financial volatility and/or emergency intervention",
      "Immediate real-economy contraction signals",
    ],
  },
  {
    id: "crisis-2008-class",
    label: "2008 financial-crisis-class systemic dysfunction",
    band: "critical",
    approxRange: [95, 100],
    requiredCharacteristics: [
      "Confirmed systemic dysfunction or institutional failure",
      "Credit/funding seizure or equivalent loss of normal function",
    ],
  },
] as const;
