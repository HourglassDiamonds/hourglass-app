/**
 * Founder-priority recurrence controls.
 * Prevents repeatedly surfacing the same unchanged priority without change.
 * Critical unresolved work is never permanently hidden.
 */

import type {
  PersistedRecommendationRecord,
  RecurrenceDecision,
  RecurrenceEligibilityReason,
} from "./types";
import { deferralStillActive } from "./lifecycle";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Default cooldown before an unchanged founder priority may re-surface. */
export const DEFAULT_FOUNDER_COOLDOWN_MS = 7 * DAY;

/** Critical items may re-surface after a shorter cooldown. */
export const CRITICAL_FOUNDER_COOLDOWN_MS = 3 * DAY;

export const MAX_FOUNDER_BRIEF_PRIORITIES = 5;

export type RecurrenceEvaluateInput = {
  record: PersistedRecommendationRecord;
  nowIso: string;
  onDemand?: boolean;
  cooldownMs?: number;
  criticalCooldownMs?: number;
  slotsRemaining?: number;
};

export function evaluateFounderRecurrence(
  input: RecurrenceEvaluateInput,
): RecurrenceDecision {
  const { record, nowIso } = input;
  const cooldownMs = input.cooldownMs ?? DEFAULT_FOUNDER_COOLDOWN_MS;
  const criticalCooldownMs =
    input.criticalCooldownMs ?? CRITICAL_FOUNDER_COOLDOWN_MS;

  if (!record.founderRankable) {
    return decision(
      record,
      false,
      "not-founder-rankable",
      false,
      "Not founder-rankable",
    );
  }

  if (record.lifecycleState === "superseded" || record.supersededBy) {
    return decision(record, false, "superseded-hidden", false, "Superseded");
  }

  // completedAt is retained after explicit reopen for history — do not hide reopened work.
  if (
    record.lifecycleState === "completed" ||
    (Boolean(record.completedAt) &&
      record.changeClassification !== "reopened" &&
      record.lifecycleState !== "active")
  ) {
    return decision(
      record,
      false,
      "completed-hidden",
      false,
      "Completed action",
    );
  }

  if (deferralStillActive(record.deferredUntil, nowIso)) {
    return decision(
      record,
      false,
      "deferred-not-due",
      false,
      "Deferred until future date",
    );
  }

  if (record.lifecycleState === "deferred" && !deferralStillActive(record.deferredUntil, nowIso)) {
    return decision(
      record,
      true,
      "deferred-date-reached",
      false,
      "Deferral ended — eligible again",
    );
  }

  if (input.onDemand) {
    return decision(
      record,
      true,
      "on-demand-requested",
      false,
      "On-demand brief requested",
    );
  }

  if (record.timesSurfaced === 0 || !record.lastSurfacedAt) {
    return decision(
      record,
      true,
      "newly-surfaced",
      false,
      "Never surfaced in founder brief",
    );
  }

  if (
    record.changeClassification === "worsened" ||
    record.lifecycleState === "worsened"
  ) {
    return decision(
      record,
      true,
      "worsened",
      false,
      "Materially worsened — may re-surface",
    );
  }

  if (
    record.changeClassification === "reopened" ||
    record.changeClassification === "improved"
  ) {
    return decision(
      record,
      true,
      record.changeClassification === "reopened"
        ? "prerequisite-resolved"
        : "materially-changed",
      false,
      "Material evidence or dependency change",
    );
  }

  const last = Date.parse(record.lastSurfacedAt);
  const age = Date.parse(nowIso) - last;
  const isCritical = record.urgency === "critical";
  const effectiveCooldown = isCritical ? criticalCooldownMs : cooldownMs;

  if (age < effectiveCooldown) {
    return decision(
      record,
      false,
      "cooldown-active",
      true,
      `Cooldown active (${Math.round(age / HOUR)}h / ${Math.round(effectiveCooldown / HOUR)}h)`,
    );
  }

  if (isCritical) {
    return decision(
      record,
      true,
      "critical-unresolved",
      false,
      "Critical unresolved — cooldown elapsed; not permanently hidden",
    );
  }

  if (input.slotsRemaining !== undefined && input.slotsRemaining <= 0) {
    return decision(
      record,
      false,
      "lower-priority-slot-full",
      false,
      "Founder brief slots full",
    );
  }

  return decision(
    record,
    true,
    "cooldown-elapsed",
    false,
    "Cooldown elapsed — eligible to re-surface",
  );
}

