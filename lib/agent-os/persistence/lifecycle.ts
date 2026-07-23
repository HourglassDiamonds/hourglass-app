/**
 * Lifecycle helpers for persisted findings and recommendations.
 * Missing/unavailable sources must never resolve or falsely improve/worsen.
 */

import type {
  ChangeClassification,
  LifecycleState,
} from "./types";

export type LifecycleTransitionInput = {
  prior: LifecycleState | null;
  observed: boolean;
  fingerprintChanged: boolean;
  /** Objective evidence direction when comparable healthy sources exist. */
  evidenceDirection: "improved" | "worsened" | "equivalent" | "unknown";
  comparableSourcesHealthy: boolean;
  /** Explicit founder/system deferral still in effect. */
  deferred: boolean;
  deferredUntil?: string | null;
  nowIso: string;
  /** Explicit completion of recommended action (does not resolve finding). */
  completed: boolean;
  supersededBy?: string | null;
  /** Healthy runs without observation — stale eligibility. */
  healthyNonObservation: boolean;
  /** Verified absent/corrected with healthy sources. */
  verifiedResolved: boolean;
  blocked: boolean;
};

export function isTerminalLifecycle(state: LifecycleState): boolean {
  return (
    state === "resolved" ||
    state === "superseded" ||
    state === "completed"
  );
}

export function deferralStillActive(
  deferredUntil: string | null | undefined,
  nowIso: string,
): boolean {
  if (!deferredUntil) return false;
  return Date.parse(deferredUntil) > Date.parse(nowIso);
}

/**
 * Compute next lifecycle + change classification for a finding or recommendation.
 */
export function transitionLifecycle(
  input: LifecycleTransitionInput,
): { next: LifecycleState; classification: ChangeClassification } {
  const {
    prior,
    observed,
    fingerprintChanged,
    evidenceDirection,
    comparableSourcesHealthy,
    deferred,
    deferredUntil,
    nowIso,
    completed,
    supersededBy,
    healthyNonObservation,
    verifiedResolved,
    blocked,
  } = input;

  if (supersededBy) {
    return { next: "superseded", classification: "superseded" };
  }

  if (deferred || deferralStillActive(deferredUntil, nowIso)) {
    return { next: "deferred", classification: "deferred" };
  }

  if (completed && !observed) {
    return { next: "completed", classification: "completed" };
  }
  if (completed && observed) {
    // Completion of action does not auto-resolve; item may still be active.
    if (!fingerprintChanged && evidenceDirection === "equivalent") {
      return { next: "completed", classification: "completed" };
    }
  }

  if (blocked) {
    return { next: "blocked", classification: "blocked" };
  }

  if (!prior) {
    return { next: "new", classification: "first-seen" };
  }

  // Unavailable sources: preserve prior evidence-based state (no resolve/improve/worsen).
  if (!comparableSourcesHealthy && !observed) {
    if (prior === "deferred") {
      return { next: "deferred", classification: "deferred" };
    }
    if (prior === "completed") {
      return { next: "completed", classification: "completed" };
    }
    if (prior === "stale") {
      return { next: "stale", classification: "stale" };
    }
    return {
      next: prior === "new" ? "active" : prior,
      classification: "source-gap",
    };
  }

  if (!comparableSourcesHealthy && observed) {
    // May update source-health awareness but not evidence direction.
    if (!fingerprintChanged) {
      return {
        next: prior === "new" ? "unchanged" : prior === "active" ? "unchanged" : prior,
        classification: prior === "new" ? "unchanged" : "source-gap",
      };
    }
    return {
      next: prior === "new" ? "active" : "active",
      classification: "source-gap",
    };
  }

  if (verifiedResolved && comparableSourcesHealthy) {
    return { next: "resolved", classification: "resolved" };
  }

  if (!observed) {
    if (healthyNonObservation) {
      return { next: "stale", classification: "stale" };
    }
    // Unhealthy non-observation must not mark stale.
    return {
      next: prior === "new" ? "active" : prior,
      classification: "source-gap",
    };
  }

  // Observed with healthy comparable sources
  if (prior === "completed" && !fingerprintChanged) {
    return { next: "completed", classification: "completed" };
  }
  if (prior === "completed" && fingerprintChanged) {
    return { next: "active", classification: "reopened" };
  }
  if (prior === "resolved" && fingerprintChanged) {
    return { next: "active", classification: "reopened" };
  }
  if (prior === "resolved" && !fingerprintChanged) {
    return { next: "resolved", classification: "resolved" };
  }

  if (!fingerprintChanged || evidenceDirection === "equivalent") {
    return { next: "unchanged", classification: "unchanged" };
  }

  if (evidenceDirection === "improved") {
    return { next: "improved", classification: "improved" };
  }
  if (evidenceDirection === "worsened") {
    return { next: "worsened", classification: "worsened" };
  }

  return { next: "active", classification: "unknown" };
}

export function lifecycleAfterFirstSeen(): {
  next: LifecycleState;
  classification: ChangeClassification;
} {
  return { next: "new", classification: "first-seen" };
}
