/**
 * Reconcile current run findings/recommendations against persisted state.
 * Failed runs must not erase healthy prior state.
 * Unavailable sources must not resolve findings.
 */

import {
  AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
  type AgentOsPersistedState,
  type AgentOsRunRecord,
  type PersistedFindingRecord,
  type PersistedItemChange,
  type PersistedRecommendationRecord,
  type PersistedRunStatus,
  type ReconciliationSummary,
  type RunPersistenceInput,
} from "./types";
import { transitionLifecycle } from "./lifecycle";
import { MAX_RETAINED_RUNS } from "./store";

function mapAgentRunStatus(
  status: RunPersistenceInput["agentRunStatus"],
  hasPartialExecFailure: boolean,
): PersistedRunStatus {
  if (status === "failed") return "failed";
  if (hasPartialExecFailure) return "partially-failed";
  if (status === "blocked" || status === "completed-with-warnings") {
    return "completed-degraded";
  }
  return "completed";
}

function evidenceDirectionFromFingerprints(
  prior: string | undefined,
  next: string,
  comparableSourcesHealthy: boolean,
  severityPrior: string | undefined,
  severityNext: string,
  confidencePrior: number | undefined,
  confidenceNext: number,
): "improved" | "worsened" | "equivalent" | "unknown" {
  if (!comparableSourcesHealthy) return "unknown";
  if (!prior || prior === next) return "equivalent";

  const sevRank: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
    unknown: 0,
  };
  const sp = sevRank[severityPrior ?? "unknown"] ?? 0;
  const sn = sevRank[severityNext] ?? 0;
  // Severity dominates when it clearly moves — confidence alone must not invert it.
  if (sn < sp) return "improved";
  if (sn > sp) return "worsened";
  if (confidenceNext > (confidencePrior ?? 0) + 0.15) return "improved";
  if (confidenceNext < (confidencePrior ?? 0) - 0.15) return "worsened";
  return "unknown";
}

/**
 * Pure reconciliation — returns next state + summary.
 * Does not write. Caller persists atomically.
 */
