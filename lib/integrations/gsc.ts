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

/** V1 Search Analytics dimensions — device/country are intentionally omitted. */
export const GSC_V1_SEARCH_ANALYTICS_DIMENSIONS = [
  "query",
  "page",
  "date",
] as const;

export type GscV1SearchAnalyticsDimension =
  (typeof GSC_V1_SEARCH_ANALYTICS_DIMENSIONS)[number];

/** Hard stop so pagination cannot loop indefinitely. */
export const GSC_PAGINATION_MAX_REQUESTS = 6;
export const GSC_QUERY_ROW_LIMIT_PER_REQUEST = 5000;
export const GSC_QUERY_MAX_ROWS = 15_000;
export const GSC_PAGE_ROW_LIMIT_PER_REQUEST = 2500;
export const GSC_PAGE_MAX_ROWS = 5000;

export const GSC_QUERY_COVERAGE_NOTE =
  "Search Console does not guarantee all queries. Returned rows are a bounded sample of available Search Analytics rows; anonymized and lower-volume queries may be omitted. This is not all queries for the property.";

export const GSC_CRITICAL_PAGE_PATHS = [
  "/",
  "/engagement-rings",
  "/custom-design",
  "/concierge",
  "/diamond-studio",
  "/diamond-intelligence",
  "/diamond-shape-studio",
] as const;

export type GscCriticalPagePath = (typeof GSC_CRITICAL_PAGE_PATHS)[number];

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

export type GscDimensionRetrievalMeta = {
  rowsReturned: number;
  requestLimit: number;
  requestsMade: number;
  truncatedOrPotentiallyIncomplete: boolean;
  stoppedReason: "complete" | "max-rows" | "max-requests";
  note: string;
};

export type GscCriticalPageLookupState =
  | "observed"
  | "filtered-lookup-empty"
  | "lookup-failed"
  | "not-fetched";

export type GscCriticalPageRow = {
  path: GscCriticalPagePath;
  pageUrl: string;
  state: GscCriticalPageLookupState;
  inGlobalTopPages: boolean | null;
  metrics: GscPageRow | null;
};

export type GscSitemapContent = {
  type: string | null;
  submitted: number | null;
};

export type GscSitemapEntry = {
  path: string;
  type: string | null;
  lastSubmitted: string | null;
  lastDownloaded: string | null;
  isPending: boolean | null;
  isSitemapsIndex: boolean | null;
  warnings: number | null;
  errors: number | null;
  contents: GscSitemapContent[];
};

