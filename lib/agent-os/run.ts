/**
 * Hourglass Agent OS V1 — run orchestrator.
 *
 * SERVER ONLY — do not import from Client Components.
 * Reads adapters may load env, GA4, GSC, and Supabase weekly-report helpers.
 * Prefer importing this module (or adapters/load) only from Node scripts,
 * Route Handlers, or other server modules — never from `"use client"` files.
 */

import { randomUUID } from "node:crypto";
import { loadAllSources, getFixtureReportingPeriod, getLiveAgentOsReportingPeriod } from "./adapters/load";
import type { AdapterMode } from "./adapters/types";
import { runBusinessIntelligence } from "./executives/business-intelligence";
import { emptyBusinessIntelligenceOutput } from "./bi/empty";
import { runChiefOfStaff } from "./executives/chief-of-staff";
import {
  emptyContentExecutiveOutput,
  runContentExecutive,
} from "./executives/content";
import {
  emptyOpportunityExecutiveOutput,
  runOpportunityExecutive,
} from "./executives/opportunity";
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
  resolveOpportunityExecutiveStatus,
  resolveSearchExecutiveStatus,
} from "./delivery";
import { AGENT_OS_VERSION, type AgentRun, type DataSourceId } from "./types";
import type { BriefCadenceIntent } from "./brief-quality";
import {
  persistAgentOsRun,
  resolvePersistenceAdapter,
  resolveFounderSurfaceEligibility,
  type PersistAgentOsRunResult,
} from "./persistence";
import type {
  AgentOsPersistedState,
  PersistenceAdapterId,
  RunTrigger,
} from "./persistence/types";
import type { AgentOsPersistenceStore } from "./persistence/store";
import { isPersistenceError } from "./persistence/store";
import { AgentOsPersistenceError } from "./persistence/types";