export function reconcilePersistedState(
  prior: AgentOsPersistedState,
  input: RunPersistenceInput,
  meta: {
    adapterId: AgentOsPersistedState["adapterId"];
    durability: AgentOsPersistedState["durability"];
  },
): { state: AgentOsPersistedState; summary: ReconciliationSummary } {
  const now = input.now ?? input.completedAt;
  const changes: PersistedItemChange[] = [];
  const errors: string[] = [];

  const failedHard =
    input.agentRunStatus === "failed" ||
    (input.errorSummary != null &&
      input.executiveStatuses.every(
        (e) => e.status === "failed" || e.status === "skipped",
      ));

  const summary: ReconciliationSummary = {
    runId: input.runId,
    mode: input.mode,
    findingsCreated: 0,
    findingsUpdated: 0,
    findingsUnchanged: 0,
    findingsImproved: 0,
    findingsWorsened: 0,
    findingsResolved: 0,
    findingsStale: 0,
    findingsSuperseded: 0,
    recommendationsCreated: 0,
    recommendationsUpdated: 0,
    recommendationsUnchanged: 0,
    skippedDueToFailedRun: false,
    skippedDueToWriteGuard: false,
    changes,
    errors,
  };

  // Mode isolation: never merge fixture into live state or vice versa
  if (
    prior.modeScope !== "test" &&
    prior.modeScope !== input.mode &&
    (prior.findings && Object.keys(prior.findings).length > 0)
  ) {
    // Allow empty cross-mode bootstrap; refuse mixing populated state
    if (
      (prior.modeScope === "fixture" && input.mode === "live") ||
      (prior.modeScope === "live" && input.mode === "fixture")
    ) {
      errors.push(
        `Refusing to reconcile ${input.mode} run into ${prior.modeScope} persisted state`,
      );
      summary.skippedDueToWriteGuard = true;
      return { state: prior, summary };
    }
  }

  if (failedHard) {
    summary.skippedDueToFailedRun = true;
    const runRecord = buildRunRecord(input, meta, changes, false, "failed");
    const nextRuns = trimRuns([...prior.runs, runRecord]);
    return {
      state: {
        ...prior,
        updatedAt: now,
        adapterId: meta.adapterId,
        durability: meta.durability,
        runs: nextRuns,
        // findings/recommendations preserved unchanged
      },
      summary,
    };
  }

  const findings = { ...prior.findings };
  const recommendations = { ...prior.recommendations };
  const observedFindingIds = new Set(input.findings.map((f) => f.findingId));
  const observedRecIds = new Set(
    input.recommendations.map((r) => r.recommendationId),
  );

  // --- Findings ---
  for (const f of input.findings) {
    const existing = findings[f.findingId];
    if (!existing) {
      const created: PersistedFindingRecord = {
        schemaVersion: AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
        findingId: f.findingId,
        owningExecutive: f.owningExecutive,
        firstSeenAt: now,
        lastSeenAt: now,
        occurrenceCount: 1,
        currentEvidenceClass: f.evidenceClass,
        currentConfidence: f.confidence,
        currentSeverity: f.severity,
        currentSourceHealth: f.sourceHealth,
        currentLifecycle: "new",
        previousLifecycle: null,
        changeClassification: "first-seen",
        currentSummary: f.summary,
        evidenceFingerprint: f.evidenceFingerprint,
        relatedRecommendationIds: f.relatedRecommendationIds,
        rootProblemId: f.rootProblemId,
        supersededBy: f.supersededBy ?? null,
        resolvedAt: null,
        deferredUntil: f.deferredUntil ?? null,
        lastSurfacedInFounderBriefAt: f.founderSurfaced ? now : null,
        timesSurfacedInFounderBrief: f.founderSurfaced ? 1 : 0,
        lastHealthyObservationAt: f.comparableSourcesHealthy ? now : null,
        comparableSourcesHealthyOnLastTouch: f.comparableSourcesHealthy,
        modeOrigin: input.mode,
      };
      findings[f.findingId] = created;
      summary.findingsCreated += 1;
      changes.push({
        kind: "finding",
        stableId: f.findingId,
        previousLifecycle: null,
        nextLifecycle: "new",
        changeClassification: "first-seen",
        fingerprintChanged: true,
        occurrenceCount: 1,
      });
      continue;
    }

    // Preserve deferred / completed across equivalent evidence
    const fingerprintChanged =
      existing.evidenceFingerprint !== f.evidenceFingerprint;
    const direction = evidenceDirectionFromFingerprints(
      existing.evidenceFingerprint,
      f.evidenceFingerprint,
      f.comparableSourcesHealthy,
      existing.currentSeverity,
      f.severity,
      existing.currentConfidence,
      f.confidence,
    );

    const deferred =
      Boolean(existing.deferredUntil) ||
      existing.currentLifecycle === "deferred";
    const completed = existing.currentLifecycle === "completed";

    const { next, classification } = transitionLifecycle({
      prior: existing.currentLifecycle,
      observed: true,
      fingerprintChanged,
      evidenceDirection: direction,
      comparableSourcesHealthy: f.comparableSourcesHealthy,
      deferred: deferred && !f.supersededBy,
      deferredUntil: f.deferredUntil ?? existing.deferredUntil,
      nowIso: now,
      completed,
      supersededBy: f.supersededBy ?? existing.supersededBy,
      healthyNonObservation: false,
      verifiedResolved: false,
      blocked: f.sourceHealth.includes("blocked"),
    });

    const updated: PersistedFindingRecord = {
      ...existing,
      lastSeenAt: now,
      occurrenceCount: existing.occurrenceCount + 1,
      currentEvidenceClass: f.evidenceClass,
      currentConfidence: f.confidence,
      currentSeverity: f.severity,
      currentSourceHealth: f.sourceHealth,
      previousLifecycle: existing.currentLifecycle,
      currentLifecycle: next,
      changeClassification: classification,
      currentSummary: f.summary,
      evidenceFingerprint: f.comparableSourcesHealthy
        ? f.evidenceFingerprint
        : existing.evidenceFingerprint,
      relatedRecommendationIds: f.relatedRecommendationIds,
      rootProblemId: f.rootProblemId ?? existing.rootProblemId,
      supersededBy: f.supersededBy ?? existing.supersededBy,
      deferredUntil: f.deferredUntil ?? existing.deferredUntil,
      lastHealthyObservationAt: f.comparableSourcesHealthy
        ? now
        : existing.lastHealthyObservationAt,
      comparableSourcesHealthyOnLastTouch: f.comparableSourcesHealthy,
      lastSurfacedInFounderBriefAt: f.founderSurfaced
        ? now
        : existing.lastSurfacedInFounderBriefAt,
      timesSurfacedInFounderBrief: f.founderSurfaced
        ? existing.timesSurfacedInFounderBrief + 1
        : existing.timesSurfacedInFounderBrief,
      resolvedAt:
        next === "resolved" ? (existing.resolvedAt ?? now) : existing.resolvedAt,
    };

    // Do not overwrite healthy fingerprint with degraded unknown
    if (!f.comparableSourcesHealthy && fingerprintChanged) {
      updated.evidenceFingerprint = existing.evidenceFingerprint;
      updated.currentConfidence = existing.currentConfidence;
      updated.currentSeverity = existing.currentSeverity;
    }

    findings[f.findingId] = updated;
    bumpFindingSummary(summary, classification);
    changes.push({
      kind: "finding",
      stableId: f.findingId,
      previousLifecycle: existing.currentLifecycle,
      nextLifecycle: next,
      changeClassification: classification,
      fingerprintChanged,
      occurrenceCount: updated.occurrenceCount,
    });
  }

  // Stale / unresolved for findings not observed
  for (const [id, existing] of Object.entries(findings)) {
    if (observedFindingIds.has(id)) continue;
    if (
      existing.currentLifecycle === "resolved" ||
      existing.currentLifecycle === "superseded" ||
      existing.currentLifecycle === "completed"
    ) {
      continue;
    }

    // Only mark stale on healthy non-observation for this executive domain
    const healthyNonObservation = executiveSourcesHealthy(
      input,
      existing.owningExecutive,
    );
    // Never resolve on missing observation
    const { next, classification } = transitionLifecycle({
      prior: existing.currentLifecycle,
      observed: false,
      fingerprintChanged: false,
      evidenceDirection: "unknown",
      comparableSourcesHealthy: healthyNonObservation,
      deferred: existing.currentLifecycle === "deferred",
      deferredUntil: existing.deferredUntil,
      nowIso: now,
      completed: false,
      supersededBy: existing.supersededBy,
      healthyNonObservation,
      verifiedResolved: false,
      blocked: existing.currentLifecycle === "blocked",
    });

    if (next === existing.currentLifecycle && classification === "source-gap") {
      continue;
    }

    findings[id] = {
      ...existing,
      previousLifecycle: existing.currentLifecycle,
      currentLifecycle: next,
      changeClassification: classification,
    };
    bumpFindingSummary(summary, classification);
    changes.push({
      kind: "finding",
      stableId: id,
      previousLifecycle: existing.currentLifecycle,
      nextLifecycle: next,
      changeClassification: classification,
      fingerprintChanged: false,
      occurrenceCount: existing.occurrenceCount,
    });
  }

  // --- Recommendations ---
  for (const r of input.recommendations) {
    const existing = recommendations[r.recommendationId];
    if (!existing) {
      const created: PersistedRecommendationRecord = {
        schemaVersion: AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
        recommendationId: r.recommendationId,
        owningExecutive: r.owningExecutive,
        handoffTarget: r.handoffTarget,
        firstSeenAt: now,
        lastSeenAt: now,
        occurrenceCount: 1,
        lifecycleState: r.lifecycleHint ?? "new",
        previousLifecycle: null,
        changeClassification: "first-seen",
        priorityScore: r.priorityScore,
        confidence: r.confidence,
        founderRankable: r.founderRankable,
        currentAction: r.currentAction,
        rootProblemId: r.rootProblemId,
        dependencies: r.dependencies,
        blockers: r.blockers,
        evidenceFingerprint: r.evidenceFingerprint,
        firstSurfacedAt: r.founderSurfaced ? now : null,
        lastSurfacedAt: r.founderSurfaced ? now : null,
        timesSurfaced: r.founderSurfaced ? 1 : 0,
        completedAt: r.completed ? now : null,
        deferredUntil: r.deferredUntil ?? null,
        supersededBy: r.supersededBy ?? null,
        urgency: r.urgency,
        modeOrigin: input.mode,
      };
      recommendations[r.recommendationId] = created;
      summary.recommendationsCreated += 1;
      changes.push({
        kind: "recommendation",
        stableId: r.recommendationId,
        previousLifecycle: null,
        nextLifecycle: created.lifecycleState,
        changeClassification: "first-seen",
        fingerprintChanged: true,
        occurrenceCount: 1,
      });
      continue;
    }

    const fingerprintChanged =
      existing.evidenceFingerprint !== r.evidenceFingerprint;
    const comparable = input.sourceHealth.some(
      (h) =>
        h.retrievalState === "ok" ||
        h.retrievalState === "fixture" ||
        h.retrievalState === "empty",
    );
    const direction = evidenceDirectionFromFingerprints(
      existing.evidenceFingerprint,
      r.evidenceFingerprint,
      comparable,
      existing.urgency,
      r.urgency,
      existing.confidence,
      r.confidence,
    );

    const preserveDeferred =
      existing.lifecycleState === "deferred" ||
      Boolean(existing.deferredUntil);
    const preserveCompleted =
      existing.lifecycleState === "completed" || Boolean(existing.completedAt);

    const { next, classification } = transitionLifecycle({
      prior: existing.lifecycleState,
      observed: true,
      fingerprintChanged,
      evidenceDirection: direction,
      comparableSourcesHealthy: comparable,
      deferred: preserveDeferred && !r.completed,
      deferredUntil: r.deferredUntil ?? existing.deferredUntil,
      nowIso: now,
      completed: preserveCompleted || Boolean(r.completed),
      supersededBy: r.supersededBy ?? existing.supersededBy,
      healthyNonObservation: false,
      verifiedResolved: false,
      blocked: r.blockers.length > 0 || r.lifecycleHint === "blocked",
    });

    // Avoid re-opening completed without materially new evidence
    let lifecycleState = next;
    let changeClassification = classification;
    if (preserveCompleted && !fingerprintChanged) {
      lifecycleState = "completed";
      changeClassification = "completed";
    }

    const updated: PersistedRecommendationRecord = {
      ...existing,
      lastSeenAt: now,
      occurrenceCount: existing.occurrenceCount + 1,
      previousLifecycle: existing.lifecycleState,
      lifecycleState,
      changeClassification,
      priorityScore: r.priorityScore,
      confidence: comparable ? r.confidence : existing.confidence,
      founderRankable: r.founderRankable,
      currentAction: r.currentAction,
      rootProblemId: r.rootProblemId ?? existing.rootProblemId,
      dependencies: r.dependencies,
      blockers: r.blockers,
      evidenceFingerprint: comparable
        ? r.evidenceFingerprint
        : existing.evidenceFingerprint,
      handoffTarget: r.handoffTarget ?? existing.handoffTarget,
      deferredUntil: r.deferredUntil ?? existing.deferredUntil,
      supersededBy: r.supersededBy ?? existing.supersededBy,
      completedAt:
        lifecycleState === "completed"
          ? (existing.completedAt ?? now)
          : existing.completedAt,
      urgency: r.urgency,
      firstSurfacedAt:
        r.founderSurfaced && !existing.firstSurfacedAt
          ? now
          : existing.firstSurfacedAt,
      lastSurfacedAt: r.founderSurfaced ? now : existing.lastSurfacedAt,
      timesSurfaced: r.founderSurfaced
        ? existing.timesSurfaced + 1
        : existing.timesSurfaced,
    };

    recommendations[r.recommendationId] = updated;
    if (changeClassification === "unchanged") {
      summary.recommendationsUnchanged += 1;
    } else {
      summary.recommendationsUpdated += 1;
    }
    changes.push({
      kind: "recommendation",
      stableId: r.recommendationId,
      previousLifecycle: existing.lifecycleState,
      nextLifecycle: lifecycleState,
      changeClassification,
      fingerprintChanged,
      occurrenceCount: updated.occurrenceCount,
    });
  }

  // Mark superseded when canonical root appears and older ids map to it
  applyRootSupersession(findings, recommendations, input, now, changes, summary);

  void observedRecIds;

  const hasPartial = input.executiveStatuses.some(
    (e) => e.status === "failed" || e.status === "blocked",
  );
  const overall = mapAgentRunStatus(input.agentRunStatus, hasPartial);
  const runRecord = buildRunRecord(input, meta, changes, true, overall);
  const nextState: AgentOsPersistedState = {
    ...prior,
    schemaVersion: AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
    adapterId: meta.adapterId,
    durability: meta.durability,
    modeScope: input.mode === "fixture" ? "fixture" : prior.modeScope === "test" ? "test" : "live",
    updatedAt: now,
    runs: trimRuns([...prior.runs, runRecord]),
    findings,
    recommendations,
  };

  return { state: nextState, summary };
}

