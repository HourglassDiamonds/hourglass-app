import { getExecutive } from "../registry";
import type { ExecutiveDefinition } from "../types";

/** Scaffold-only executives — contracts and missions, no recommendations. */
export function getSearchStrategyContract(): ExecutiveDefinition {
  return getExecutive("search-strategy");
}

export function getContentContract(): ExecutiveDefinition {
  return getExecutive("content");
}

export function getOpportunityContract(): ExecutiveDefinition {
  return getExecutive("opportunity");
}

export function assertScaffoldCannotRecommend(
  executiveId: "search-strategy" | "content" | "opportunity",
): never {
  throw new Error(
    `Executive "${executiveId}" is scaffold-only in Agent OS V1 and cannot generate recommendations.`,
  );
}