export type RunAgentOsOptions = {
  mode?: AdapterMode;
  reportingPeriod?: { start: string; end: string };
  synthesisProvider?: AgentOsSynthesisProvider;
  /**
   * Cadence intent for CoS framing + priority selection.
   * Same orchestrator; daily vs weekly product intent only.
   */
  briefCadenceIntent?: BriefCadenceIntent;
  /** America/New_York YYYY-MM-DD for daily Morning Brief framing. */
  briefLocalDate?: string;
  /** When true, skip any persistence — Decision Journal must not write in production runs */
  allowDecisionJournalWrite?: boolean;
  /**
   * When set: load prior → reconcile eligibility → CoS brief → atomic save.
   * Recurrence gate runs before founder brief surfacing.
   */
  persistence?: {
    enabled: boolean;
    trigger?: RunTrigger;
    adapter?: PersistenceAdapterId;
    store?: AgentOsPersistenceStore;
    filePath?: string;
    /** Explicit non-durable live memory — never implicit. */
    allowNonDurableLive?: boolean;
    /**
     * When true, persistence write/load failure cannot leave overall status as plain completed.
     * Defaults true for live + scheduled trigger.
     */
    requirePersistenceWrite?: boolean;
    /** Bypass recurrence cooldown (only when explicitly requested). */
    onDemandRecurrenceBypass?: boolean;
    now?: string;
  };
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
    (mode === "fixture" ? getFixtureReportingPeriod() : getLiveAgentOsReportingPeriod());

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
        ...emptyBusinessIntelligenceOutput(
          fatalError ?? "Live run blocked — conversion audit not executed",
        ),
        dataGaps: [
          {
            id: "gap-live-load-fatal",
            sourceId: "ga4" as const,
            description: fatalError ?? "Live run blocked",
            impactOnRecommendations:
              "No recommendations emitted — live mode does not substitute fixture data",
            suggestedRemedy:
              "Configure read-only GA4/GSC/weekly sources or use --fixture",
          },
        ],
      }
    : runBusinessIntelligence(bundle, reportingPeriod, { mode });

  // Search Strategy still runs repository authority analysis when GSC is down,
  // unless the entire live load was aborted for fixture leakage / fatal error.
  const search = skipSynthesis
    ? emptySearchStrategyOutput()
    : runSearchStrategy(bundle, reportingPeriod, { mode });

  const content = skipSynthesis
    ? emptyContentExecutiveOutput()
    : runContentExecutive(bundle, reportingPeriod, { search, bi });

  // Fixture mode includes rejected-example transparency; live never uses fixture opportunity data.
  const opportunity = skipSynthesis
    ? emptyOpportunityExecutiveOutput()
    : runOpportunityExecutive(bundle, reportingPeriod, {
        search,
        content,
        bi,
        includeRejectedExamples: mode === "fixture",
      });

  const provisionalMaterial =
    countMaterialRecommendations(bi.recommendations) +
    countMaterialRecommendations(search.recommendations) +
    countMaterialRecommendations(content.recommendations) +
    countMaterialRecommendations(opportunity.recommendations);
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

  // --- Persistence load + recurrence eligibility BEFORE Chief of Staff brief ranking ---
  const persistOpts = options.persistence;
  const persistTrigger: RunTrigger = persistOpts?.trigger ?? "manual";
  const persistNow = persistOpts?.now ?? new Date().toISOString();
  const requirePersistenceWrite =
    persistOpts?.requirePersistenceWrite ??
    (persistOpts?.enabled === true &&
      mode === "live" &&
      persistTrigger === "scheduled");
  const onDemandRecurrenceBypass =
    persistOpts?.onDemandRecurrenceBypass === true ||
    persistTrigger === "on-demand";

  let priorState: AgentOsPersistedState | null = null;
  let founderSurfaceEligibleIds: string[] | null = null;
  let persistenceLoadError: string | null = null;
  let resolvedStore: AgentOsPersistenceStore | undefined = persistOpts?.store;
  let resolvedAdapterMeta: {
    adapterId: string;
    durabilityLabel: string;
    nonDurableLive: boolean;
  } | null = null;

  if (persistOpts?.enabled) {
    try {
      if (!resolvedStore) {
        const resolved = resolvePersistenceAdapter({
          mode,
          adapter: persistOpts.adapter,
          filePath: persistOpts.filePath,
          allowNonDurableLive: persistOpts.allowNonDurableLive,
          requireDurableInLive:
            mode === "live" && persistTrigger === "scheduled",
        });
        resolvedStore = resolved.store;
        resolvedAdapterMeta = {
          adapterId: resolved.adapterId,
          durabilityLabel: resolved.durabilityLabel,
          nonDurableLive: resolved.nonDurableLive,
        };
      } else {
        resolvedAdapterMeta = {
          adapterId: resolvedStore.adapterId,
          durabilityLabel: resolvedStore.durability,
          nonDurableLive:
            mode === "live" && resolvedStore.adapterId === "memory",
        };
      }
      priorState = await resolvedStore.load();
      if (mode === "live" && priorState.modeScope === "fixture") {
        throw new AgentOsPersistenceError(
          "fixture-leak",
          "Live mode refused to load fixture-scoped persisted state",
        );
      }
      const mergedForGate = [
        ...bi.recommendations,
        ...search.recommendations,
        ...content.recommendations,
        ...opportunity.recommendations,
      ];
      const eligibility = resolveFounderSurfaceEligibility({
        recommendations: mergedForGate,
        priorRecommendations: priorState.recommendations,
        nowIso: persistNow,
        onDemand: onDemandRecurrenceBypass,
      });
      founderSurfaceEligibleIds = eligibility.eligibleIds;
    } catch (err) {
      persistenceLoadError =
        err instanceof Error ? err.message : "persistence load failed";
      warnings.push(
        `Persistence load ${isPersistenceError(err) ? err.code : "error"}: ${redactSecretsAndPii(persistenceLoadError)}`,
      );
      if (requirePersistenceWrite) {
        // Gate open (null) so CoS can still produce a brief; status adjusted after.
        founderSurfaceEligibleIds = null;
      } else {
        founderSurfaceEligibleIds = null;
      }
    }
  }

  const cos = runChiefOfStaff({
    bi,
    search,
    content,
    opportunity,
    reportingPeriod,
    warnings: warnings.filter((w) => !w.startsWith("Source health summary:")),
    mode,
    briefEvidenceQuality: provisionalEvidenceQuality,
    founderSurfaceEligibleIds,
    briefCadenceIntent: options.briefCadenceIntent,
    briefLocalDate: options.briefLocalDate,
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
        ...opportunity.facts,
        ...bi.dataGaps.map((g) => g.description),
        ...search.dataGaps.map((g) => g.description),
        ...content.dataGaps.map((g) => g.description),
        ...opportunity.dataGaps.map((g) => g.description),
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
      bi.dataGaps.length +
      search.dataGaps.length +
      content.dataGaps.length +
      opportunity.dataGaps.length,
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
    resolveOpportunityExecutiveStatus({
      skipped: skipSynthesis,
      externalTargetsAvailable: Boolean(
        opportunity.strategy.verifiedExternalTargetsAvailable,
      ),
      recommendations: opportunity.recommendations,
      opportunityCount: opportunity.opportunities.length,
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
    dataGaps: [
      ...bi.dataGaps,
      ...search.dataGaps,
      ...content.dataGaps,
      ...opportunity.dataGaps,
    ],
    escalationItems: cos.escalationItems,
    brief,
    runStatus,
    recommendationAvailability,
    executiveStatuses,
    briefEvidenceQuality,
    deliveryGuidance,
    briefSurfacing: {
      opportunitiesDetected:
        search.opportunities.length +
        content.opportunities.length +
        opportunity.opportunities.filter(
          (o) => !o.rejected && o.readiness !== "rejected",
        ).length,
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

  if (options.persistence?.enabled) {
    const startedAtIso = new Date(started).toISOString();
    let persistResult: PersistAgentOsRunResult;
    if (persistenceLoadError && !resolvedStore) {
      persistResult = {
        ok: false,
        summary: null,
        persistenceError: redactSecretsAndPii(persistenceLoadError),
        persistenceErrorCode: "read-failed",
        adapterId: resolvedAdapterMeta?.adapterId ?? persistOpts?.adapter ?? "unknown",
        durabilityLabel: resolvedAdapterMeta?.durabilityLabel ?? "unknown",
        nonDurableLive: resolvedAdapterMeta?.nonDurableLive ?? false,
      };
    } else {
      try {
        persistResult = await persistAgentOsRun({
          run,
          trigger: persistTrigger,
          startedAt: startedAtIso,
          now: persistNow,
          store: resolvedStore,
          resolve: {
            mode,
            adapter: options.persistence.adapter,
            filePath: options.persistence.filePath,
            allowNonDurableLive: options.persistence.allowNonDurableLive,
            requireDurableInLive:
              mode === "live" && persistTrigger === "scheduled",
          },
          requireWriteSuccess: requirePersistenceWrite,
        });
      } catch (err) {
        persistResult = {
          ok: false,
          summary: null,
          persistenceError:
            err instanceof Error ? err.message : "persistence failed",
          persistenceErrorCode: "write-failed",
          adapterId: options.persistence.adapter ?? "unknown",
          durabilityLabel: "unknown",
          nonDurableLive: false,
        };
      }
    }

    run.persistence = {
      attempted: true,
      ok: persistResult.ok,
      adapterId: persistResult.adapterId,
      durabilityLabel: persistResult.durabilityLabel,
      nonDurableLive: persistResult.nonDurableLive,
      error: persistResult.persistenceError,
      errorCode: persistResult.persistenceErrorCode,
      findingChanges: persistResult.summary?.changes.filter(
        (c) => c.kind === "finding",
      ).length,
      recommendationChanges: persistResult.summary?.changes.filter(
        (c) => c.kind === "recommendation",
      ).length,
    };

    if (!persistResult.ok) {
      run.warnings.push(
        `Persistence ${persistResult.persistenceErrorCode ?? "error"}: ${persistResult.persistenceError ?? "write failed"}`,
      );
      if (requirePersistenceWrite) {
        // Must not report plain completed when durable persistence was required.
        if (run.runStatus === "completed") {
          run.runStatus = "completed-with-warnings";
        }
        if (
          persistResult.persistenceErrorCode === "unconfigured" ||
          persistResult.persistenceErrorCode === "write-failed" ||
          persistResult.persistenceErrorCode === "read-failed"
        ) {
          run.deliveryGuidance = "send-failure-alert";
        } else if (run.deliveryGuidance === "send-nothing") {
          run.deliveryGuidance = "send-failure-alert";
        }
      }
    } else if (persistResult.nonDurableLive) {
      run.warnings.push(
        "Live persistence used explicit non-durable in-memory adapter — state will not survive process restart",
      );
    }
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
