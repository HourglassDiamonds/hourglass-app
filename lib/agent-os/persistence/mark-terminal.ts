/**
 * Founder/system terminal-state mutations for persisted recommendations.
 * Durable via the existing Agent OS persistence store — not process memory.
 */

import { AGENT_OS_PERSISTENCE_SCHEMA_VERSION } from "./types";
import type {
  AgentOsPersistedState,
  ChangeClassification,
  LifecycleState,
  PersistedRecommendationRecord,
} from "./types";
import type { AgentOsPersistenceStore } from "./store";
import { isTerminalLifecycle } from "./lifecycle";
import { logRecommendationLifecycleEvent } from "./lifecycle-log";
import {
  canonicalIdForRecommendationId,
  operatingBacklogItemIdFromRecommendationId,
} from "../operating-backlog/canonical";

export type TerminalRecommendationStatus =
  | "completed"
  | "dismissed"
  | "superseded";

export type TerminalCompletionSource =
  | "founder-confirmed"
  | "deployment-verified"
  | "system-reconciled"
  | "test";

export type MarkRecommendationTerminalInput = {
  /** Stable recommendation ID (e.g. operating-backlog:sprint-concierge-cta-path). */
  recommendationId: string;
  status: TerminalRecommendationStatus;
  source: TerminalCompletionSource;
  nowIso?: string;
  /** Optional commit SHA or evidence reference — never secrets/PII. */
  evidenceReference?: string | null;
  note?: string | null;
  /** Required when status is superseded. */
  supersededBy?: string | null;
  owningExecutive?: PersistedRecommendationRecord["owningExecutive"];
  currentAction?: string;
  urgency?: PersistedRecommendationRecord["urgency"];
  evidenceFingerprint?: string;
  rootProblemId?: string | null;
  founderRankable?: boolean;
};

export type MarkRecommendationTerminalResult = {
  recommendationId: string;
  canonicalId: string | null;
  previousLifecycle: LifecycleState | null;
  nextLifecycle: LifecycleState;
  completedAt: string | null;
  created: boolean;
};

/**
 * Map founder-facing terminal statuses onto persistence LifecycleState.
 *
 * Schema note: `LifecycleState` has `completed` and `superseded` but no
 * distinct `dismissed` enum. Founder dismissals are stored as:
 *   lifecycleState: "superseded"
 *   supersededBy: "dismissed:<source>"
 * so dismissal remains distinguishable from true supersession by another
 * recommendation ID. Callers must treat the dismissed: prefix as the
 * dismissal concept — do not conflate with replacement supersession.
 */
function toLifecycleState(
  status: TerminalRecommendationStatus,
): LifecycleState {
  if (status === "completed") return "completed";
  return "superseded";
}

function toChangeClassification(
  status: TerminalRecommendationStatus,
): ChangeClassification {
  if (status === "completed") return "completed";
  return "superseded";
}

/**
 * Pure mutation: mark a recommendation terminal in persisted state.
 * Creates a stub record when the ID has never been observed in a run.
 */
export function applyRecommendationTerminalState(
  state: AgentOsPersistedState,
  input: MarkRecommendationTerminalInput,
): {
  state: AgentOsPersistedState;
  result: MarkRecommendationTerminalResult;
} {
  const now = input.nowIso ?? new Date().toISOString();
  const existing = state.recommendations[input.recommendationId];
  const nextLifecycle = toLifecycleState(input.status);
  const classification = toChangeClassification(input.status);
  const canonicalId =
    input.rootProblemId ??
    canonicalIdForRecommendationId(input.recommendationId);
  const itemId = operatingBacklogItemIdFromRecommendationId(
    input.recommendationId,
  );

  const noteBits = [
    input.source,
    input.evidenceReference ? `evidence:${input.evidenceReference}` : null,
    input.note ? `note:${truncate(input.note, 160)}` : null,
    input.status === "dismissed" ? "dismissed" : null,
  ].filter(Boolean);

  const blockers = noteBits.map((b) => truncate(String(b), 160));

  let record: PersistedRecommendationRecord;
  let created = false;

  if (!existing) {
    created = true;
    record = {
      schemaVersion: AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
      recommendationId: input.recommendationId,
      owningExecutive: input.owningExecutive ?? "chief-of-staff",
      handoffTarget: null,
      firstSeenAt: now,
      lastSeenAt: now,
      occurrenceCount: 1,
      lifecycleState: nextLifecycle,
      previousLifecycle: null,
      changeClassification: classification,
      priorityScore: 0,
      confidence: 1,
      founderRankable: input.founderRankable ?? true,
      currentAction:
        input.currentAction ??
        (itemId
          ? `Terminal: ${input.status} (${itemId})`
          : `Terminal: ${input.status}`),
      rootProblemId: canonicalId,
      dependencies: [],
      blockers,
      evidenceFingerprint:
        input.evidenceFingerprint ??
        `terminal:${input.status}:${input.recommendationId}`,
      firstSurfacedAt: null,
      lastSurfacedAt: null,
      timesSurfaced: 0,
      completedAt: input.status === "completed" ? now : null,
      deferredUntil: null,
      supersededBy:
        input.status === "superseded" || input.status === "dismissed"
          ? (input.supersededBy ??
            (input.status === "dismissed"
              ? `dismissed:${input.source}`
              : "superseded:unspecified"))
          : null,
      urgency: input.urgency ?? "medium",
      modeOrigin: state.modeScope === "fixture" ? "fixture" : "live",
    };
  } else {
    record = {
      ...existing,
      previousLifecycle: existing.lifecycleState,
      lifecycleState: nextLifecycle,
      changeClassification: classification,
      lastSeenAt: now,
      completedAt:
        input.status === "completed"
          ? (existing.completedAt ?? now)
          : existing.completedAt,
      supersededBy:
        input.status === "superseded" || input.status === "dismissed"
          ? (input.supersededBy ??
            existing.supersededBy ??
            (input.status === "dismissed"
              ? `dismissed:${input.source}`
              : "superseded:unspecified"))
          : existing.supersededBy,
      blockers:
        blockers.length > 0
          ? [...blockers, ...existing.blockers].slice(0, 8)
          : existing.blockers,
      rootProblemId: canonicalId ?? existing.rootProblemId,
      evidenceFingerprint:
        input.evidenceFingerprint ?? existing.evidenceFingerprint,
      currentAction: input.currentAction ?? existing.currentAction,
      urgency: input.urgency ?? existing.urgency,
    };
  }

  const nextState: AgentOsPersistedState = {
    ...state,
    updatedAt: now,
    recommendations: {
      ...state.recommendations,
      [input.recommendationId]: record,
    },
  };

  const event =
    input.status === "completed"
      ? "recommendation_marked_completed"
      : input.status === "dismissed"
        ? "recommendation_marked_dismissed"
        : "recommendation_marked_superseded";

  logRecommendationLifecycleEvent(event, {
    recommendationId: input.recommendationId,
    canonicalId,
    lifecycleState: nextLifecycle,
    priorLifecycle: existing?.lifecycleState ?? null,
    source: input.source,
    reason: input.note ?? undefined,
  });

  return {
    state: nextState,
    result: {
      recommendationId: input.recommendationId,
      canonicalId,
      previousLifecycle: existing?.lifecycleState ?? null,
      nextLifecycle,
      completedAt: record.completedAt,
      created,
    },
  };
}

