/**
 * Hydrate operating backlog statuses from durable recommendation lifecycle.
 *
 * Precedence (highest wins):
 * 1. Explicit persisted reopen → active
 * 2. Persisted terminal (completed / dismissed / superseded)
 * 3. Explicit founder/ops terminal already in persistence (same as 2)
 * 4. Static CURRENT_OPERATING_BACKLOG defaults (only when no persisted record)
 *
 * Durable lifecycle always beats static backlog defaults.
 * A static `active` item never resurrects a persisted terminal item.
 * A persisted reopen is never re-completed by static `completed` or historical bootstrap.
 */

import type {
  OperatingBacklog,
  OperatingBacklogItem,
  BacklogItemStatus,
} from "./types";
import {
  canonicalIdForBacklogItem,
  operatingBacklogRecommendationId,
} from "./canonical";
import type {
  LifecycleState,
  PersistedRecommendationRecord,
} from "../persistence/types";
import { isTerminalLifecycle } from "../persistence/lifecycle";
import { logRecommendationLifecycleEvent } from "../persistence/lifecycle-log";

export type BacklogHydrationDecision = {
  itemId: string;
  recommendationId: string;
  canonicalId: string;
  priorStatus: BacklogItemStatus;
  nextStatus: BacklogItemStatus;
  matchedTerminalId: string | null;
  suppressed: boolean;
  reopened: boolean;
  reason: string;
};

export type HydrateOperatingBacklogResult = {
  backlog: OperatingBacklog;
  decisions: BacklogHydrationDecision[];
};

function isReopenedRecord(record: PersistedRecommendationRecord): boolean {
  return (
    record.changeClassification === "reopened" &&
    record.lifecycleState === "active"
  );
}

function terminalBacklogStatus(
  record: PersistedRecommendationRecord,
): BacklogItemStatus | null {
  if (isReopenedRecord(record)) return null;
  if (record.lifecycleState === "completed") return "completed";
  if (record.lifecycleState === "superseded" || record.supersededBy) {
    if (record.supersededBy?.startsWith("dismissed:")) return "cancelled";
    return "replaced";
  }
  // completedAt alone is historical after reopen — only honor with terminal lifecycle.
  if (record.completedAt && isTerminalLifecycle(record.lifecycleState)) {
    return "completed";
  }
  if (isTerminalLifecycle(record.lifecycleState)) {
    return "completed";
  }
  return null;
}

/**
 * Resolve the authoritative persisted record for a backlog item (ID or canonical).
 */
export function findPersistedRecordForBacklogItem(
  itemId: string,
  prior: Record<string, PersistedRecommendationRecord>,
): PersistedRecommendationRecord | null {
  const recId = operatingBacklogRecommendationId(itemId);
  const direct = prior[recId];
  if (direct) return direct;

  const canonical = canonicalIdForBacklogItem(itemId);
  for (const record of Object.values(prior)) {
    if (record.rootProblemId === canonical) return record;
  }
  return null;
}

/**
 * Find a terminal persisted record matching this backlog item by ID or canonical root.
 * Skips explicitly reopened records.
 */
export function findTerminalMatch(
  itemId: string,
  prior: Record<string, PersistedRecommendationRecord>,
): PersistedRecommendationRecord | null {
  const record = findPersistedRecordForBacklogItem(itemId, prior);
  if (!record) return null;
  if (isReopenedRecord(record)) return null;
  if (terminalBacklogStatus(record)) return record;
  return null;
}

