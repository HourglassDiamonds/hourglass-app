/**
 * Thin read-only data adapters for Agent OS.
 *
 * SERVER ONLY — do not import from Client Components.
 * Live paths may read process.env and call GA4, GSC, and Supabase weekly-report helpers.
 * Fixture paths stay in-process and do not call external providers.
 */

import { registerConnector } from "../permissions";
import { buildSourceHealth } from "../source-health";
import { redactError } from "../redaction";
import {
  createFixtureGa4Bundle,
  createFixtureGscBundle,
  createFixtureWeeklyReport,
  FIXTURE_REPORTING_PERIOD,
} from "../fixtures/sample-data";
import type { AdapterMode, AdapterResult, AgentOsDataBundle } from "./types";
import { DEFAULT_ADAPTER_TIMEOUT_MS, withTimeout } from "./types";
import type { Ga4WeeklyBundle, WeeklyReportRecord } from "@/lib/intelligence/types";
import type { GscWeeklyBundle } from "@/lib/integrations/gsc";

registerConnector({
  id: "agent-os-ga4-read",
  capability: "read-only",
  description: "Thin read adapter over lib/integrations/ga4",
});
registerConnector({
  id: "agent-os-gsc-read",
  capability: "read-only",
  description: "Thin read adapter over lib/integrations/gsc",
});
registerConnector({
  id: "agent-os-weekly-intelligence-read",
  capability: "read-only",
  description: "Thin read adapter over getLatestWeeklyReport",
});

function unavailableAggregate(
  sourceId: AdapterResult<null>["sourceId"],
  reason: string,
): AdapterResult<null> {
  return {
    sourceId,
    ok: false,
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
      errors: [reason],
      retrievalState: "not-configured",
    }),
  };
}

export async function loadGa4(
  mode: AdapterMode,
  timeoutMs = DEFAULT_ADAPTER_TIMEOUT_MS,
): Promise<AdapterResult<Ga4WeeklyBundle>> {
  if (mode === "fixture") {
    const data = createFixtureGa4Bundle();
    return {
      sourceId: "ga4",
      ok: true,
      data,
      empty: false,
      failed: false,
      health: buildSourceHealth({
        sourceId: "ga4",
        configured: true,
        reachable: true,
        fresh: true,
        complete: true,
        permissionPosture: "read-only",
        lastSuccessfulRead: data.fetchedAt,
        retrievalState: "fixture",
      }),
    };
  }

  try {
    const { isGa4Configured, fetchGa4WeeklyBundle } = await import(
      "@/lib/integrations/ga4"
    );
    const { getReportWeekRange, getComparisonWeekRange } = await import(
      "@/lib/intelligence/week-ranges"
    );
    if (!isGa4Configured()) {
      return {
        sourceId: "ga4",
        ok: false,
        data: null,
        empty: false,
        failed: false,
        health: buildSourceHealth({
          sourceId: "ga4",
          configured: false,
          reachable: false,
          fresh: false,
          complete: false,
          permissionPosture: "read-only",
          lastSuccessfulRead: null,
          errors: ["GA4 OAuth / property not configured"],
          retrievalState: "not-configured",
        }),
      };
    }
    const current = getReportWeekRange();
    const previous = getComparisonWeekRange(current);
    const data = await withTimeout(
      fetchGa4WeeklyBundle(current, previous),
      timeoutMs,
      "ga4",
    );
    const empty = data.current.traffic.sessions === 0;
    return {
      sourceId: "ga4",
      ok: true,
      data,
      empty,
      failed: false,
      health: buildSourceHealth({
        sourceId: "ga4",
        configured: true,
        reachable: true,
        fresh: true,
        complete: !empty,
        permissionPosture: "read-only",
        lastSuccessfulRead: data.fetchedAt,
        retrievalState: empty ? "empty" : "ok",
      }),
    };
  } catch (err) {
    return {
      sourceId: "ga4",
      ok: false,
      data: null,
      empty: false,
      failed: true,
      health: buildSourceHealth({
        sourceId: "ga4",
        configured: true,
        reachable: false,
        fresh: false,
        complete: false,
        permissionPosture: "read-only",
        lastSuccessfulRead: null,
        errors: [redactError(err)],
        retrievalState: "failed",
      }),
    };
  }
}

