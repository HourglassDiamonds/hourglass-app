/**
 * Client Journey founder-ranking policy + semantic dedupe.
 * Scoped to BI journey recommendations; applied in Chief of Staff synthesis.
 */

import type { Recommendation } from "../../types";
import {
  CONVERSION_EVENT_MEASUREMENT_GAP_ID,
  JOURNEY_PATH_MEASUREMENT_GAP_ID,
  JOURNEY_ROOT_SOURCE_GAP_IDS,
  SOURCE_TO_LEAD_ATTRIBUTION_GAP_ID,
  TOOL_COMPLETION_MEASUREMENT_GAP_ID,
} from "./types";

export type JourneyDedupeFamily =
  | "journey-path-measurement"
  | "conversion-event-measurement"
  | "tool-completion-measurement"
  | "high-entry-weak-next"
  | "fragmented-journey"
  | "tool-to-conversation"
  | "landing-intent-mismatch";

/**
 * Stable semantic key for journey dedupe. Null when outside journey scope.
 */
export function buildJourneySemanticDedupeKey(
  rec: Recommendation,
): string | null {
  const family = classifyJourneyDedupeFamily(rec.recommendationId);
  if (!family) return null;
  return `journey|${family}`;
}

export function classifyJourneyDedupeFamily(
  recommendationId: string,
): JourneyDedupeFamily | null {
  const id = recommendationId.toLowerCase();
  if (
    id === JOURNEY_PATH_MEASUREMENT_GAP_ID ||
    id.includes("journey-path-measurement") ||
    id.includes("source-unavailable:journey-path")
  ) {
    return "journey-path-measurement";
  }
  if (
    id === CONVERSION_EVENT_MEASUREMENT_GAP_ID ||
    id.includes("conversion-event-measurement") ||
    id.includes("conversion-signal-unknown")
  ) {
    return "conversion-event-measurement";
  }
  if (
    id === TOOL_COMPLETION_MEASUREMENT_GAP_ID ||
    id.includes("tool-completion")
  ) {
    return "tool-completion-measurement";
  }
  if (id.includes("high-entry-weak-next")) return "high-entry-weak-next";
  if (id.includes("fragmented-journey") || id.includes("fragmented-commercial")) {
    return "fragmented-journey";
  }
  if (id.includes("tool-to-conversation")) return "tool-to-conversation";
  if (id.includes("landing-intent-mismatch")) return "landing-intent-mismatch";
  if (id.includes(":journey:")) {
    // Generic journey — use last segment family hint
    if (id.includes("weak-next")) return "high-entry-weak-next";
  }
  return null;
}

/**
 * Consolidate duplicate symptoms of the same root journey problem.
 */
export function consolidateJourneyDuplicates(
  recommendations: Recommendation[],
): Recommendation[] {
  const groups = new Map<string, Recommendation[]>();
  const passthrough: Recommendation[] = [];

  for (const rec of recommendations) {
    const key = buildJourneySemanticDedupeKey(rec);
    if (!key) {
      passthrough.push(rec);
      continue;
    }
    const list = groups.get(key) ?? [];
    list.push(rec);
    groups.set(key, list);
  }

  const out: Recommendation[] = [...passthrough];

  for (const [, group] of groups) {
    if (group.length === 1) {
      out.push(group[0]!);
      continue;
    }
    const sorted = [...group].sort(
      (a, b) => journeyPreference(b) - journeyPreference(a),
    );
    const canonical = sorted[0]!;
    out.push(canonical);
    for (const dup of sorted.slice(1)) {
      out.push({
        ...dup,
        status: "consolidated",
        agendaBucket: "ignore",
        priorityScore: 0,
        blockedReasons: [
          ...(dup.blockedReasons ?? []),
          `Consolidated into journey canonical ${canonical.recommendationId}`,
        ],
        dependencies: [
          ...new Set([...(dup.dependencies ?? []), canonical.recommendationId]),
        ],
      });
    }
  }

  return out;
}

/**
 * Founder-ranking safeguards for journey recommendations.
 */
export function applyJourneyFounderRankingGate(
  recommendations: Recommendation[],
): Recommendation[] {
  let repoBackedAllowed = 0;
  const MAX_REPO_BACKED = 1;

  return recommendations.map((rec) => {
    if (rec.status === "consolidated" || rec.status === "ignore") return rec;

    if (!isJourneyRecommendation(rec)) return rec;

    if (isJourneyInternalHandoff(rec)) {
      return demoteFromFounderRanking(
        rec,
        "Internal journey handoff — not founder-rankable",
      );
    }

    if (isDiagnosticOnlyRootGap(rec)) {
      return demoteFromFounderRanking(
        rec,
        "Diagnostic journey source gap suppressed from founder ranking",
      );
    }

    // Path measurement is internal analytics readiness — not a founder priority
    // unless a future gate explicitly re-enables mayAppearIndependentlyInBrief.
    if (rec.recommendationId === JOURNEY_PATH_MEASUREMENT_GAP_ID) {
      return demoteFromFounderRanking(
        rec,
        "Journey path measurement is an internal analytics prerequisite — not a standalone founder priority",
      );
    }

    if (isUnknownStateFlood(rec)) {
      return demoteFromFounderRanking(
        rec,
        "Unknown-state journey dimension suppressed from founder ranking",
      );
    }

    if (isRepositoryOnlyJourney(rec)) {
      if (repoBackedAllowed >= MAX_REPO_BACKED) {
        return demoteFromFounderRanking(
          rec,
          "Repository-only journey findings are capped in the founder brief",
        );
      }
      repoBackedAllowed += 1;
    }

    return rec;
  });
}