function mapItem(
  item: OperatingBacklogItem,
  prior: Record<string, PersistedRecommendationRecord>,
  decisions: BacklogHydrationDecision[],
): OperatingBacklogItem {
  const recommendationId = operatingBacklogRecommendationId(item.id);
  const canonicalId = canonicalIdForBacklogItem(item.id);
  const persisted = findPersistedRecordForBacklogItem(item.id, prior);

  // 1–3: Durable persisted state wins over static defaults.
  if (persisted) {
    if (isReopenedRecord(persisted)) {
      decisions.push({
        itemId: item.id,
        recommendationId,
        canonicalId,
        priorStatus: item.status,
        nextStatus: "active",
        matchedTerminalId: null,
        suppressed: false,
        reopened: true,
        reason: "persisted-reopened-beats-static",
      });
      logRecommendationLifecycleEvent("recommendation_reopened", {
        recommendationId,
        canonicalId,
        lifecycleState: "active",
        priorLifecycle: persisted.previousLifecycle,
        reason: "hydrate-honors-persisted-reopen",
      });
      return { ...item, status: "active" };
    }

    const terminalStatus = terminalBacklogStatus(persisted);
    if (terminalStatus) {
      decisions.push({
        itemId: item.id,
        recommendationId,
        canonicalId,
        priorStatus: item.status,
        nextStatus: terminalStatus,
        matchedTerminalId: persisted.recommendationId,
        suppressed: true,
        reopened: false,
        reason: `persisted-terminal-beats-static:${persisted.lifecycleState}`,
      });
      logRecommendationLifecycleEvent("recommendation_suppressed_terminal", {
        recommendationId,
        canonicalId,
        lifecycleState: persisted.lifecycleState,
        matchedTerminalId: persisted.recommendationId,
        reason: "hydrate-persisted-beats-static",
      });
      return { ...item, status: terminalStatus };
    }

    // Persisted non-terminal (active/unchanged/etc.) — keep static unless static terminal.
    // Do not force-active over a persisted soft state; static active is fine.
  }

  // 4: Static defaults only when no authoritative persisted terminal/reopen.
  if (
    item.status === "completed" ||
    item.status === "cancelled" ||
    item.status === "replaced"
  ) {
    decisions.push({
      itemId: item.id,
      recommendationId,
      canonicalId,
      priorStatus: item.status,
      nextStatus: item.status,
      matchedTerminalId: null,
      suppressed: true,
      reopened: false,
      reason: `static-${item.status}-no-persisted-override`,
    });
    return item;
  }

  return item;
}

/**
 * Overlay durable terminal lifecycle onto the static operating backlog.
 * Does not mutate the input backlog object.
 */
export function hydrateOperatingBacklogFromPersistence(
  backlog: OperatingBacklog,
  priorRecommendations: Record<string, PersistedRecommendationRecord>,
): HydrateOperatingBacklogResult {
  const decisions: BacklogHydrationDecision[] = [];
  const next: OperatingBacklog = {
    schemaVersion: backlog.schemaVersion,
    masterSprint: {
      ...backlog.masterSprint,
      items: backlog.masterSprint.items.map((item) =>
        mapItem(item, priorRecommendations, decisions),
      ),
    },
    deferred: backlog.deferred.map((item) =>
      mapItem(item, priorRecommendations, decisions),
    ),
    recurring: backlog.recurring.map((item) =>
      mapItem(item, priorRecommendations, decisions),
    ),
  };

  // Derive day orientation from reconciled active work only (never stale static copy).
  next.masterSprint.dayOrientation = deriveDayOrientationFromBacklog(next);

  return { backlog: next, decisions };
}

/**
 * Build Today's Call orientation from the reconciled active priority set.
 * Must not reference terminal/suppressed recommendations.
 */
export function deriveDayOrientationFromBacklog(
  backlog: OperatingBacklog,
  nowIso = new Date().toISOString(),
): string | null {
  const now = Date.parse(nowIso);
  const activePriorities = backlog.masterSprint.items
    .filter(
      (i) =>
        i.status === "active" &&
        (i.kind === "sprint-priority" || i.kind === "founder-action"),
    )
    .sort((a, b) => a.rank - b.rank);

  const deferredDue = backlog.deferred
    .filter((i) => {
      if (i.status === "cancelled" || i.status === "completed") return false;
      if (i.status === "replaced") return false;
      if (!i.deferredUntil) return i.status === "active";
      return Date.parse(i.deferredUntil) <= now;
    })
    .sort((a, b) => a.rank - b.rank);

  const top = activePriorities[0] ?? deferredDue[0] ?? null;
  if (!top) {
    const openDecision = backlog.masterSprint.items.find(
      (i) => i.kind === "open-decision" && i.status === "active",
    );
    if (openDecision) {
      return `Resolve “${openDecision.title}” before opening new growth experiments.`;
    }
    return "No durable operating priority is available to orient the day.";
  }

  return `Focus on ${top.title} before opening new growth experiments.`;
}

export function isPersistedRecommendationTerminal(
  record: PersistedRecommendationRecord | null | undefined,
): boolean {
  if (!record) return false;
  if (isReopenedRecord(record)) return false;
  return (
    isTerminalLifecycle(record.lifecycleState) ||
    Boolean(record.supersededBy) ||
    (Boolean(record.completedAt) && record.lifecycleState === "completed")
  );
}

export function terminalLifecycleStates(): LifecycleState[] {
  return ["completed", "resolved", "superseded"];
}
