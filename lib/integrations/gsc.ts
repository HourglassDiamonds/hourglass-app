/**
 * Google Search Console — weekly ingestion for Executive Dashboard snapshots
 * and Agent OS live measurement (read-only).
 */

import { isBrandQuery } from "@/lib/intelligence/brand-queries";
import {
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleRefreshToken,
} from "@/lib/intelligence/env";
import {
  getGoogleAccessToken,
  refreshGoogleAccessTokenDetailed,
} from "@/lib/intelligence/google-oauth";
import type { WeekRange } from "@/lib/intelligence/types";
import { getWindowsEndingOn } from "@/lib/agent-os/measurement/date-windows";
import {
  extractFirstIncompleteDate,
  GSC_SOURCE_TIMEZONE,
  mapDateDimensionRows,
  resolveGscFreshnessBoundary,
  type GscFreshnessBoundary,
} from "@/lib/agent-os/measurement/gsc-freshness";

const SEARCH_ANALYTICS_BASE =
  "https://www.googleapis.com/webmasters/v3/sites";

/** Bounded lookback for the single freshness discovery query. */
const GSC_FRESHNESS_LOOKBACK_DAYS = 16;

export type GscIntegrationStatus = "live" | "unavailable" | "pending";

export type GscPeriodTotals = {
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
};

export type GscQueryRow = {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
};

export type GscPageRow = {
  page: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
};

export type GscPeriodBundle = {
  totals: GscPeriodTotals;
  topQueries: GscQueryRow[];
  topPages: GscPageRow[];
};

export type GscBrandPeriod = {
  impressions: number;
  clicks: number;
  ctr: number;
};

export type GscFreshness = {
  /**
   * Newest finalized Pacific source date (primary decision boundary).
   * Alias kept for callers that historically used newestAvailableDate.
   */
  newestAvailableDate: string | null;
  newestFinalizedDate: string | null;
  firstIncompleteDate: string | null;
  newestObservedActivityDate: string | null;
  boundarySource: "metadata" | "conservative-fallback" | "none";
  ageDays: number | null;
  lagClassification:
    | "fresh"
    | "normal-delay"
    | "elevated-delay"
    | "unusual-stale"
    | "unknown";
  confidenceMultiplier: number;
  windowsUsed: {
    current: WeekRange;
    previous: WeekRange;
  };
  /** Always America/Los_Angeles for Search Analytics source dates. */
  timezone: typeof GSC_SOURCE_TIMEZONE | string;
  probeRange?: WeekRange;
};

export type GscWeeklyBundle = {
  status: GscIntegrationStatus;
  siteUrl: string | null;
  unavailableReason?: string;
  /** Structured failure code when status is unavailable. */
  failureCode?: GscErrorCode;
  current?: GscPeriodBundle;
  previous?: GscPeriodBundle;
  brand?: {
    current: GscBrandPeriod;
    previous: GscBrandPeriod;
  };
  freshness?: GscFreshness;
  fetchedAt: string;
};

export type GscErrorCode =
  | "MISSING_ENV"
  | "TOKEN_FAILED"
  | "API_FORBIDDEN"
  | "API_FAILED";

export class GscError extends Error {
  readonly code: GscErrorCode;

  constructor(message: string, code: GscErrorCode, cause?: unknown) {
    super(message);
    this.name = "GscError";
    this.code = code;
    if (cause instanceof Error && cause.stack) {
      this.cause = cause;
    }
  }
}

function trimmedEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

/** Exact site URL as shown in Search Console (e.g. https://hourglassdiamonds.com/ or sc-domain:…). */
export function getGscSiteUrl(): string | undefined {
  return trimmedEnv("GSC_SITE_URL");
}

export function isGscConfigured(): boolean {
  return Boolean(
    getGoogleClientId() &&
      getGoogleClientSecret() &&
      getGoogleRefreshToken() &&
      getGscSiteUrl(),
  );
}

/** Sanitize site URL for display — host/path only, no credentials. */
export function sanitizeGscSiteUrlForDisplay(
  siteUrl: string | undefined | null,
): string | null {
  if (!siteUrl) return null;
  const trimmed = siteUrl.trim();
  if (trimmed.startsWith("sc-domain:")) {
    return trimmed.slice(0, 80);
  }
  try {
    const u = new URL(trimmed);
    return `${u.protocol}//${u.host}${u.pathname}`.slice(0, 120);
  } catch {
    return "[invalid-site-url-format]";
  }
}

function encodeSiteUrl(siteUrl: string): string {
  return encodeURIComponent(siteUrl);
}

type SearchAnalyticsRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type SearchAnalyticsResponse = {
  rows?: SearchAnalyticsRow[];
  metadata?: Record<string, unknown>;
  // Some clients may surface snake_case at the top level — ignore unknowns.
  [key: string]: unknown;
};

type SearchAnalyticsQueryResult = {
  rows: SearchAnalyticsRow[];
  metadata: Record<string, unknown> | null;
};

async function searchAnalyticsQuery(params: {
  siteUrl: string;
  accessToken: string;
  week: WeekRange;
  dimensions?: ("query" | "page" | "date" | "device" | "country")[];
  rowLimit?: number;
  /** Omit / "final" = finalized only; "all" includes fresh incomplete rows + metadata. */
  dataState?: "all" | "final";
}): Promise<SearchAnalyticsQueryResult> {
  const url = `${SEARCH_ANALYTICS_BASE}/${encodeSiteUrl(params.siteUrl)}/searchAnalytics/query`;

  const body: Record<string, unknown> = {
    startDate: params.week.start,
    endDate: params.week.end,
    rowLimit: params.rowLimit ?? 100,
  };
  if (params.dimensions?.length) {
    body.dimensions = params.dimensions;
  }
  if (params.dataState) {
    body.dataState = params.dataState;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    const lower = text.toLowerCase();
    if (res.status === 403 || lower.includes("permission")) {
      throw new GscError(
        "Search Console permission denied — add webmasters.readonly scope and verify site access",
        "API_FORBIDDEN",
        text,
      );
    }
    throw new GscError(
      `Search Console API error (${res.status}): ${text.slice(0, 200)}`,
      "API_FAILED",
      text,
    );
  }

  const data = (await res.json()) as SearchAnalyticsResponse;
  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : null;
  return {
    rows: data.rows ?? [],
    metadata,
  };
}

function aggregateTotals(rows: SearchAnalyticsRow[]): GscPeriodTotals {
  if (!rows.length) {
    return { impressions: 0, clicks: 0, ctr: 0, position: 0 };
  }

  let impressions = 0;
  let clicks = 0;
  let positionWeighted = 0;

  for (const row of rows) {
    const imp = row.impressions ?? 0;
    impressions += imp;
    clicks += row.clicks ?? 0;
    positionWeighted += (row.position ?? 0) * imp;
  }

  return {
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? positionWeighted / impressions : 0,
  };
}