export type GscSitemapFetchResult = {
  status: "observed" | "unavailable";
  unavailableReason: string | null;
  entries: GscSitemapEntry[];
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
  retrieval?: {
    queries: GscDimensionRetrievalMeta;
    pages: GscDimensionRetrievalMeta;
  };
  criticalPages?: {
    current: GscCriticalPageRow[];
    previous: GscCriticalPageRow[];
  };
  sitemaps?: GscSitemapFetchResult;
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
  dimensions?: GscV1SearchAnalyticsDimension[];
  rowLimit?: number;
  startRow?: number;
  dimensionFilterGroups?: Array<{
    groupType?: "and" | "or";
    filters: Array<{
      dimension: "page" | "query";
      operator: "equals" | "contains";
      expression: string;
    }>;
  }>;
  /** Omit / "final" = finalized only; "all" includes fresh incomplete rows + metadata. */
  dataState?: "all" | "final";
}): Promise<SearchAnalyticsQueryResult> {
  const url = `${SEARCH_ANALYTICS_BASE}/${encodeSiteUrl(params.siteUrl)}/searchAnalytics/query`;

  const body: Record<string, unknown> = {
    startDate: params.week.start,
    endDate: params.week.end,
    rowLimit: params.rowLimit ?? 100,
  };
  if (params.startRow && params.startRow > 0) {
    body.startRow = params.startRow;
  }
  if (params.dimensions?.length) {
    body.dimensions = params.dimensions;
  }
  if (params.dimensionFilterGroups?.length) {
    body.dimensionFilterGroups = params.dimensionFilterGroups;
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

export type SearchAnalyticsPageRequest = {
  startRow: number;
  rowLimit: number;
};

/**
 * Bounded pagination over Search Analytics pages.
 * Always stops at maxRequests even if the fetcher keeps returning full pages.
 */
export async function collectSearchAnalyticsRows(options: {
  fetchPage: (
    req: SearchAnalyticsPageRequest,
  ) => Promise<{ rows: SearchAnalyticsRow[] }>;
  pageSize: number;
  maxRows: number;
  maxRequests: number;
  coverageNote: string;
}): Promise<{
  rows: SearchAnalyticsRow[];
  meta: GscDimensionRetrievalMeta;
}> {
  const maxRequests = Math.max(1, Math.min(options.maxRequests, GSC_PAGINATION_MAX_REQUESTS));
  const pageSize = Math.max(1, options.pageSize);
  const maxRows = Math.max(1, options.maxRows);

  const rows: SearchAnalyticsRow[] = [];
  let startRow = 0;
  let requestsMade = 0;
  let stoppedReason: GscDimensionRetrievalMeta["stoppedReason"] = "complete";

  while (requestsMade < maxRequests && rows.length < maxRows) {
    const remaining = maxRows - rows.length;
    const rowLimit = Math.min(pageSize, remaining);
    const previousStart = startRow;
    requestsMade += 1;
    const page = await options.fetchPage({ startRow, rowLimit });
    const batch = page.rows ?? [];
    rows.push(...batch);

    if (batch.length < rowLimit) {
      stoppedReason = "complete";
      break;
    }
    if (rows.length >= maxRows) {
      stoppedReason = "max-rows";
      break;
    }
    startRow += batch.length;
    if (startRow <= previousStart) {
      stoppedReason = "complete";
      break;
    }
    if (requestsMade >= maxRequests) {
      stoppedReason = "max-requests";
      break;
    }
  }

  const truncatedOrPotentiallyIncomplete =
    stoppedReason === "max-rows" || stoppedReason === "max-requests";

  return {
    rows,
    meta: {
      rowsReturned: rows.length,
      requestLimit: maxRows,
      requestsMade,
      truncatedOrPotentiallyIncomplete,
      stoppedReason,
      note: options.coverageNote,
    },
  };
}

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseOptionalBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

/** Map sitemaps.list JSON — ignores deprecated contents[].indexed. */
export function mapGscSitemapListPayload(payload: unknown): GscSitemapEntry[] {
  if (!payload || typeof payload !== "object") return [];
  const list = (payload as { sitemap?: unknown }).sitemap;
  if (!Array.isArray(list)) return [];

  const entries: GscSitemapEntry[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const path = parseOptionalString(row.path);
    if (!path) continue;

    const contentsRaw = Array.isArray(row.contents) ? row.contents : [];
    const contents: GscSitemapContent[] = [];
    for (const c of contentsRaw) {
      if (!c || typeof c !== "object") continue;
      const content = c as Record<string, unknown>;
      contents.push({
        type: parseOptionalString(content.type),
        submitted: parseOptionalNumber(content.submitted),
      });
    }

    const isIndex = parseOptionalBool(row.isSitemapsIndex);
    entries.push({
      path,
      type: isIndex ? "index" : (contents[0]?.type ?? null),
      lastSubmitted: parseOptionalString(row.lastSubmitted),
      lastDownloaded: parseOptionalString(row.lastDownloaded),
      isPending: parseOptionalBool(row.isPending),
      isSitemapsIndex: isIndex,
      warnings: parseOptionalNumber(row.warnings),
      errors: parseOptionalNumber(row.errors),
      contents,
    });
  }
  return entries;
}

export async function listGscSitemaps(params: {
  siteUrl: string;
  accessToken: string;
}): Promise<GscSitemapFetchResult> {
  const url = `${SEARCH_ANALYTICS_BASE}/${encodeSiteUrl(params.siteUrl)}/sitemaps`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    const lower = text.toLowerCase();
    if (res.status === 403 || lower.includes("permission")) {
      throw new GscError(
        "Search Console sitemap list permission denied",
        "API_FORBIDDEN",
        text,
      );
    }
    throw new GscError(
      `Search Console sitemap list error (${res.status}): ${text.slice(0, 200)}`,
      "API_FAILED",
      text,
    );
  }
  const payload: unknown = await res.json();
  return {
    status: "observed",
    unavailableReason: null,
    entries: mapGscSitemapListPayload(payload),
  };
}

export function criticalPageAbsoluteUrl(path: GscCriticalPagePath): string {
  const origin = "https://www.hourglassdiamonds.com";
  if (path === "/") return `${origin}/`;
  return `${origin}${path}`;
}

function pagePathFromGscUrl(page: string): string {
  try {
    const u = new URL(page);
    const pathname = u.pathname || "/";
    return pathname === "" ? "/" : pathname;
  } catch {
    return page.startsWith("/") ? page : `/${page}`;
  }
}

export function annotateCriticalPagesWithGlobalTop(
  rows: GscCriticalPageRow[],
  globalPages: GscPageRow[],
): GscCriticalPageRow[] {
  const topPaths = new Set(globalPages.map((p) => pagePathFromGscUrl(p.page)));
  return rows.map((row) => ({
    ...row,
    inGlobalTopPages: topPaths.has(row.path),
  }));
}

async function fetchCriticalPageLookups(params: {
  siteUrl: string;
  accessToken: string;
  week: WeekRange;
  globalPages: GscPageRow[];
}): Promise<GscCriticalPageRow[]> {
  const lookups = await Promise.all(
    GSC_CRITICAL_PAGE_PATHS.map(async (path) => {
      const pageUrl = criticalPageAbsoluteUrl(path);
      try {
        const result = await searchAnalyticsQuery({
          siteUrl: params.siteUrl,
          accessToken: params.accessToken,
          week: params.week,
          dimensions: ["page"],
          rowLimit: 5,
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: "page",
                  operator: "equals",
                  expression: pageUrl,
                },
              ],
            },
          ],
        });
        const mapped = mapPageRows(result.rows);
        const metrics = mapped[0] ?? null;
        return {
          path,
          pageUrl,
          state: (metrics ? "observed" : "filtered-lookup-empty") as GscCriticalPageLookupState,
          inGlobalTopPages: null,
          metrics,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message.slice(0, 180) : "critical page lookup failed";
        console.warn(`[hourglass:intelligence] GSC critical page ${path}: ${message}`);
        return {
          path,
          pageUrl,
          state: "lookup-failed" as const,
          inGlobalTopPages: null,
          metrics: null,
        };
      }
    }),
  );
  return annotateCriticalPagesWithGlobalTop(lookups, params.globalPages);
}