/**
 * When recurrence would leave a daily brief empty, select unresolved
 * persisted recommendations to carry forward (cooldown bypass for emptiness only).
 */
export function selectCarryForwardRecommendationIds(input: {
  priorRecommendations: Record<string, PersistedRecommendationRecord>;
  currentRecommendations: Array<{ recommendationId: string; priorityScore: number }>;
  nowIso: string;
  max?: number;
}): string[] {
  const max = input.max ?? MAX_FOUNDER_BRIEF_PRIORITIES;
  const currentIds = new Set(
    input.currentRecommendations.map((r) => r.recommendationId),
  );
  const scoreById = new Map(
    input.currentRecommendations.map((r) => [r.recommendationId, r.priorityScore]),
  );

  const candidates = Object.values(input.priorRecommendations)
    .filter((r) => {
      if (!r.founderRankable) return false;
      if (
        r.lifecycleState === "completed" ||
        (Boolean(r.completedAt) &&
          r.changeClassification !== "reopened" &&
          r.lifecycleState !== "active")
      ) {
        return false;
      }
      if (r.lifecycleState === "superseded" || r.supersededBy) return false;
      if (deferralStillActive(r.deferredUntil, input.nowIso)) return false;
      if (!currentIds.has(r.recommendationId) && r.timesSurfaced === 0) {
        return false;
      }
      // Prefer items that still exist this cycle, or were previously surfaced.
      return currentIds.has(r.recommendationId) || r.timesSurfaced > 0;
    })
    .sort((a, b) => {
      const sa = scoreById.get(a.recommendationId) ?? a.priorityScore;
      const sb = scoreById.get(b.recommendationId) ?? b.priorityScore;
      return sb - sa;
    });

  return candidates.slice(0, max).map((c) => c.recommendationId);
}

/** Select up to max founder priorities applying recurrence rules + priority sort. */
export function selectFounderPrioritiesForBrief(
  records: PersistedRecommendationRecord[],
  nowIso: string,
  options?: { max?: number; onDemand?: boolean },
): {
  selected: PersistedRecommendationRecord[];
  decisions: RecurrenceDecision[];
} {
  const max = options?.max ?? MAX_FOUNDER_BRIEF_PRIORITIES;
  const sorted = [...records].sort(
    (a, b) => b.priorityScore - a.priorityScore,
  );
  const decisions: RecurrenceDecision[] = [];
  const selected: PersistedRecommendationRecord[] = [];
  const seenRoots = new Set<string>();

  for (const rec of sorted) {
    const rootKey = rec.rootProblemId ?? rec.recommendationId;
    if (seenRoots.has(rootKey) && rec.rootProblemId) {
      decisions.push(
        decision(
          rec,
          false,
          "lower-priority-slot-full",
          false,
          "Duplicate root problem — one founder priority per root",
        ),
      );
      continue;
    }
    const d = evaluateFounderRecurrence({
      record: rec,
      nowIso,
      onDemand: options?.onDemand,
      slotsRemaining: max - selected.length,
    });
    decisions.push(d);
    if (d.eligible && selected.length < max) {
      selected.push(rec);
      seenRoots.add(rootKey);
    }
  }

  return { selected, decisions };
}

function decision(
  record: PersistedRecommendationRecord,
  eligible: boolean,
  reason: RecurrenceEligibilityReason,
  cooldownActive: boolean,
  detail: string,
): RecurrenceDecision {
  return {
    recommendationId: record.recommendationId,
    eligible,
    reason,
    cooldownActive,
    detail,
  };
}
