/**
 * Historical terminal bootstrap from static CURRENT_OPERATING_BACKLOG.
 *
 * Migration/reconciliation only: insert-if-absent into durable persistence.
 * Never overwrites existing lifecycle records (including reopened / dismissed).
 */

import type { OperatingBacklog, OperatingBacklogItem } from "../operating-backlog/types";
import {
  canonicalIdForBacklogItem,
  operatingBacklogRecommendationId,
} from "../operating-backlog/canonical";
import type { AgentOsPersistedState } from "./types";
import {
  applyRecommendationTerminalState,
  type TerminalRecommendationStatus,
} from "./mark-terminal";

export type BootstrapSkipReason =
  | "not-static-terminal"
  | "existing-record"
  | "canonical-match-exists";

export type BootstrapSkip = {
  recommendationId: string;
  reason: BootstrapSkipReason;
  existingLifecycle?: string;
};

export type BootstrapHistoricalTerminalsResult = {
  state: AgentOsPersistedState;
  insertedIds: string[];
  skipped: BootstrapSkip[];
  changed: boolean;
};

function staticTerminalStatus(
  item: OperatingBacklogItem,
): TerminalRecommendationStatus | null {
  if (item.status === "completed") return "completed";
  if (item.status === "cancelled") return "dismissed";
  if (item.status === "replaced") return "superseded";
  return null;
}

function findExistingForItem(
  state: AgentOsPersistedState,
  itemId: string,
): { recommendationId: string; lifecycleState: string } | null {
  const recId = operatingBacklogRecommendationId(itemId);
  const direct = state.recommendations[recId];
  if (direct) {
    return {
      recommendationId: recId,
      lifecycleState: direct.lifecycleState,
    };
  }
  const canonical = canonicalIdForBacklogItem(itemId);
  for (const record of Object.values(state.recommendations)) {
    if (record.rootProblemId === canonical) {
      return {
        recommendationId: record.recommendationId,
        lifecycleState: record.lifecycleState,
      };
    }
  }
  return null;
}

/**
 * Insert durable terminal records for static completed/cancelled/replaced
 * backlog items that have never been persisted.
 *
 * Idempotent:
 * - existing ID → skip (any lifecycle, including reopened/active)
 * - existing canonical match → skip
 * - does not rewrite completedAt, notes, or evidence on existing records
 * - does not emit completion events for skips
 */
export function bootstrapHistoricalTerminalsFromStaticBacklog(
  state: AgentOsPersistedState,
  backlog: OperatingBacklog,
  options?: { nowIso?: string },
): BootstrapHistoricalTerminalsResult {
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const items = [
    ...backlog.masterSprint.items,
    ...backlog.deferred,
    ...backlog.recurring,
  ];

  let next = state;
  const insertedIds: string[] = [];
  const skipped: BootstrapSkip[] = [];

  for (const item of items) {
    const terminalStatus = staticTerminalStatus(item);
    const recId = operatingBacklogRecommendationId(item.id);
    if (!terminalStatus) {
      skipped.push({ recommendationId: recId, reason: "not-static-terminal" });
      continue;
    }

    const existing = findExistingForItem(next, item.id);
    if (existing) {
      skipped.push({
        recommendationId: recId,
        reason:
          existing.recommendationId === recId
            ? "existing-record"
            : "canonical-match-exists",
        existingLifecycle: existing.lifecycleState,
      });
      continue;
    }

    const applied = applyRecommendationTerminalState(next, {
      recommendationId: recId,
      status: terminalStatus,
      source: "system-reconciled",
      nowIso,
      note: `Historical bootstrap from static operating backlog (${item.status})`,
      evidenceReference: `operating-backlog://${item.id}`,
      currentAction: item.action,
      urgency: item.urgency,
      supersededBy:
        terminalStatus === "superseded"
          ? `replaced:static-backlog:${item.id}`
          : terminalStatus === "dismissed"
            ? `dismissed:system-reconciled`
            : null,
    });
    next = applied.state;
    insertedIds.push(recId);
  }

  return {
    state: next,
    insertedIds,
    skipped: skipped.filter((s) => s.reason !== "not-static-terminal"),
    changed: insertedIds.length > 0,
  };
}