async function fetchSpecialistDimensionRows(params: {
  siteUrl: string;
  accessToken: string;
  week: WeekRange;
  dimension: "query" | "page";
}): Promise<{ rows: SearchAnalyticsRow[]; meta: GscDimensionRetrievalMeta }> {
  const isQuery = params.dimension === "query";
  return collectSearchAnalyticsRows({
    pageSize: isQuery
      ? GSC_QUERY_ROW_LIMIT_PER_REQUEST
      : GSC_PAGE_ROW_LIMIT_PER_REQUEST,
    maxRows: isQuery ? GSC_QUERY_MAX_ROWS : GSC_PAGE_MAX_ROWS,
    maxRequests: GSC_PAGINATION_MAX_REQUESTS,
    coverageNote: isQuery
      ? GSC_QUERY_COVERAGE_NOTE
      : "Search Console page rows are a bounded retrieval, not a complete URL inventory. Pages with no returned rows are not observed zeros.",
    fetchPage: (req) =>
      searchAnalyticsQuery({
        siteUrl: params.siteUrl,
        accessToken: params.accessToken,
        week: params.week,
        dimensions: [params.dimension],
        rowLimit: req.rowLimit,
        startRow: req.startRow,
      }),
  });
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

async function fetchSpecialistPeriodBundle(
  siteUrl: string,
  accessToken: string,
  week: WeekRange,
): Promise<{
  bundle: GscPeriodBundle;
  retrieval: {
    queries: GscDimensionRetrievalMeta;
    pages: GscDimensionRetrievalMeta;
  };
}> {
  const [totalResult, queryCollected, pageCollected] = await Promise.all([
    searchAnalyticsQuery({ siteUrl, accessToken, week, rowLimit: 1 }),
    fetchSpecialistDimensionRows({
      siteUrl,
      accessToken,
      week,
      dimension: "query",
    }),
    fetchSpecialistDimensionRows({
      siteUrl,
      accessToken,
      week,
      dimension: "page",
    }),
  ]);

  return {
    bundle: {
      totals: aggregateTotals(totalResult.rows),
      topQueries: mapQueryRows(queryCollected.rows),
      topPages: mapPageRows(pageCollected.rows),
    },
    retrieval: {
      queries: queryCollected.meta,
      pages: pageCollected.meta,
    },
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
 * Specialist path: bounded paginated query/page rows + critical-page filters +
 * read-only sitemaps.list. Sitemap failure does not drop Search Analytics.
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
      const emptyRetrieval: GscDimensionRetrievalMeta = {
        rowsReturned: 0,
        requestLimit: GSC_QUERY_MAX_ROWS,
        requestsMade: 0,
        truncatedOrPotentiallyIncomplete: false,
        stoppedReason: "complete",
        note: GSC_QUERY_COVERAGE_NOTE,
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
        retrieval: {
          queries: emptyRetrieval,
          pages: {
            ...emptyRetrieval,
            requestLimit: GSC_PAGE_MAX_ROWS,
          },
        },
        criticalPages: {
          current: GSC_CRITICAL_PAGE_PATHS.map((path) => ({
            path,
            pageUrl: criticalPageAbsoluteUrl(path),
            state: "filtered-lookup-empty",
            inGlobalTopPages: false,
            metrics: null,
          })),
          previous: GSC_CRITICAL_PAGE_PATHS.map((path) => ({
            path,
            pageUrl: criticalPageAbsoluteUrl(path),
            state: "filtered-lookup-empty",
            inGlobalTopPages: false,
            metrics: null,
          })),
        },
        sitemaps: await listGscSitemaps({ siteUrl, accessToken }).catch(
          (err: unknown) => ({
            status: "unavailable" as const,
            unavailableReason:
              err instanceof Error ? err.message : "Sitemap list failed",
            entries: [],
          }),
        ),
      };
    }

    const windows = getWindowsEndingOn(finalized, GSC_SOURCE_TIMEZONE);

    const [currentSpecialist, previousSpecialist] = await Promise.all([
      fetchSpecialistPeriodBundle(siteUrl, accessToken, windows.rolling7d),
      fetchSpecialistPeriodBundle(siteUrl, accessToken, windows.prior7d),
    ]);

    const current = currentSpecialist.bundle;
    const previous = previousSpecialist.bundle;

    const [criticalCurrent, criticalPrevious, sitemaps] = await Promise.all([
      fetchCriticalPageLookups({
        siteUrl,
        accessToken,
        week: windows.rolling7d,
        globalPages: current.topPages,
      }),
      fetchCriticalPageLookups({
        siteUrl,
        accessToken,
        week: windows.prior7d,
        globalPages: previous.topPages,
      }),
      listGscSitemaps({ siteUrl, accessToken }).catch((err: unknown) => ({
        status: "unavailable" as const,
        unavailableReason:
          err instanceof Error ? err.message : "Sitemap list failed",
        entries: [],
      })),
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
      retrieval: currentSpecialist.retrieval,
      criticalPages: {
        current: criticalCurrent,
        previous: criticalPrevious,
      },
      sitemaps,
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