export async function markRecommendationTerminal(
  store: AgentOsPersistenceStore,
  input: MarkRecommendationTerminalInput,
): Promise<MarkRecommendationTerminalResult> {
  const prior = await store.load();
  const { state, result } = applyRecommendationTerminalState(prior, input);
  await store.save(state, { expectedUpdatedAt: prior.updatedAt });
  return result;
}

/**
 * Explicit reopen after terminal state when material new evidence warrants it.
 */
export type ReopenRecommendationInput = {
  recommendationId: string;
  nowIso?: string;
  /** Why the new evidence materially changes the conclusion. */
  reason: string;
  newEvidenceFingerprint: string;
  evidenceClass?: string | null;
  currentAction?: string;
  urgency?: PersistedRecommendationRecord["urgency"];
};

export type ReopenRecommendationResult = {
  recommendationId: string;
  priorTerminalState: LifecycleState;
  priorCompletedAt: string | null;
  reopenedAt: string;
  newEvidenceFingerprint: string;
  reason: string;
};

export function applyRecommendationReopen(
  state: AgentOsPersistedState,
  input: ReopenRecommendationInput,
): {
  state: AgentOsPersistedState;
  result: ReopenRecommendationResult;
} {
  const existing = state.recommendations[input.recommendationId];
  if (!existing) {
    throw new Error(
      `Cannot reopen unknown recommendation ${input.recommendationId}`,
    );
  }
  if (
    !isTerminalLifecycle(existing.lifecycleState) &&
    !existing.completedAt &&
    !existing.supersededBy
  ) {
    throw new Error(
      `Recommendation ${input.recommendationId} is not terminal (lifecycle=${existing.lifecycleState})`,
    );
  }

  const now = input.nowIso ?? new Date().toISOString();
  const priorTerminal = existing.lifecycleState;
  const record: PersistedRecommendationRecord = {
    ...existing,
    previousLifecycle: existing.lifecycleState,
    lifecycleState: "active",
    changeClassification: "reopened",
    lastSeenAt: now,
    evidenceFingerprint: input.newEvidenceFingerprint,
    currentAction: input.currentAction ?? existing.currentAction,
    urgency: input.urgency ?? existing.urgency,
    // Preserve completion timestamp for history; clear terminal markers.
    completedAt: existing.completedAt,
    supersededBy: null,
    blockers: [
      `reopened:${truncate(input.reason, 140)}`,
      `prior-terminal:${priorTerminal}`,
      existing.completedAt ? `prior-completed-at:${existing.completedAt}` : null,
      input.evidenceClass ? `evidence-class:${input.evidenceClass}` : null,
    ]
      .filter(Boolean)
      .map((b) => truncate(String(b), 160))
      .slice(0, 8),
  };

  logRecommendationLifecycleEvent("recommendation_reopened", {
    recommendationId: input.recommendationId,
    canonicalId: existing.rootProblemId,
    lifecycleState: "active",
    priorLifecycle: priorTerminal,
    evidenceClass: input.evidenceClass ?? null,
    reason: input.reason,
  });

  return {
    state: {
      ...state,
      updatedAt: now,
      recommendations: {
        ...state.recommendations,
        [input.recommendationId]: record,
      },
    },
    result: {
      recommendationId: input.recommendationId,
      priorTerminalState: priorTerminal,
      priorCompletedAt: existing.completedAt,
      reopenedAt: now,
      newEvidenceFingerprint: input.newEvidenceFingerprint,
      reason: input.reason,
    },
  };
}

export async function reopenRecommendation(
  store: AgentOsPersistenceStore,
  input: ReopenRecommendationInput,
): Promise<ReopenRecommendationResult> {
  const prior = await store.load();
  const { state, result } = applyRecommendationReopen(prior, input);
  await store.save(state, { expectedUpdatedAt: prior.updatedAt });
  return result;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