/**
 * Prefer conversion measurement prerequisites ahead of dependent optimization
 * when conversion evidence is missing. Path measurement is diagnostic-only and
 * does not auto-boost into the founder brief.
 */
export function sequenceJourneyMeasurementPrerequisites(
  recommendations: Recommendation[],
): Recommendation[] {
  const prereqIds = new Set<string>([CONVERSION_EVENT_MEASUREMENT_GAP_ID]);

  const prereqs = recommendations.filter((r) =>
    prereqIds.has(r.recommendationId),
  );
  if (prereqs.length === 0) return recommendations;

  return recommendations.map((rec) => {
    if (!isJourneyRecommendation(rec)) return rec;
    if (prereqIds.has(rec.recommendationId)) {
      return {
        ...rec,
        urgency: rec.urgency === "low" ? "high" : rec.urgency,
        priorityScore: Math.max(rec.priorityScore, rec.priorityScore + 0.05),
        rankingFactors: {
          ...rec.rankingFactors,
          urgency: Math.max(rec.rankingFactors.urgency, 8),
          expectedBusinessImpact: Math.max(
            rec.rankingFactors.expectedBusinessImpact,
            8,
          ),
        },
      };
    }

    if (
      isJourneyOptimizationAction(rec) &&
      prereqs.some(
        (p) =>
          p.status !== "consolidated" &&
          p.status !== "ignore" &&
          p.status !== "blocked",
      )
    ) {
      return {
        ...rec,
        dependencies: [
          ...new Set([
            ...(rec.dependencies ?? []),
            ...prereqs.map((p) => p.recommendationId),
          ]),
        ],
        priorityScore: Math.min(rec.priorityScore, rec.priorityScore * 0.55),
        rankingFactors: {
          ...rec.rankingFactors,
          dependencyReadiness: Math.min(
            rec.rankingFactors.dependencyReadiness,
            0.35,
          ),
        },
        blockedReasons: [
          ...(rec.blockedReasons ?? []),
          "Sequenced after journey measurement prerequisite",
        ],
      };
    }

    return rec;
  });
}

export function isJourneyRecommendation(rec: Recommendation): boolean {
  return (
    rec.recommendationId.includes(":journey:") ||
    JOURNEY_ROOT_SOURCE_GAP_IDS.includes(
      rec.recommendationId as (typeof JOURNEY_ROOT_SOURCE_GAP_IDS)[number],
    )
  );
}

function isJourneyInternalHandoff(rec: Recommendation): boolean {
  const text = `${rec.title} ${rec.plainLanguageExplanation}`.toLowerCase();
  return (
    /handoff to (search|content|opportunity)/i.test(text) ||
    /execution owner: (content|search)/i.test(text) ||
    rec.recommendationId.includes("landing-intent-mismatch") ||
    rec.recommendationId.includes("content-to-tool") ||
    rec.recommendationId.includes("trust-surface-underuse")
  );
}

function isDiagnosticOnlyRootGap(rec: Recommendation): boolean {
  return (
    rec.recommendationId === TOOL_COMPLETION_MEASUREMENT_GAP_ID ||
    rec.recommendationId === SOURCE_TO_LEAD_ATTRIBUTION_GAP_ID ||
    rec.recommendationId === JOURNEY_PATH_MEASUREMENT_GAP_ID
  );
}

function isUnknownStateFlood(rec: Recommendation): boolean {
  return (
    rec.recommendationId.includes("insufficient-sample") ||
    rec.recommendationId.includes("healthy-journey") ||
    /unknown-state|monitor only/i.test(rec.plainLanguageExplanation)
  );
}

function isRepositoryOnlyJourney(rec: Recommendation): boolean {
  return (
    /evidence class: repository-backed/i.test(rec.plainLanguageExplanation) ||
    rec.recommendationId.includes("dead-end") ||
    rec.recommendationId.includes("unclear-intended") ||
    (rec.evidence.every((e) => e.sourceType === "derived") &&
      /repository/i.test(rec.plainLanguageExplanation))
  );
}

function isJourneyOptimizationAction(rec: Recommendation): boolean {
  const id = rec.recommendationId;
  return (
    id.includes("high-entry-weak-next") ||
    id.includes("fragmented-journey") ||
    id.includes("tool-to-conversation") ||
    /clarify|inspect on-page next-step|improve.*path/i.test(rec.proposedAction)
  );
}

function journeyPreference(rec: Recommendation): number {
  let score = rec.priorityScore * 10;
  const id = rec.recommendationId;
  // Path measurement must not outrank conversion or observed journey work
  if (id === JOURNEY_PATH_MEASUREMENT_GAP_ID) score -= 40;
  if (id === CONVERSION_EVENT_MEASUREMENT_GAP_ID) score += 75;
  if (id.includes("high-entry-weak-next")) score += 40;
  if (id.includes("fragmented")) score += 35;
  if (/evidence class: observed-analytics/i.test(rec.plainLanguageExplanation)) {
    score += 25;
  }
  if (/evidence class: repository-backed/i.test(rec.plainLanguageExplanation)) {
    score -= 15;
  }
  if (/evidence class: inferred/i.test(rec.plainLanguageExplanation)) {
    score -= 10;
  }
  return score;
}

function demoteFromFounderRanking(
  rec: Recommendation,
  reason: string,
): Recommendation {
  return {
    ...rec,
    status: "ignore",
    agendaBucket: "ignore",
    priorityScore: Math.min(rec.priorityScore, 0.01),
    blockedReasons: [...(rec.blockedReasons ?? []), reason],
  };
}
