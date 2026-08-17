/**
 * Chief of Staff founder-ranking gate for Client Attention recommendations.
 */

import type { Recommendation } from "../../types";
import {
  CLIENT_ATTENTION_RECOMMENDATION_PREFIX,
  MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES,
} from "./types";
import { isClientAttentionRecommendationId } from "./recommendations";

/**
 * Cap Client Attention founder-facing recommendations (bounded, ~3).
 * Demote excess and non-actionable pattern noise; leave other executives untouched.
 */
export function applyClientAttentionFounderRankingGate(
  recommendations: Recommendation[],
): Recommendation[] {
  const client: Recommendation[] = [];
  const others: Recommendation[] = [];

  for (const rec of recommendations) {
    if (isClientAttentionRecommendationId(rec.recommendationId)) {
      client.push(rec);
    } else {
      others.push(rec);
    }
  }

  // Prefer already-ranked order (priorityScore)
  client.sort((a, b) => b.priorityScore - a.priorityScore);

  const kept = client.slice(0, MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES);
  const demoted = client.slice(MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES).map((r) => ({
    ...r,
    status: "downgraded" as const,
    agendaBucket: "monitor" as const,
    blockedReasons: [
      ...(r.blockedReasons ?? []),
      `Client Attention founder cap (${MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES})`,
    ],
  }));

  // Soft-demote low-confidence buyer-concern patterns from competing as top ROI
  const adjustedKept = kept.map((r) => {
    if (
      r.recommendationId.includes("buyer-concern-pattern") &&
      r.confidence < 0.7
    ) {
      return {
        ...r,
        status: "monitor" as const,
        agendaBucket: "monitor" as const,
        blockedReasons: [
          ...(r.blockedReasons ?? []),
          "Buyer-concern pattern below founder confidence bar",
        ],
      };
    }
    return r;
  });

  return [...others, ...adjustedKept, ...demoted];
}

export function clientAttentionPrefix(): string {
  return CLIENT_ATTENTION_RECOMMENDATION_PREFIX;
}
