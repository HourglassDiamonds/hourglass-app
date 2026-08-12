/**
 * Thin read-only data adapters for Agent OS.
 *
 * SERVER ONLY — do not import from Client Components.
 * Live paths may read process.env and call GA4, GSC, and Supabase weekly-report helpers.
 * Fixture paths stay in-process and do not call external providers.
 * Live mode never falls back to fixtures.
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
import {
  DEFAULT_ADAPTER_TIMEOUT_MS,
  GSC_EVIDENCE_ADAPTER_TIMEOUT_MS,
  withTimeout,
} from "./types";
import type { Ga4WeeklyBundle, WeeklyReportRecord } from "@/lib/intelligence/types";
import type { GscWeeklyBundle } from "@/lib/integrations/gsc";
import {
  classifyMeasurementFailure,
  founderLabelForHealthCode,
  type MeasurementHealthCode,
} from "../measurement/health-codes";
import { getAgentOsMeasurementWindows } from "../measurement/date-windows";

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
      healthCode: "not-configured",
      founderLabel: reason,
    }),
  };
}

function ga4HealthFromError(err: unknown): {
  healthCode: MeasurementHealthCode;
  founderLabel: string;
  message: string;
} {
  const healthCode = classifyMeasurementFailure("ga4", err);
  const message = redactError(err);
  return {
    healthCode,
    founderLabel: founderLabelForHealthCode("ga4", healthCode),
    message,
  };
}

function gscHealthFromBundle(data: GscWeeklyBundle): {
  healthCode: MeasurementHealthCode;
  founderLabel: string;
  failed: boolean;
  empty: boolean;
  fresh: boolean;
} {
  if (data.status === "unavailable") {
    const healthCode = classifyMeasurementFailure("gsc", {
      code: data.failureCode,
      message: data.unavailableReason ?? "GSC unavailable",
    });
    return {
      healthCode,
      founderLabel: founderLabelForHealthCode("gsc", healthCode, {
        newestAvailableDate: data.freshness?.newestFinalizedDate ?? data.freshness?.newestAvailableDate,
        ageDays: data.freshness?.ageDays,
      }),
      failed: true,
      empty: false,
      fresh: false,
    };
  }

  const empty =
    (data.current?.totals.clicks ?? 0) === 0 &&
    (data.current?.totals.impressions ?? 0) === 0;
  const lag = data.freshness?.lagClassification;
  let healthCode: MeasurementHealthCode = "ok";
  // Unusual finalized-boundary age wins over empty (processing problem ≠ zero traffic).
  // Zero traffic alone must not become a stale/auth failure.
  if (lag === "unusual-stale") {
    healthCode = "stale-unusual";
  } else if (empty) {
    healthCode = "empty";
  } else if (lag === "normal-delay" || lag === "elevated-delay") {
    healthCode = "stale-within-normal-delay";
  }

  return {
    healthCode,
    founderLabel: founderLabelForHealthCode("gsc", healthCode, {
      newestAvailableDate:
        data.freshness?.newestFinalizedDate ??
        data.freshness?.newestAvailableDate,
      ageDays: data.freshness?.ageDays,
    }),
    failed: false,
    empty,
    fresh: healthCode === "ok" || healthCode === "empty",
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
        healthCode: "fixture",
        founderLabel: founderLabelForHealthCode("ga4", "fixture"),
      }),
    };
  }

  try {
    const { isGa4Configured, fetchGa4AgentOsBundle } = await import(
      "@/lib/integrations/ga4"
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
          errors: ["GA4 not configured"],
          retrievalState: "not-configured",
          healthCode: "not-configured",
          founderLabel: founderLabelForHealthCode("ga4", "not-configured"),
        }),
      };
    }
    const data = await withTimeout(
      fetchGa4AgentOsBundle(new Date()),
      timeoutMs,
      "ga4",
    );
    const empty = data.current.traffic.sessions === 0;
    const healthCode: MeasurementHealthCode = empty ? "empty" : "ok";
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
        healthCode,
        founderLabel: founderLabelForHealthCode("ga4", healthCode),
        newestSourceDate: data.windowMeta?.mostRecentCompleteDay?.end ?? null,
        sourceAgeDays: 0,
      }),
    };
  } catch (err) {
    const classified = ga4HealthFromError(err);
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
        errors: [classified.message],
        retrievalState: "failed",
        healthCode: classified.healthCode,
        founderLabel: classified.founderLabel,
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
        healthCode: "fixture",
        founderLabel: founderLabelForHealthCode("gsc", "fixture"),
      }),
    };
  }

  try {
    const { isGscConfigured, fetchGscAgentOsBundle } = await import(
      "@/lib/integrations/gsc"
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
          errors: ["Search Console not configured"],
          retrievalState: "not-configured",
          healthCode: "not-configured",
          founderLabel: founderLabelForHealthCode("gsc", "not-configured"),
        }),
      };
    }
    const data = await withTimeout(
      fetchGscAgentOsBundle(new Date()),
      timeoutMs,
      "gsc",
    );
    const classified = gscHealthFromBundle(data);
    if (classified.failed) {
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
          healthCode: classified.healthCode,
          founderLabel: classified.founderLabel,
          newestSourceDate:
            data.freshness?.newestFinalizedDate ??
            data.freshness?.newestAvailableDate ??
            null,
          sourceAgeDays: data.freshness?.ageDays ?? null,
        }),
      };
    }
    return {
      sourceId: "gsc",
      ok: true,
      data,
      empty: classified.empty,
      failed: false,
      health: buildSourceHealth({
        sourceId: "gsc",
        configured: true,
        reachable: true,
        fresh: classified.fresh,
        complete: !classified.empty,
        permissionPosture: "read-only",
        lastSuccessfulRead: data.fetchedAt,
        retrievalState: classified.empty ? "empty" : "ok",
        healthCode: classified.healthCode,
        founderLabel: classified.founderLabel,
        newestSourceDate:
          data.freshness?.newestFinalizedDate ??
          data.freshness?.newestAvailableDate ??
          null,
        sourceAgeDays: data.freshness?.ageDays ?? null,
      }),
    };
  } catch (err) {
    const healthCode = classifyMeasurementFailure("gsc", err);
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
        healthCode,
        founderLabel: founderLabelForHealthCode("gsc", healthCode),
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
    loadGsc(
      mode,
      mode === "live"
        ? GSC_EVIDENCE_ADAPTER_TIMEOUT_MS
        : DEFAULT_ADAPTER_TIMEOUT_MS,
    ),
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

/** Live Agent OS reporting period = completed ET rolling 7d. */
export function getLiveAgentOsReportingPeriod(asOf: Date = new Date()) {
  return getAgentOsMeasurementWindows(asOf).rolling7d;
}
