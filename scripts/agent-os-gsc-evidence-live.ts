/**
 * Read-only live GSC evidence probe for Search Strategy.
 * Usage: npx tsx --env-file=.env.local scripts/agent-os-gsc-evidence-live.ts
 * Never prints secrets, tokens, or authorization codes.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadGsc, getLiveAgentOsReportingPeriod } from "../lib/agent-os/adapters/load";
import { GSC_EVIDENCE_ADAPTER_TIMEOUT_MS } from "../lib/agent-os/adapters/types";
import type { AgentOsDataBundle } from "../lib/agent-os/adapters/types";
import { runSearchStrategy } from "../lib/agent-os/search";
import { buildGscEvidenceBundle } from "../lib/agent-os/search/gsc-evidence";
import { buildSourceHealth } from "../lib/agent-os/source-health";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

function unavailable(sourceId: AgentOsDataBundle["ga4"]["sourceId"]) {
  return {
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
      retrievalState: "not-configured",
    }),
  };
}

async function main() {
  loadEnvLocal();
  const gscStarted = Date.now();
  const gsc = await loadGsc("live", GSC_EVIDENCE_ADAPTER_TIMEOUT_MS);
  const gscLoadMs = Date.now() - gscStarted;
  const evidence = buildGscEvidenceBundle(gsc.data, { available: gsc.ok });

  const bundle: AgentOsDataBundle = {
    ga4: unavailable("ga4"),
    gsc,
    weeklyIntelligence: unavailable("weekly-intelligence"),
    hubspotAggregates: unavailable("hubspot-aggregates"),
    buffer: unavailable("buffer"),
    gbp: unavailable("gbp"),
  };

  const period =
    gsc.data?.freshness?.windowsUsed.current ?? getLiveAgentOsReportingPeriod();
  const searchStarted = Date.now();
  const search = runSearchStrategy(bundle, period, { mode: "live" });
  const searchStrategyMs = Date.now() - searchStarted;

  const brand = evidence.derived.brandedVsNonBranded;
  const summary = {
  availability: evidence.availability,
  propertyDisplay: evidence.propertyDisplay,
  fetchedAt: evidence.fetchedAt,
  freshness: evidence.freshness
    ? {
        newestFinalizedDate: evidence.freshness.newestFinalizedDate,
        firstIncompleteDate: evidence.freshness.firstIncompleteDate,
        ageDays: evidence.freshness.ageDays,
        lagClassification: evidence.freshness.lagClassification,
        timezone: evidence.freshness.timezone,
      }
    : null,
  window: evidence.window,
  totals: evidence.observed.totals,
  queryCoverage: evidence.retrieval.queries
    ? {
        rowsReturned: evidence.retrieval.queries.rowsReturned,
        requestLimit: evidence.retrieval.queries.requestLimit,
        truncatedOrPotentiallyIncomplete:
          evidence.retrieval.queries.truncatedOrPotentiallyIncomplete,
        labeledAsAllQueries: evidence.retrieval.queries.labeledAsAllQueries,
        note: evidence.retrieval.queries.note,
      }
    : null,
  pageRowsReturned: evidence.observed.pages.length,
  brandSplit: brand
    ? {
        epistemic: brand.epistemic,
        approximate: brand.approximate,
        brandedClicks: brand.branded.clicks,
        brandedImpressions: brand.branded.impressions,
        brandedQueryRows: brand.branded.queryRows,
        nonBrandedClicks: brand.nonBranded.clicks,
        nonBrandedImpressions: brand.nonBranded.impressions,
        nonBrandedQueryRows: brand.nonBranded.queryRows,
      }
    : null,
  commercialPages: evidence.derived.commercialPages.map((p) => ({
    path: p.pathOrPrefix,
    source: p.source,
    state: p.state,
    inGlobalTopPages: p.inGlobalTopPages,
    hasMetrics: p.metrics != null,
    clicks: p.metrics?.clicks ?? null,
    impressions: p.metrics?.impressions ?? null,
    position: p.metrics?.position ?? null,
  })),
  toolPages: evidence.derived.toolPages.map((p) => ({
    path: p.pathOrPrefix,
    source: p.source,
    state: p.state,
    inGlobalTopPages: p.inGlobalTopPages,
    hasMetrics: p.metrics != null,
    clicks: p.metrics?.clicks ?? null,
    impressions: p.metrics?.impressions ?? null,
    position: p.metrics?.position ?? null,
  })),
  guidePageCount: evidence.derived.guidePages.length,
  localQueryCount: evidence.derived.localQueries.length,
  sitemaps: evidence.observed.sitemaps
    ? evidence.observed.sitemaps.map((s) => ({
        path: s.path,
        type: s.type,
        lastSubmitted: s.lastSubmitted,
        lastDownloaded: s.lastDownloaded,
        isPending: s.isPending,
        isSitemapsIndex: s.isSitemapsIndex,
        warnings: s.warnings,
        errors: s.errors,
        contents: s.contents,
      }))
    : null,
  sitemapUnavailable: evidence.observed.sitemaps == null,
  unknownClaims: evidence.unknown.map((g) => g.claim),
  gscOpportunityCount: search.opportunities.filter((o) =>
    o.supportingReference.startsWith("gsc"),
  ).length,
  gscRecommendationTitles: search.recommendations
    .filter((r) => r.originatingExecutive === "search-strategy")
    .slice(0, 8)
    .map((r) => r.title),
  adapterHealth: {
    ok: gsc.ok,
    failed: gsc.failed,
    healthCode: gsc.health.healthCode,
    founderLabel: gsc.health.founderLabel,
    retrievalState: gsc.health.retrievalState,
  },
  elapsedMs: {
    gscLoad: gscLoadMs,
    searchStrategy: searchStrategyMs,
  },
};

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