export async function loadGsc(
  mode: AdapterMode,
  timeoutMs = DEFAULT_ADAPTER_TIMEOUT_MS,
): Promise<AdapterResult<GscWeeklyBundle>> {
  if (mode === "fixture") {
    const data = createFixtureGscBundle();
    return {
      sourceId: "gsc",
      ok: true,
      data,
      empty: false,
      failed: false,
      health: buildSourceHealth({
        sourceId: "gsc",
        configured: true,
        reachable: true,
        fresh: true,
        complete: true,
        permissionPosture: "read-only",
        lastSuccessfulRead: data.fetchedAt,
        retrievalState: "fixture",
      }),
    };
  }

  try {
    const { isGscConfigured, fetchGscWeeklyBundle } = await import(
      "@/lib/integrations/gsc"
    );
    const { getReportWeekRange, getComparisonWeekRange } = await import(
      "@/lib/intelligence/week-ranges"
    );
    if (!isGscConfigured()) {
      return {
        sourceId: "gsc",
        ok: false,
        data: null,
        empty: false,
        failed: false,
        health: buildSourceHealth({
          sourceId: "gsc",
          configured: false,
          reachable: false,
          fresh: false,
          complete: false,
          permissionPosture: "read-only",
          lastSuccessfulRead: null,
          errors: ["GSC_SITE_URL or OAuth not configured"],
          retrievalState: "not-configured",
        }),
      };
    }
    const current = getReportWeekRange();
    const previous = getComparisonWeekRange(current);
    const data = await withTimeout(
      fetchGscWeeklyBundle(current, previous),
      timeoutMs,
      "gsc",
    );
    if (data.status === "unavailable") {
      return {
        sourceId: "gsc",
        ok: false,
        data,
        empty: false,
        failed: true,
        health: buildSourceHealth({
          sourceId: "gsc",
          configured: true,
          reachable: false,
          fresh: false,
          complete: false,
          permissionPosture: "read-only",
          lastSuccessfulRead: null,
          errors: [data.unavailableReason ?? "GSC unavailable"],
          retrievalState: "failed",
        }),
      };
    }
    const empty = (data.current?.totals.clicks ?? 0) === 0;
    return {
      sourceId: "gsc",
      ok: true,
      data,
      empty,
      failed: false,
      health: buildSourceHealth({
        sourceId: "gsc",
        configured: true,
        reachable: true,
        fresh: true,
        complete: !empty,
        permissionPosture: "read-only",
        lastSuccessfulRead: data.fetchedAt,
        retrievalState: empty ? "empty" : "ok",
      }),
    };
  } catch (err) {
    return {
      sourceId: "gsc",
      ok: false,
      data: null,
      empty: false,
      failed: true,
      health: buildSourceHealth({
        sourceId: "gsc",
        configured: true,
        reachable: false,
        fresh: false,
        complete: false,
        permissionPosture: "read-only",
        lastSuccessfulRead: null,
        errors: [redactError(err)],
        retrievalState: "failed",
      }),
    };
  }
}

export async function loadWeeklyIntelligence(
  mode: AdapterMode,
  timeoutMs = DEFAULT_ADAPTER_TIMEOUT_MS,
): Promise<AdapterResult<WeeklyReportRecord>> {
  if (mode === "fixture") {
    const data = createFixtureWeeklyReport();
    return {
      sourceId: "weekly-intelligence",
      ok: true,
      data,
      empty: false,
      failed: false,
      health: buildSourceHealth({
        sourceId: "weekly-intelligence",
        configured: true,
        reachable: true,
        fresh: true,
        complete: true,
        permissionPosture: "read-only",
        lastSuccessfulRead: data.created_at,
        retrievalState: "fixture",
      }),
    };
  }

  try {
    const { getLatestWeeklyReport } = await import(
      "@/lib/supabase/intelligence"
    );
    const data = await withTimeout(
      getLatestWeeklyReport(),
      timeoutMs,
      "weekly-intelligence",
    );
    if (!data) {
      return {
        sourceId: "weekly-intelligence",
        ok: false,
        data: null,
        empty: true,
        failed: false,
        health: buildSourceHealth({
          sourceId: "weekly-intelligence",
          configured: true,
          reachable: true,
          fresh: false,
          complete: false,
          permissionPosture: "read-only",
          lastSuccessfulRead: null,
          errors: ["No weekly report rows returned"],
          retrievalState: "empty",
        }),
      };
    }
    return {
      sourceId: "weekly-intelligence",
      ok: true,
      data,
      empty: false,
      failed: false,
      health: buildSourceHealth({
        sourceId: "weekly-intelligence",
        configured: true,
        reachable: true,
        fresh: true,
        complete: true,
        permissionPosture: "read-only",
        lastSuccessfulRead: data.created_at,
        retrievalState: "ok",
      }),
    };
  } catch (err) {
    return {
      sourceId: "weekly-intelligence",
      ok: false,
      data: null,
      empty: false,
      failed: true,
      health: buildSourceHealth({
        sourceId: "weekly-intelligence",
        configured: true,
        reachable: false,
        fresh: false,
        complete: false,
        permissionPosture: "read-only",
        lastSuccessfulRead: null,
        errors: [redactError(err)],
        retrievalState: "failed",
      }),
    };
  }
}

export async function loadAllSources(
  mode: AdapterMode,
): Promise<AgentOsDataBundle> {
  const [ga4, gsc, weeklyIntelligence] = await Promise.all([
    loadGa4(mode),
    loadGsc(mode),
    loadWeeklyIntelligence(mode),
  ]);

  return {
    ga4,
    gsc,
    weeklyIntelligence,
    hubspotAggregates: unavailableAggregate(
      "hubspot-aggregates",
      "No verified HubSpot aggregate weekly read adapter in Agent OS V1",
    ),
    buffer: unavailableAggregate(
      "buffer",
      "No Buffer adapter — social metrics must not be fabricated",
    ),
    gbp: unavailableAggregate(
      "gbp",
      "No Google Business Profile adapter — local metrics unavailable",
    ),
  };
}

export function getFixtureReportingPeriod() {
  return { ...FIXTURE_REPORTING_PERIOD };
}
