/**
 * Hourglass Agent OS V1 — run orchestrator.
 *
 * SERVER ONLY — do not import from Client Components.
 * Reads adapters may load env, GA4, GSC, and Supabase weekly-report helpers.
 * Prefer importing this module (or adapters/load) only from Node scripts,
 * Route Handlers, or other server modules — never from `"use client"` files.
 */

import { randomUUID } from "node:crypto";
import { loadAllSources, getFixtureReportingPeriod } from "./adapters/load";
import type { AdapterMode } from "./adapters/types";
import { runBusinessIntelligence } from "./executives/business-intelligence";
import { runChiefOfStaff } from "./executives/chief-of-staff";
import {
  emptyContentExecutiveOutput,
  runContentExecutive,
} from "./executives/content";
import {
  emptySearchStrategyOutput,
  runSearchStrategy,
} from "./executives/search-strategy";
import { getOpportunityContract } from "./executives/scaffolds";
import {
  deterministicSynthesisProvider,
  type AgentOsSynthesisProvider,
} from "./provider";
import { deepRedactUnknown, redactSecretsAndPii } from "./redaction";
import { summarizeSourceHealth } from "./source-health";
import { listExecutives, operationalExecutives, scaffoldExecutives } from "./registry";
import {
  countMaterialRecommendations,
  criticalSourcesUnavailable,
  resolveRecommendationAvailability,
  resolveRunStatus,
} from "./run-status";
import {
  resolveBiExecutiveStatus,
  resolveBriefEvidenceQuality,
  resolveContentExecutiveStatus,
  resolveDeliveryGuidance,
  resolveSearchExecutiveStatus,
} from "./delivery";
import { AGENT_OS_VERSION, type AgentRun, type DataSourceId } from "./types";
import { getReportWeekRange } from "@/lib/intelligence/week-ranges";

export type RunAgentOsOptions = {
  mode?: AdapterMode;
  reportingPeriod?: { start: string; end: string };
  synthesisProvider?: AgentOsSynthesisProvider;
  /** When true, skip any persistence — Decision Journal must not write in production runs */
  allowDecisionJournalWrite?: boolean;
};