function bumpFindingSummary(
  summary: ReconciliationSummary,
  classification: PersistedItemChange["changeClassification"],
): void {
  if (classification === "unchanged" || classification === "source-gap") {
    summary.findingsUnchanged += 1;
  } else if (classification === "improved") {
    summary.findingsImproved += 1;
    summary.findingsUpdated += 1;
  } else if (classification === "worsened") {
    summary.findingsWorsened += 1;
    summary.findingsUpdated += 1;
  } else if (classification === "resolved") {
    summary.findingsResolved += 1;
    summary.findingsUpdated += 1;
  } else if (classification === "stale") {
    summary.findingsStale += 1;
    summary.findingsUpdated += 1;
  } else if (classification === "superseded") {
    summary.findingsSuperseded += 1;
    summary.findingsUpdated += 1;
  } else {
    summary.findingsUpdated += 1;
  }
}

function executiveSourcesHealthy(
  input: RunPersistenceInput,
  executive: PersistedFindingRecord["owningExecutive"],
): boolean {
  const needed =
    executive === "business-intelligence"
      ? ["ga4", "weekly-intelligence"]
      : executive === "search-strategy"
        ? ["gsc"]
        : [];
  if (needed.length === 0) {
    return input.sourceHealth.some(
      (h) =>
        h.retrievalState === "ok" ||
        h.retrievalState === "fixture" ||
        h.retrievalState === "empty",
    );
  }
  return needed.every((id) =>
    input.sourceHealth.some(
      (h) =>
        h.sourceId === id &&
        (h.retrievalState === "ok" ||
          h.retrievalState === "fixture" ||
          h.retrievalState === "empty"),
    ),
  );
}