function mapQueryRows(rows: SearchAnalyticsRow[]): GscQueryRow[] {
  return rows
    .filter((r) => r.keys?.[0])
    .map((r) => ({
      query: r.keys![0],
      impressions: r.impressions ?? 0,
      clicks: r.clicks ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

function mapPageRows(rows: SearchAnalyticsRow[]): GscPageRow[] {
  return rows
    .filter((r) => r.keys?.[0])
    .map((r) => ({
      page: r.keys![0],
      impressions: r.impressions ?? 0,
      clicks: r.clicks ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

function sumBrandMetrics(queries: GscQueryRow[]): GscBrandPeriod {
  let impressions = 0;
  let clicks = 0;
  for (const row of queries) {
    if (!isBrandQuery(row.query)) continue;
    impressions += row.impressions;
    clicks += row.clicks;
  }
  return {
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : 0,
  };
}

async function fetchPeriodBundle(
  siteUrl: string,
  accessToken: string,
  week: WeekRange,
): Promise<GscPeriodBundle> {
  const [totalResult, queryResult, pageResult] = await Promise.all([
    searchAnalyticsQuery({ siteUrl, accessToken, week, rowLimit: 1 }),
    searchAnalyticsQuery({
      siteUrl,
      accessToken,
      week,
      dimensions: ["query"],
      rowLimit: 250,
    }),
    searchAnalyticsQuery({
      siteUrl,
      accessToken,
      week,
      dimensions: ["page"],
      rowLimit: 100,
    }),
  ]);

  const totals = aggregateTotals(totalResult.rows);
  return {
    totals,
    topQueries: mapQueryRows(queryResult.rows),
    topPages: mapPageRows(pageResult.rows),
  };
}

function unavailableBundle(
  reason: string,
  failureCode?: GscErrorCode,
): GscWeeklyBundle {
  return {
    status: "unavailable",
    siteUrl: getGscSiteUrl() ?? null,
    unavailableReason: reason,
    failureCode,
    fetchedAt: new Date().toISOString(),
  };
}

export function isGscLive(bundle: GscWeeklyBundle | null | undefined): boolean {
  return (
    bundle?.status === "live" &&
    Boolean(bundle.current && bundle.previous && bundle.brand)
  );
}

/**
 * Discover GSC finalized / incomplete / observed dates with one bounded query.
 * Uses dataState=all + date dimension so metadata.first_incomplete_date can appear.
 * Does not treat zero-traffic days as missing source data.
 */
export async function discoverGscFreshnessBoundary(params: {
  siteUrl: string;
  accessToken: string;
  asOf?: Date;
  lookbackDays?: number;
}): Promise<GscFreshnessBoundary> {
  const lookback = params.lookbackDays ?? GSC_FRESHNESS_LOOKBACK_DAYS;
  const asOf = params.asOf ?? new Date();
  // Probe end/start come from resolveGscFreshnessBoundary; we still need a
  // request range. Use Pacific complete-day windows via a dry resolve first.
  const probeSkeleton = resolveGscFreshnessBoundary({
    asOf,
    lookbackDays: lookback,
    firstIncompleteDate: null,
    rows: [],
  });

  const result = await searchAnalyticsQuery({
    siteUrl: params.siteUrl,
    accessToken: params.accessToken,
    week: probeSkeleton.probeRange,
    dimensions: ["date"],
    rowLimit: lookback,
    dataState: "all",
  });

  return resolveGscFreshnessBoundary({
    asOf,
    lookbackDays: lookback,
    firstIncompleteDate: extractFirstIncompleteDate(result.metadata),
    rows: mapDateDimensionRows(result.rows),
  });
}

/** @deprecated Prefer discoverGscFreshnessBoundary — returns newest finalized date only. */
export async function discoverNewestGscDate(params: {
  siteUrl: string;
  accessToken: string;
  asOf?: Date;
  lookbackDays?: number;
}): Promise<string | null> {
  const boundary = await discoverGscFreshnessBoundary(params);
  return boundary.newestFinalizedDate;
}

function freshnessFromBoundary(
  boundary: GscFreshnessBoundary,
  windows: { current: WeekRange; previous: WeekRange },
): GscFreshness {
  return {
    newestAvailableDate: boundary.newestFinalizedDate,
    newestFinalizedDate: boundary.newestFinalizedDate,
    firstIncompleteDate: boundary.firstIncompleteDate,
    newestObservedActivityDate: boundary.newestObservedActivityDate,
    boundarySource: boundary.boundarySource,
    ageDays: boundary.ageDays,
    lagClassification: boundary.lagClassification,
    confidenceMultiplier: boundary.confidenceMultiplier,
    windowsUsed: windows,
    timezone: GSC_SOURCE_TIMEZONE,
    probeRange: boundary.probeRange,
  };
}

/** Weekly GSC pull — never throws; returns unavailable bundle on failure. */
export async function fetchGscWeeklyBundle(
  currentWeek: WeekRange,
  previousWeek: WeekRange,
): Promise<GscWeeklyBundle> {
  if (!isGscConfigured()) {
    return unavailableBundle(
      "GSC not configured — set GSC_SITE_URL and Google OAuth vars",
      "MISSING_ENV",
    );
  }

  const siteUrl = getGscSiteUrl()!;
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return unavailableBundle(
      "Google access token unavailable — check GOOGLE_REFRESH_TOKEN",
      "TOKEN_FAILED",
    );
  }

  try {
    const [current, previous] = await Promise.all([
      fetchPeriodBundle(siteUrl, accessToken, currentWeek),
      fetchPeriodBundle(siteUrl, accessToken, previousWeek),
    ]);

    const brand = {
      current: sumBrandMetrics(current.topQueries),
      previous: sumBrandMetrics(previous.topQueries),
    };

    console.log("[hourglass:intelligence] GSC weekly bundle fetched");

    return {
      status: "live",
      siteUrl,
      current,
      previous,
      brand,
      freshness: {
        newestAvailableDate: currentWeek.end,
        newestFinalizedDate: currentWeek.end,
        firstIncompleteDate: null,
        newestObservedActivityDate: null,
        boundarySource: "none",
        ageDays: null,
        lagClassification: "unknown",
        confidenceMultiplier: 1,
        windowsUsed: { current: currentWeek, previous: previousWeek },
        timezone: GSC_SOURCE_TIMEZONE,
      },
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    const message =
      err instanceof GscError
        ? err.message
        : err instanceof Error
          ? err.message
          : "GSC fetch failed";
    const failureCode = err instanceof GscError ? err.code : "API_FAILED";
    console.warn(`[hourglass:intelligence] GSC skipped: ${message}`);
    return unavailableBundle(message, failureCode);
  }
}

/**
 * Agent OS GSC pull — discovers newest finalized Pacific date, then builds
 * comparison windows ending on that date. Normal reporting lag is not an outage.
 * API cost: 1 freshness probe + 2×3 period queries (same as before for periods).
 */
export async function fetchGscAgentOsBundle(
  asOf: Date = new Date(),
): Promise<GscWeeklyBundle> {
  if (!isGscConfigured()) {
    return unavailableBundle(
      "GSC not configured — set GSC_SITE_URL and Google OAuth vars",
      "MISSING_ENV",
    );
  }

  const siteUrl = getGscSiteUrl()!;
  const tokenResult = await refreshGoogleAccessTokenDetailed();
  if (!tokenResult.ok) {
    return unavailableBundle(tokenResult.message, "TOKEN_FAILED");
  }
  const accessToken = tokenResult.accessToken;

  try {
    const boundary = await discoverGscFreshnessBoundary({
      siteUrl,
      accessToken,
      asOf,
    });

    const finalized = boundary.newestFinalizedDate;
    if (!finalized) {
      const emptyWindows = {
        current: boundary.probeRange,
        previous: boundary.probeRange,
      };
      return {
        status: "live",
        siteUrl,
        current: {
          totals: { impressions: 0, clicks: 0, ctr: 0, position: 0 },
          topQueries: [],
          topPages: [],
        },
        previous: {
          totals: { impressions: 0, clicks: 0, ctr: 0, position: 0 },
          topQueries: [],
          topPages: [],
        },
        brand: {
          current: { impressions: 0, clicks: 0, ctr: 0 },
          previous: { impressions: 0, clicks: 0, ctr: 0 },
        },
        freshness: freshnessFromBoundary(boundary, emptyWindows),
        fetchedAt: new Date().toISOString(),
      };
    }

    const windows = getWindowsEndingOn(finalized, GSC_SOURCE_TIMEZONE);

    const [current, previous] = await Promise.all([
      fetchPeriodBundle(siteUrl, accessToken, windows.rolling7d),
      fetchPeriodBundle(siteUrl, accessToken, windows.prior7d),
    ]);

    const brand = {
      current: sumBrandMetrics(current.topQueries),
      previous: sumBrandMetrics(previous.topQueries),
    };

    return {
      status: "live",
      siteUrl,
      current,
      previous,
      brand,
      freshness: freshnessFromBoundary(boundary, {
        current: windows.rolling7d,
        previous: windows.prior7d,
      }),
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    const message =
      err instanceof GscError
        ? err.message
        : err instanceof Error
          ? err.message
          : "GSC fetch failed";
    const failureCode = err instanceof GscError ? err.code : "API_FAILED";
    console.warn(`[hourglass:intelligence] GSC Agent OS skipped: ${message}`);
    return unavailableBundle(message, failureCode);
  }
}

export function summarizeGscBundle(bundle: GscWeeklyBundle): {
  status: GscIntegrationStatus;
  siteUrl: string | null;
  clicksCurrent: number;
  impressionsCurrent: number;
  queryRows: number;
  pageRows: number;
  newestFinalizedDate: string | null;
  firstIncompleteDate: string | null;
  newestObservedActivityDate: string | null;
  /** @deprecated alias of newestFinalizedDate */
  newestAvailableDate: string | null;
  ageDays: number | null;
  lagClassification: string | null;
  boundarySource: string | null;
  sourceTimezone: string | null;
  currentRange: WeekRange | null;
  previousRange: WeekRange | null;
} {
  return {
    status: bundle.status,
    siteUrl: sanitizeGscSiteUrlForDisplay(bundle.siteUrl),
    clicksCurrent: bundle.current?.totals.clicks ?? 0,
    impressionsCurrent: bundle.current?.totals.impressions ?? 0,
    queryRows: bundle.current?.topQueries.length ?? 0,
    pageRows: bundle.current?.topPages.length ?? 0,
    newestFinalizedDate: bundle.freshness?.newestFinalizedDate ?? null,
    firstIncompleteDate: bundle.freshness?.firstIncompleteDate ?? null,
    newestObservedActivityDate:
      bundle.freshness?.newestObservedActivityDate ?? null,
    newestAvailableDate: bundle.freshness?.newestFinalizedDate ?? null,
    ageDays: bundle.freshness?.ageDays ?? null,
    lagClassification: bundle.freshness?.lagClassification ?? null,
    boundarySource: bundle.freshness?.boundarySource ?? null,
    sourceTimezone: bundle.freshness?.timezone ?? GSC_SOURCE_TIMEZONE,
    currentRange: bundle.freshness?.windowsUsed.current ?? null,
    previousRange: bundle.freshness?.windowsUsed.previous ?? null,
  };
}
