/**
 * Operating backlog loader.
 * Default = CURRENT_OPERATING_BACKLOG. Optional override for tests.
 * Persistence overlays terminal lifecycle via hydrateOperatingBacklogFromPersistence.
 */

import { CURRENT_OPERATING_BACKLOG } from "./current-sprint";
import type { OperatingBacklog } from "./types";

export type LoadOperatingBacklogOptions = {
  /** Explicit override (tests / preview). */
  override?: OperatingBacklog | null;
};

export function loadOperatingBacklog(
  options: LoadOperatingBacklogOptions = {},
): OperatingBacklog {
  if (options.override) return options.override;
  return CURRENT_OPERATING_BACKLOG;
}

export { CURRENT_OPERATING_BACKLOG } from "./current-sprint";
export { activeBacklogItems } from "./current-sprint";
export {
  recommendationsFromOperatingBacklog,
  decisionRecommendationsFromBacklog,
  backlogOrientationSummary,
} from "./to-recommendations";
export {
  operatingBacklogRecommendationId,
  canonicalIdForBacklogItem,
  canonicalIdForRecommendationId,
  OPERATING_BACKLOG_CANONICAL_IDS,
} from "./canonical";
export {
  hydrateOperatingBacklogFromPersistence,
  findTerminalMatch,
  isPersistedRecommendationTerminal,
  deriveDayOrientationFromBacklog,
} from "./hydrate";
export type {
  HydrateOperatingBacklogResult,
  BacklogHydrationDecision,
} from "./hydrate";
export type {
  OperatingBacklog,
  OperatingBacklogItem,
  MasterSprint,
  BacklogItemKind,
  BacklogItemStatus,
} from "./types";