function applyRootSupersession(
  findings: Record<string, PersistedFindingRecord>,
  recommendations: Record<string, PersistedRecommendationRecord>,
  input: RunPersistenceInput,
  now: string,
  changes: PersistedItemChange[],
  summary: ReconciliationSummary,
): void {
  const roots = new Set(
    [
      ...input.findings.map((f) => f.rootProblemId),
      ...input.recommendations.map((r) => r.rootProblemId),
    ].filter(Boolean) as string[],
  );

  for (const rootId of roots) {
    for (const [id, f] of Object.entries(findings)) {
      if (id === rootId) continue;
      if (f.rootProblemId !== rootId) continue;
      if (f.currentLifecycle === "superseded") continue;
      // Only supersede symptom findings when root is present this run
      if (!input.findings.some((x) => x.findingId === rootId)) continue;
      findings[id] = {
        ...f,
        previousLifecycle: f.currentLifecycle,
        currentLifecycle: "superseded",
        changeClassification: "superseded",
        supersededBy: rootId,
        lastSeenAt: now,
      };
      summary.findingsSuperseded += 1;
      changes.push({
        kind: "finding",
        stableId: id,
        previousLifecycle: f.currentLifecycle,
        nextLifecycle: "superseded",
        changeClassification: "superseded",
        fingerprintChanged: false,
        occurrenceCount: f.occurrenceCount,
      });
    }
    for (const [id, r] of Object.entries(recommendations)) {
      if (id === rootId) continue;
      if (r.rootProblemId !== rootId) continue;
      if (r.lifecycleState === "superseded") continue;
      if (!input.recommendations.some((x) => x.recommendationId === rootId)) {
        continue;
      }
      recommendations[id] = {
        ...r,
        previousLifecycle: r.lifecycleState,
        lifecycleState: "superseded",
        changeClassification: "superseded",
        supersededBy: rootId,
        lastSeenAt: now,
      };
      changes.push({
        kind: "recommendation",
        stableId: id,
        previousLifecycle: r.lifecycleState,
        nextLifecycle: "superseded",
        changeClassification: "superseded",
        fingerprintChanged: false,
        occurrenceCount: r.occurrenceCount,
      });
    }
  }
}

