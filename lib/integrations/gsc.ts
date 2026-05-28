/**
 * Google Search Console — weekly ingestion for Executive Dashboard snapshots.
 * Does not run on dashboard page render; called from weekly intelligence job only.
 */

import { isBrandQuery } from "@/lib/intelligence/brand-queries";
import {
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleRefreshToken,
} from "@/lib/intelligence/env";
import { getGoogleAccessToken } from "@/lib/intelligence/google-oauth";
import type { WeekRange } from "@/lib/intelligence/types";

const SEARCH_ANALYTICS_BASE =
  "https://www.googleapis.com/webmasters/v3/sites";

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

export type GscWeeklyBundle = {
  status: GscIntegrationStatus;
  siteUrl: string | null;
  unavailableReason?: string;
  current?: GscPeriodBundle;
  previous?: GscPeriodBundle;
  brand?: {
    current: GscBrandPeriod;
    previous: GscBrandPeriod;
  };
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
};

async function searchAnalyticsQuery(params: {
  siteUrl: string;
  accessToken: string;
  week: WeekRange;
  dimensions?: ("query" | "page")[];
  rowLimit?: number;
}): Promise<SearchAnalyticsRow[]> {
  const url = `${SEARCH_ANALYTICS_BASE}/${encodeSiteUrl(params.siteUrl)}/searchAnalytics/query`;

  const body: Record<string, unknown> = {
    startDate: params.week.start,
    endDate: params.week.end,
    rowLimit: params.rowLimit ?? 100,
  };
  if (params.dimensions?.length) {
    body.dimensions = params.dimensions;
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
  return data.rows ?? [];
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
  const [totalRows, queryRows, pageRows] = await Promise.all([
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

  const totals = aggregateTotals(totalRows);
  return {
    totals,
    topQueries: mapQueryRows(queryRows),
    topPages: mapPageRows(pageRows),
  };
}

function unavailableBundle(reason: string): GscWeeklyBundle {
  return {
    status: "unavailable",
    siteUrl: getGscSiteUrl() ?? null,
    unavailableReason: reason,
    fetchedAt: new Date().toISOString(),
  };
}

export function isGscLive(bundle: GscWeeklyBundle | null | undefined): boolean {
  return (
    bundle?.status === "live" &&
    Boolean(bundle.current && bundle.previous && bundle.brand)
  );
}

/** Weekly GSC pull — never throws; returns unavailable bundle on failure. */
export async function fetchGscWeeklyBundle(
  currentWeek: WeekRange,
  previousWeek: WeekRange,
): Promise<GscWeeklyBundle> {
  if (!isGscConfigured()) {
    return unavailableBundle(
      "GSC not configured — set GSC_SITE_URL and Google OAuth vars",
    );
  }

  const siteUrl = getGscSiteUrl()!;
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return unavailableBundle(
      "Google access token unavailable — check GOOGLE_REFRESH_TOKEN",
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
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    const message =
      err instanceof GscError
        ? err.message
        : err instanceof Error
          ? err.message
          : "GSC fetch failed";
    console.warn(`[hourglass:intelligence] GSC skipped: ${message}`);
    return unavailableBundle(message);
  }
}
