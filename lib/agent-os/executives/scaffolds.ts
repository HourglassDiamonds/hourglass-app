import { getExecutive } from "../registry";
import type { ExecutiveDefinition } from "../types";

/** Contract accessors for executives (all five are operational in V1 after Opportunity). */
export function getSearchStrategyContract(): ExecutiveDefinition {
  return getExecutive("search-strategy");
}

export function getContentContract(): ExecutiveDefinition {
  return getExecutive("content");
}

export function getOpportunityContract(): ExecutiveDefinition {
  return getExecutive("opportunity");
}

/**
 * Historical scaffold guard — Opportunity is now operational.
 * Throws so callers cannot treat Opportunity as scaffold-only.
 */
export function assertScaffoldCannotRecommend(
  executiveId: "opportunity",
): never {
  throw new Error(
    `Executive "${executiveId}" is operational in Agent OS V1 — use runOpportunityExecutive instead of scaffold-only accessors.`,
  );
}