function buildRunRecord(
  input: RunPersistenceInput,
  meta: {
    adapterId: AgentOsPersistedState["adapterId"];
    durability: AgentOsPersistedState["durability"];
  },
  changes: PersistedItemChange[],
  persistenceWriteOk: boolean,
  overallStatus: PersistedRunStatus,
): AgentOsRunRecord {
  return {
    schemaVersion: AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
    runId: input.runId,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    mode: input.mode,
    trigger: input.trigger,
    overallStatus,
    agentRunStatus: input.agentRunStatus,
    executiveStatuses: input.executiveStatuses,
    sourceHealthSummary: input.sourceHealth.map((h) => ({
      ...h,
      // Strip verbose errors that might leak secrets — keep count only in errors
      errors: h.errors.map((e) =>
        e.length > 200 ? `${e.slice(0, 200)}…` : e,
      ),
    })),
    degradedStateSummary: input.degradedStateSummary,
    findingCount: input.findings.length,
    recommendationCount: input.recommendations.length,
    founderPriorityCount: input.founderPriorityIds.length,
    persistedItemChanges: changes,
    errorSummary: input.errorSummary,
    recommendationAvailability: input.recommendationAvailability,
    briefEvidenceQuality: input.briefEvidenceQuality,
    deliveryGuidance: input.deliveryGuidance,
    persistenceWriteOk,
    adapterId: meta.adapterId,
    durability: meta.durability,
  };
}

function trimRuns(runs: AgentOsRunRecord[]): AgentOsRunRecord[] {
  if (runs.length <= MAX_RETAINED_RUNS) return runs;
  return runs.slice(runs.length - MAX_RETAINED_RUNS);
}