export async function runAgentOsBrief(
  options: RunAgentOsOptions = {},
): Promise<AgentRun> {
  const started = Date.now();
  const mode: AdapterMode = options.mode ?? "fixture";
  const warnings: string[] = [];
  let fatalError: string | null = null;

  if (options.allowDecisionJournalWrite) {
    warnings.push(
      "Decision Journal production writes are disabled in V1; in-memory adapter is test-only",
    );
  }

  const reportingPeriod =
    options.reportingPeriod ??
    (mode === "fixture" ? getFixtureReportingPeriod() : getReportWeekRange());

  const executivesInvoked = operationalExecutives().map((e) => e.id);
  const executivesNotOperational = scaffoldExecutives().map((e) => e.id);

  void getOpportunityContract();

  let bundle;
  try {
    bundle = await loadAllSources(mode);
  } catch (err) {
    const message = redactSecretsAndPii(
      err instanceof Error ? err.message : "source load failed",
    );
    // Live mode must never fall back to fixtures — that would invent evidence.
    if (mode === "live") {
      fatalError = `Live source load failed without fixture fallback: ${message}`;
      warnings.push(fatalError);
      bundle = await loadAllSourcesEmptyLiveFailure(message);
    } else {
      warnings.push(`Source load threw unexpectedly: ${message}`);
      bundle = await loadAllSources("fixture");
      warnings.push("Fixture mode recovered via fixture sources after load throw");
    }
  }

  // Live mode invariant: no fixture retrieval states in the bundle
  if (mode === "live") {
    const fixtureLeak = [
      bundle.ga4,
      bundle.gsc,
      bundle.weeklyIntelligence,
    ].filter((s) => s.health.retrievalState === "fixture");
    if (fixtureLeak.length > 0) {
      fatalError =
        fatalError ??
        "Live mode refused fixture data — aborting recommendation synthesis";
      warnings.push(fatalError);
    }
  }

  const sourcesAttempted: DataSourceId[] = [
    "ga4",
    "gsc",
    "weekly-intelligence",
    "hubspot-aggregates",
    "buffer",
    "gbp",
  ];

  const sourceHealth = [
    bundle.ga4.health,
    bundle.gsc.health,
    bundle.weeklyIntelligence.health,
    bundle.hubspotAggregates.health,
    bundle.buffer.health,
    bundle.gbp.health,
  ];

  if (bundle.ga4.failed) {
    warnings.push("GA4 adapter failed — continuing with remaining sources");
  }
  if (bundle.gsc.failed) {
    warnings.push("GSC adapter failed — continuing with remaining sources");
  }
  if (bundle.weeklyIntelligence.failed) {
    warnings.push("Weekly intelligence adapter failed — continuing");
  }

  // Keep detailed source-health in structured JSON; one short warning line only.
  warnings.push(`Source health summary: ${summarizeSourceHealth(sourceHealth)}`);

  const criticalDown = criticalSourcesUnavailable(bundle);
  const skipSynthesis =
    Boolean(fatalError) ||
    (mode === "live" &&
      [bundle.ga4, bundle.gsc, bundle.weeklyIntelligence].some(
        (s) => s.health.retrievalState === "fixture",
      ));

  const bi = skipSynthesis
    ? {
        recommendations: [],
        anomalies: [],
        dataGaps: [
          {
            id: "gap-live-load-fatal",
            sourceId: "ga4",
            description: fatalError ?? "Live run blocked",
            impactOnRecommendations:
              "No recommendations emitted — live mode does not substitute fixture data",
            suggestedRemedy: "Configure read-only GA4/GSC/weekly sources or use --fixture",
          },
        ],
        keyMetricChanges: [],
        facts: [],
        inferences: [],
        incompleteAttribution: false,
      }
    : runBusinessIntelligence(bundle, reportingPeriod);

  // Search Strategy still runs repository authority analysis when GSC is down,
  // unless the entire live load was aborted for fixture leakage / fatal error.
  const search = skipSynthesis
    ? emptySearchStrategyOutput()
    : runSearchStrategy(bundle, reportingPeriod);

  const content = skipSynthesis
    ? emptyContentExecutiveOutput()
    : runContentExecutive(bundle, reportingPeriod, { search, bi });

  const provisionalMaterial =
    countMaterialRecommendations(bi.recommendations) +
    countMaterialRecommendations(search.recommendations) +
    countMaterialRecommendations(content.recommendations);
  const provisionalEvidenceQuality = resolveBriefEvidenceQuality({
    runStatus: fatalError
      ? "failed"
      : criticalDown
        ? "blocked"
        : "completed",
    fatalError,
    criticalSourcesDown: criticalDown || Boolean(fatalError),
    materialCount: provisionalMaterial,
  });

  const cos = runChiefOfStaff({
    bi,
    search,
    content,
    reportingPeriod,
    warnings: warnings.filter((w) => !w.startsWith("Source health summary:")),
    mode,
    briefEvidenceQuality: provisionalEvidenceQuality,
  });

  const provider =
    options.synthesisProvider ?? deterministicSynthesisProvider;
  const brief = await provider.synthesizeFounderBrief({
    approvedContext: redactSecretsAndPii(
      [
        `mode=${mode}`,
        `briefEvidenceQuality=${provisionalEvidenceQuality}`,
        ...bi.facts,
        ...bi.keyMetricChanges,
        ...search.facts,
        ...content.facts,
        ...bi.dataGaps.map((g) => g.description),
        ...search.dataGaps.map((g) => g.description),
        ...content.dataGaps.map((g) => g.description),
      ].join("\n"),
    ),
    deterministicBrief: cos.brief,
  });

  const materialCount = countMaterialRecommendations(cos.recommendations);
  const recommendationAvailability = resolveRecommendationAvailability({
    materialCount,
    criticalSourcesDown: criticalDown || Boolean(fatalError),
  });

  const runStatus = resolveRunStatus({
    criticalSourcesDown: criticalDown,
    fatalError,
    warningCount: warnings.length,
    dataGapCount:
      bi.dataGaps.length + search.dataGaps.length + content.dataGaps.length,
    recommendationAvailability,
  });

  const briefEvidenceQuality = resolveBriefEvidenceQuality({
    runStatus,
    fatalError,
    criticalSourcesDown: criticalDown || Boolean(fatalError),
    materialCount,
  });

  const gscAvailable =
    bundle.gsc.ok &&
    bundle.gsc.data?.current != null &&
    bundle.gsc.health.retrievalState !== "failed" &&
    bundle.gsc.health.retrievalState !== "not-configured";

  const bufferAvailable =
    bundle.buffer.ok && bundle.buffer.health.retrievalState === "ok";

  const executiveStatuses = [
    resolveBiExecutiveStatus({
      skipped: skipSynthesis,
      criticalAnalyticsDown: criticalDown,
      dataGapCount: bi.dataGaps.length,
      recommendations: bi.recommendations,
    }),
    resolveSearchExecutiveStatus({
      skipped: skipSynthesis,
      gscAvailable: Boolean(gscAvailable),
      recommendations: search.recommendations,
      opportunityCount: search.opportunities.length,
    }),
    resolveContentExecutiveStatus({
      skipped: skipSynthesis,
      bufferAvailable: Boolean(bufferAvailable),
      recommendations: content.recommendations,
      opportunityCount: content.opportunities.length,
    }),
    {
      executiveId: "chief-of-staff" as const,
      status: skipSynthesis
        ? ("blocked" as const)
        : runStatus === "failed"
          ? ("failed" as const)
          : materialCount > 0
            ? ("completed" as const)
            : criticalDown
              ? ("blocked" as const)
              : ("completed" as const),
      materialRecommendationCount: materialCount,
      note: skipSynthesis
        ? "Orchestration aborted for fatal/live-load safety"
        : briefEvidenceQuality === "partial-degraded"
          ? "Partial brief: usable executive findings with critical sources down"
          : undefined,
    },
  ];

  const deliveryGuidance = resolveDeliveryGuidance({
    runStatus,
    recommendationAvailability,
    briefEvidenceQuality,
  });

  const rankedActive = cos.recommendations.filter(
    (r) =>
      r.status !== "blocked" &&
      r.status !== "ignore" &&
      r.status !== "consolidated",
  );

  const run: AgentRun = {
    runId: randomUUID(),
    generatedAt: new Date().toISOString(),
    mode,
    reportingPeriod,
    executivesInvoked,
    executivesNotOperational,
    sourcesAttempted,
    sourceHealth,
    recommendations: cos.recommendations,
    anomalies: bi.anomalies,
    dataGaps: [...bi.dataGaps, ...search.dataGaps, ...content.dataGaps],
    escalationItems: cos.escalationItems,
    brief,
    runStatus,
    recommendationAvailability,
    executiveStatuses,
    briefEvidenceQuality,
    deliveryGuidance,
    briefSurfacing: {
      opportunitiesDetected:
        search.opportunities.length + content.opportunities.length,
      recommendationsRanked: rankedActive.length,
      recommendationsSurfacedInBrief: cos.surfacedInBriefCount,
    },
    durationMs: Date.now() - started,
    warnings: warnings.map(redactSecretsAndPii),
    agentOsVersion: AGENT_OS_VERSION,
  };

  if (mode === "fixture" && materialCount < 3) {
    run.warnings.push(
      `Fixture run produced ${materialCount} material recommendations (expected ≥3)`,
    );
  }

  return deepRedactUnknown(run) as AgentRun;
}

