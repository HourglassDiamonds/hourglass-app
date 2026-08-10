/**
 * Extract persistable findings/recommendations from an AgentRun.
 * Uses normalized metadata only — no raw analytics payloads, no PII.
 */

import type { AgentRun, Recommendation } from "../types";
import {
  CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID,
} from "../bi/types";
import { GBP_ROOT_SOURCE_GAP_ID } from "../search/local/types";
import {
  JOURNEY_PATH_MEASUREMENT_GAP_ID,
  CONVERSION_EVENT_MEASUREMENT_GAP_ID,
  TOOL_COMPLETION_MEASUREMENT_GAP_ID,
  SOURCE_TO_LEAD_ATTRIBUTION_GAP_ID,
} from "../bi/journey/types";
import {
  buildEvidenceFingerprint,
  confidenceBucket,
  extractMetricTokens,
} from "./fingerprint";
import type {
  PersistableFindingInput,
  PersistableRecommendationInput,
  PersistedExecutiveRunRecord,
  RunPersistenceInput,
  RunTrigger,
} from "./types";
import { AGENT_OS_PERSISTENCE_SCHEMA_VERSION } from "./types";
import { canonicalIdForRecommendationId } from "../operating-backlog/canonical";

const KNOWN_ROOTS = new Set<string>([
  CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID,
  GBP_ROOT_SOURCE_GAP_ID,
  JOURNEY_PATH_MEASUREMENT_GAP_ID,
  CONVERSION_EVENT_MEASUREMENT_GAP_ID,
  TOOL_COMPLETION_MEASUREMENT_GAP_ID,
  SOURCE_TO_LEAD_ATTRIBUTION_GAP_ID,
]);

const JOURNEY_ROOTS = new Set<string>([
  JOURNEY_PATH_MEASUREMENT_GAP_ID,
  CONVERSION_EVENT_MEASUREMENT_GAP_ID,
  TOOL_COMPLETION_MEASUREMENT_GAP_ID,
  SOURCE_TO_LEAD_ATTRIBUTION_GAP_ID,
]);

export function inferRootProblemId(recommendationId: string): string | null {
  if (KNOWN_ROOTS.has(recommendationId)) return recommendationId;
  const backlogCanonical = canonicalIdForRecommendationId(recommendationId);
  if (backlogCanonical) return backlogCanonical;
  if (recommendationId.includes("concierge-conversion")) {
    return CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID;
  }
  if (recommendationId.includes("gbp") || recommendationId.includes("google-business")) {
    return GBP_ROOT_SOURCE_GAP_ID;
  }
  for (const root of JOURNEY_ROOTS) {
    if (recommendationId.startsWith(root.split(":").slice(0, 3).join(":"))) {
      // journey findings share business-intelligence:journey prefix
    }
  }
  if (recommendationId.includes(":journey:")) {
    if (recommendationId.includes("path")) return JOURNEY_PATH_MEASUREMENT_GAP_ID;
    if (recommendationId.includes("conversion-event")) {
      return CONVERSION_EVENT_MEASUREMENT_GAP_ID;
    }
    if (recommendationId.includes("tool-completion")) {
      return TOOL_COMPLETION_MEASUREMENT_GAP_ID;
    }
    if (recommendationId.includes("attribution")) {
      return SOURCE_TO_LEAD_ATTRIBUTION_GAP_ID;
    }
  }
  return null;
}

export function recommendationIsFounderRankable(rec: Recommendation): boolean {
  if (
    rec.status === "blocked" ||
    rec.status === "ignore" ||
    rec.status === "consolidated"
  ) {
    return false;
  }
  if (rec.agendaBucket === "ignore") return false;
  // Journey measurement roots are non-founder-rankable prerequisites
  if (JOURNEY_ROOTS.has(rec.recommendationId)) return false;
  if (
    rec.blockedReasons?.some((b) =>
      /not founder-rankable|internal.*handoff|measurement prerequisite/i.test(b),
    )
  ) {
    return false;
  }
  return true;
}

/**
 * Evidence fingerprint for lifecycle / reopen detection.
 * Excludes proposedAction wording so copy edits alone cannot reopen completed work.
 * Material regression must change evidence dimensions, severity, or blockers.
 */
