/**
 * Content ROI weights — recalibratable without rewriting question records.
 *
 * Philosophy (founder editorial intelligence, not search-only SEO):
 * - Sales influence + brand differentiation dominate (Hourglass wins on trust/conversion)
 * - Search/discovery and cross-channel leverage stay high (flywheel economics)
 * - Conversation potential is moderate-high (long-form is costly but brand-defining)
 * - Strategic urgency is moderate-high (material gaps matter; not all uncovered = urgent)
 * - Short-form / evergreen / production efficiency are moderate
 * - Taste potential is optional/conditional — low overall weight; assignment is thresholded
 */

import type { ContentRoiWeights } from "./types";

export const CONTENT_ROI_WEIGHTS: ContentRoiWeights = {
  salesInfluence: 0.16,
  brandDifferentiation: 0.15,
  searchDiscovery: 0.12,
  crossChannelLeverage: 0.11,
  conversationPotential: 0.1,
  strategicUrgency: 0.1,
  shortFormPotential: 0.08,
  evergreenValue: 0.07,
  productionEfficiency: 0.07,
  tastePotential: 0.04,
};

export const CONTENT_ROI_WEIGHT_SUM = Object.values(CONTENT_ROI_WEIGHTS).reduce(
  (a, b) => a + b,
  0,
);

/** Founder-facing Content ROI packages surfaced into Content recommendations */
export const MAX_FOUNDER_FACING_CONTENT_ROI = 3;

/** Packages eligible for operating-backlog candidacy (not auto-inserted) */
export const MAX_BACKLOG_ELIGIBLE_PACKAGES = 5;

/** Minimum Conversation conceptual depth (conversationPotential 0–100) */
export const MIN_CONVERSATION_DEPTH = 58;

/** Minimum Taste potential before recommending a Taste episode */
export const MIN_TASTE_ASSIGNMENT = 55;

/** Overall ROI below this for uncovered questions → low-ROI bucket */
export const LOW_ROI_UNCOVERED_THRESHOLD = 42;

export function assertWeightsSumToOne(
  weights: ContentRoiWeights = CONTENT_ROI_WEIGHTS,
  epsilon = 1e-9,
): boolean {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1) <= epsilon;
}