export function listAgentOsExecutives() {
  return listExecutives();
}

/** Empty live failure bundle — never uses fixture sample metrics. */
async function loadAllSourcesEmptyLiveFailure(reason: string) {
  const { buildSourceHealth } = await import("./source-health");
  const failed = (sourceId: "ga4" | "gsc" | "weekly-intelligence") => ({
    sourceId,
    ok: false as const,
    data: null,
    empty: false,
    failed: true,
    health: buildSourceHealth({
      sourceId,
      configured: false,
      reachable: false,
      fresh: false,
      complete: false,
      permissionPosture: "read-only",
      lastSuccessfulRead: null,
      errors: [reason],
      retrievalState: "failed",
    }),
  });
  const notConfigured = (
    sourceId: "hubspot-aggregates" | "buffer" | "gbp",
    msg: string,
  ) => ({
    sourceId,
    ok: false as const,
    data: null,
    empty: false,
    failed: false,
    health: buildSourceHealth({
      sourceId,
      configured: false,
      reachable: false,
      fresh: false,
      complete: false,
      permissionPosture: "unknown",
      lastSuccessfulRead: null,
      errors: [msg],
      retrievalState: "not-configured",
    }),
  });

  return {
    ga4: failed("ga4"),
    gsc: failed("gsc"),
    weeklyIntelligence: failed("weekly-intelligence"),
    hubspotAggregates: notConfigured(
      "hubspot-aggregates",
      "No verified HubSpot aggregate weekly read adapter in Agent OS V1",
    ),
    buffer: notConfigured(
      "buffer",
      "No Buffer adapter — social metrics must not be fabricated",
    ),
    gbp: notConfigured(
      "gbp",
      "No Google Business Profile adapter — local metrics unavailable",
    ),
  };
}