export function fingerprintForRecommendation(rec: Recommendation): string {
  const dims = [
    ...rec.evidence.map(
      (e) =>
        `${e.source}:${truncate(e.metricOrObservation, MAX_EVIDENCE_OBS)}`,
    ),
    ...extractMetricTokens(truncate(rec.plainLanguageExplanation, MAX_SUMMARY)),
  ];
  const isBacklog = rec.recommendationId.startsWith("operating-backlog:");
  return buildEvidenceFingerprint({
    stableId: rec.recommendationId,
    rootProblemId: inferRootProblemId(rec.recommendationId),
    owningExecutive: rec.originatingExecutive,
    evidenceClass: rec.evidence[0]?.sourceType ?? "derived",
    evidenceDimensions: dims,
    severity: rec.urgency,
    // Confidence wobble must not reopen terminal work.
    confidenceBucket: isBacklog ? "high" : confidenceBucket(rec.confidence),
    sourceHealth: rec.evidence[0]?.reliability ?? "unverified",
    blockers: (rec.blockedReasons ?? [])
      .slice(0, MAX_BLOCKERS)
      .map((b) => truncate(b, MAX_BLOCKER_LEN)),
    dependencies: rec.dependencies
      .slice(0, MAX_DEPS)
      .map((d) => truncate(d, MAX_DEP_LEN)),
    // Deliberately omit actionToken — wording ≠ new evidence.
  });
}

/** Hard bounds so unexpectedly large source text cannot grow storage unboundedly. */
export const PERSISTENCE_FIELD_BOUNDS = {
  summary: 200,
  action: 240,
  evidenceObservation: 160,
  blocker: 160,
  dependency: 120,
  maxBlockers: 8,
  maxDependencies: 12,
  errorLine: 200,
} as const;

