import { finalizeRecommendation, rankRecommendations } from "./ranking";
import type { Recommendation } from "./types";

export type RecommendationDraft = Parameters<typeof finalizeRecommendation>[0];

export function buildRecommendation(
  draft: RecommendationDraft,
): Recommendation {
  return finalizeRecommendation(draft);
}

/**
 * Consolidate near-duplicate recommendations by normalized title + action.
 * Keeps the higher-priority item and marks others consolidated.
 */
export function consolidateDuplicates(
  items: Recommendation[],
): Recommendation[] {
  const ranked = rankRecommendations(items);
  const seen = new Map<string, Recommendation>();
  const consolidated: Recommendation[] = [];

  for (const item of ranked) {
    const key = normalizeKey(item.title, item.proposedAction);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
      consolidated.push(item);
      continue;
    }
    consolidated.push({
      ...item,
      status: "consolidated",
      agendaBucket: "ignore",
      priorityScore: 0,
      blockedReasons: [
        ...(item.blockedReasons ?? []),
        `Consolidated into ${existing.recommendationId}`,
      ],
    });
  }

  return rankRecommendations(
    consolidated.filter((r) => r.status !== "consolidated"),
  ).concat(consolidated.filter((r) => r.status === "consolidated"));
}

function normalizeKey(title: string, action: string): string {
  return `${title}||${action}`
    .toLowerCase()
    .replace(/[^a-z0-9|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