const MAX_SUMMARY = PERSISTENCE_FIELD_BOUNDS.summary;
const MAX_ACTION = PERSISTENCE_FIELD_BOUNDS.action;
const MAX_EVIDENCE_OBS = PERSISTENCE_FIELD_BOUNDS.evidenceObservation;
const MAX_BLOCKERS = PERSISTENCE_FIELD_BOUNDS.maxBlockers;
const MAX_BLOCKER_LEN = PERSISTENCE_FIELD_BOUNDS.blocker;
const MAX_DEPS = PERSISTENCE_FIELD_BOUNDS.maxDependencies;
const MAX_DEP_LEN = PERSISTENCE_FIELD_BOUNDS.dependency;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function extractPersistableFromRun(
  run: AgentRun,
  options?: {
    trigger?: RunTrigger;
    startedAt?: string;
    now?: string;
  },
): RunPersistenceInput {
  const now = options?.now ?? run.generatedAt;
  const startedAt =
    options?.startedAt ??
    new Date(Date.parse(run.generatedAt) - run.durationMs).toISOString();

  const surfaced = new Set(run.brief.surfacedPriorityTitles.map((t) => t));
  const founderPriorityIds: string[] = [];

  const recommendations: PersistableRecommendationInput[] = [];
  const findings: PersistableFindingInput[] = [];
  const findingIdsByExec = new Map<string, string[]>();
  const recIdsByExec = new Map<string, string[]>();

  const comparableHealthy = run.sourceHealth.some(
    (h) =>
      h.retrievalState === "ok" ||
      h.retrievalState === "fixture" ||
      h.retrievalState === "empty",
  );

  for (const rec of run.recommendations) {
    if (rec.status === "consolidated") continue;
    const fp = fingerprintForRecommendation(rec);
    const root = inferRootProblemId(rec.recommendationId);
    const founderRankable = recommendationIsFounderRankable(rec);
    const founderSurfaced =
      founderRankable &&
      (surfaced.has(rec.title) ||
        run.brief.needsAttentionToday.includes(rec.title) ||
        run.brief.highestRoiAction.includes(rec.title));

    if (founderSurfaced) founderPriorityIds.push(rec.recommendationId);

    const handoff =
      rec.blockedReasons
        ?.find((b) => /handoff/i.test(b))
        ?.match(/handoff(?: to)?\s+([a-z-]+)/i)?.[1] ?? null;

    recommendations.push({
      recommendationId: rec.recommendationId,
      owningExecutive: rec.originatingExecutive,
      handoffTarget: handoff,
      priorityScore: rec.priorityScore,
      confidence: rec.confidence,
      founderRankable,
      currentAction: truncate(rec.proposedAction, MAX_ACTION),
      rootProblemId: root,
      dependencies: rec.dependencies
        .slice(0, MAX_DEPS)
        .map((d) => truncate(d, MAX_DEP_LEN)),
      blockers: (rec.blockedReasons ?? [])
        .slice(0, MAX_BLOCKERS)
        .map((b) => truncate(b, MAX_BLOCKER_LEN)),
      evidenceFingerprint: fp,
      urgency: rec.urgency,
      founderSurfaced,
      lifecycleHint: rec.status === "blocked" ? "blocked" : undefined,
    });

    findings.push({
      findingId: rec.recommendationId,
      owningExecutive: rec.originatingExecutive,
      summary: truncate(rec.title, MAX_SUMMARY),
      evidenceClass: rec.evidence[0]?.sourceType ?? "derived",
      confidence: rec.confidence,
      severity: rec.urgency,
      sourceHealth: comparableHealthy
        ? (rec.evidence[0]?.reliability ?? "reliable")
        : "unavailable",
      relatedRecommendationIds: [rec.recommendationId],
      rootProblemId: root,
      evidenceFingerprint: fp,
      comparableSourcesHealthy: comparableHealthy,
      founderSurfaced,
    });

    pushMap(findingIdsByExec, rec.originatingExecutive, rec.recommendationId);
    pushMap(recIdsByExec, rec.originatingExecutive, rec.recommendationId);
  }

  // Data gaps as findings (stable IDs) without duplicating recommendation IDs
  const recIdSet = new Set(recommendations.map((r) => r.recommendationId));
  for (const gap of run.dataGaps) {
    if (recIdSet.has(gap.id)) continue;
    const fp = buildEvidenceFingerprint({
      stableId: gap.id,
      rootProblemId: inferRootProblemId(gap.id),
      evidenceClass: "data-gap",
      evidenceDimensions: extractMetricTokens(gap.description),
      sourceHealth: comparableHealthy ? "degraded" : "unavailable",
    });
    const exec =
      gap.id.startsWith("search-strategy")
        ? ("search-strategy" as const)
        : gap.id.startsWith("content")
          ? ("content" as const)
          : gap.id.startsWith("opportunity")
            ? ("opportunity" as const)
            : ("business-intelligence" as const);
    findings.push({
      findingId: gap.id,
      owningExecutive: exec,
      summary: truncate(gap.description, MAX_SUMMARY),
      evidenceClass: "data-gap",
      confidence: 0.5,
      severity: "medium",
      sourceHealth: comparableHealthy ? "degraded" : "unavailable",
      relatedRecommendationIds: [],
      rootProblemId: inferRootProblemId(gap.id),
      evidenceFingerprint: fp,
      comparableSourcesHealthy: comparableHealthy,
    });
    pushMap(findingIdsByExec, exec, gap.id);
  }

  const executiveStatuses: PersistedExecutiveRunRecord[] =
    run.executiveStatuses.map((e) => ({
      schemaVersion: AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
      executiveId: e.executiveId,
      runId: run.runId,
      startedAt: startedAt,
      completedAt: now,
      status: e.status,
      sourceStatus: e.note ?? e.status,
      findingIds: findingIdsByExec.get(e.executiveId) ?? [],
      recommendationIds: recIdsByExec.get(e.executiveId) ?? [],
      errors: [],
      warnings: e.note ? [e.note] : [],
      durationMs: null,
      outputVersion: "1.0.0",
    }));

  return {
    runId: run.runId,
    startedAt,
    completedAt: now,
    mode: run.mode,
    trigger: options?.trigger ?? "manual",
    agentRunStatus: run.runStatus,
    executiveStatuses,
    sourceHealth: run.sourceHealth,
    degradedStateSummary:
      run.briefEvidenceQuality === "full"
        ? null
        : `briefEvidenceQuality=${run.briefEvidenceQuality}`,
    findings,
    recommendations,
    founderPriorityIds,
    recommendationAvailability: run.recommendationAvailability,
    briefEvidenceQuality: run.briefEvidenceQuality,
    deliveryGuidance: run.deliveryGuidance,
    errorSummary:
      run.runStatus === "failed"
        ? run.warnings.slice(0, 3).join("; ") || "failed"
        : null,
    now,
  };
}

function pushMap(
  map: Map<string, string[]>,
  key: string,
  value: string,
): void {
  const arr = map.get(key) ?? [];
  arr.push(value);
  map.set(key, arr);
}
