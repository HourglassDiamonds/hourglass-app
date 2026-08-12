/**
 * Search Strategy GSC evidence bundle — epistemic labels, no fabricated zeros.
 * Maps the existing read-only GSC adapter; does not create a second integration.
 */

import { isBrandQuery } from "@/lib/intelligence/brand-queries";
import type { WeekRange } from "@/lib/intelligence/types";
import type {
  GscBrandPeriod,
  GscCriticalPageRow,
  GscDimensionRetrievalMeta,
  GscErrorCode,
  GscFreshness,
  GscPageRow,
  GscPeriodTotals,
  GscQueryRow,
  GscSitemapEntry,
  GscSitemapFetchResult,
  GscWeeklyBundle,
} from "@/lib/integrations/gsc";
import {
  GSC_QUERY_COVERAGE_NOTE,
  sanitizeGscSiteUrlForDisplay,
} from "@/lib/integrations/gsc";
import { isLocalIntent } from "./classify";

export const GSC_EVIDENCE_SOURCE = "google-search-console" as const;

export const GSC_BRAND_CLASSIFIER_ID =
  "lib/intelligence/brand-queries.ts#isBrandQuery" as const;

export type GscEpistemicClass =
  | "observed"
  | "derived"
  | "inferred"
  | "unknown";

export type GscEvidenceAvailability =
  | "live"
  | "not-configured"
  | "auth-failed"
  | "property-denied"
  | "partial"
  | "empty"
  | "unavailable";

export type GscUnknownGap = {
  claim: string;
  reason: string;
};

export type GscQueryCoverage = GscDimensionRetrievalMeta & {
  /** Always false — GSC never returns a complete query census. */
  labeledAsAllQueries: false;
};

export type GscBrandSplit = {
  epistemic: "derived";
  approximate: true;
  classifier: typeof GSC_BRAND_CLASSIFIER_ID;
  coverageNote: string;
  branded: GscBrandPeriod & { queryRows: number };
  nonBranded: GscBrandPeriod & { queryRows: number };
};

export type GscMovementRow = {
  key: string;
  current: { clicks: number; impressions: number; position: number };
  previous: { clicks: number; impressions: number; position: number } | null;
  clickDeltaPct: number | null;
  comparable: boolean;
};

export type GscPathGroupSummary = {
  pathOrPrefix: string;
  source:
    | "critical-page-lookup"
    | "global-page-rows"
    | "path-group";
  state: GscCriticalPageRow["state"] | "observed-from-global-list";
  inGlobalTopPages: boolean | null;
  metrics: GscPageRow | null;
};

export type GscEvidenceBundle = {
  source: typeof GSC_EVIDENCE_SOURCE;
  property: string | null;
  propertyDisplay: string | null;
  fetchedAt: string;
  window: { current: WeekRange; previous: WeekRange } | null;
  freshness: GscFreshness | null;
  availability: GscEvidenceAvailability;
  unavailableReason: string | null;
  failureCode: GscErrorCode | null;
  retrieval: {
    queries: GscQueryCoverage | null;
    pages: GscDimensionRetrievalMeta | null;
  };
  observed: {
    totals: GscPeriodTotals | null;
    queries: GscQueryRow[];
    pages: GscPageRow[];
    criticalPages: GscCriticalPageRow[];
    sitemaps: GscSitemapEntry[] | null;
  };
  derived: {
    brandedVsNonBranded: GscBrandSplit | null;
    wowQueries: GscMovementRow[];
    wowPages: GscMovementRow[];
    commercialPages: GscPathGroupSummary[];
    toolPages: GscPathGroupSummary[];
    guidePages: GscPathGroupSummary[];
    localQueries: GscQueryRow[];
  };
  unknown: GscUnknownGap[];
};

const COMMERCIAL_PATHS = [
  "/",
  "/engagement-rings",
  "/custom-design",
  "/concierge",
] as const;

const TOOL_PATHS = [
  "/diamond-studio",
  "/diamond-intelligence",
  "/diamond-shape-studio",
] as const;

const BRAND_COVERAGE_NOTE =
  "DERIVED / APPROXIMATE from returned query rows using the intelligence brand classifier. Not a Search Console dimension and not the exact share of all searches. Anonymized and omitted queries are not classified.";

const DEFAULT_UNKNOWN: GscUnknownGap[] = [
  {
    claim: "Bulk Pages / Coverage indexing reasons",
    reason:
      "Search Console API does not expose an equivalent to the Coverage/Pages report",
  },
  {
    claim: "URL Inspection index status",
    reason: "URL Inspection is out of V1 scope",
  },
  {
    claim: "Device and country Search Analytics",
    reason: "V1 does not request device or country dimensions",
  },
];

export function emptyGscEvidenceBundle(
  partial?: Partial<
    Pick<
      GscEvidenceBundle,
      | "availability"
      | "unavailableReason"
      | "failureCode"
      | "property"
      | "propertyDisplay"
      | "fetchedAt"
    >
  >,
): GscEvidenceBundle {
  return {
    source: GSC_EVIDENCE_SOURCE,
    property: partial?.property ?? null,
    propertyDisplay: partial?.propertyDisplay ?? null,
    fetchedAt: partial?.fetchedAt ?? new Date().toISOString(),
    window: null,
    freshness: null,
    availability: partial?.availability ?? "unavailable",
    unavailableReason: partial?.unavailableReason ?? "Search Console evidence not available",
    failureCode: partial?.failureCode ?? null,
    retrieval: { queries: null, pages: null },
    observed: {
      totals: null,
      queries: [],
      pages: [],
      criticalPages: [],
      sitemaps: null,
    },
    derived: {
      brandedVsNonBranded: null,
      wowQueries: [],
      wowPages: [],
      commercialPages: [],
      toolPages: [],
      guidePages: [],
      localQueries: [],
    },
    unknown: [
      ...DEFAULT_UNKNOWN,
      {
        claim: "Search Analytics metrics",
        reason: partial?.unavailableReason ?? "GSC unavailable",
      },
    ],
  };
}

function availabilityFromBundle(
  gsc: GscWeeklyBundle | null,
  available: boolean,
): GscEvidenceAvailability {
  if (!gsc || !available) {
    if (gsc?.failureCode === "MISSING_ENV") return "not-configured";
    if (gsc?.failureCode === "TOKEN_FAILED") return "auth-failed";
    if (gsc?.failureCode === "API_FORBIDDEN") return "property-denied";
    return gsc?.failureCode ? "unavailable" : "not-configured";
  }
  const sitemapPartial = gsc.sitemaps?.status === "unavailable";
  const empty =
    (gsc.current?.totals.clicks ?? 0) === 0 &&
    (gsc.current?.totals.impressions ?? 0) === 0 &&
    (gsc.current?.topQueries.length ?? 0) === 0;
  if (sitemapPartial) return "partial";
  if (empty) return "empty";
  return "live";
}

function queryCoverageFromMeta(
  meta: GscDimensionRetrievalMeta | undefined,
  rowsReturned: number,
): GscQueryCoverage | null {
  if (!meta) {
    return {
      rowsReturned,
      requestLimit: rowsReturned,
      requestsMade: 0,
      truncatedOrPotentiallyIncomplete: true,
      stoppedReason: "complete",
      note: GSC_QUERY_COVERAGE_NOTE,
      labeledAsAllQueries: false,
    };
  }
  return { ...meta, labeledAsAllQueries: false };
}

function deriveBrandSplit(queries: GscQueryRow[]): GscBrandSplit | null {
  if (!queries.length) return null;
  let brandedImp = 0;
  let brandedClicks = 0;
  let brandedRows = 0;
  let otherImp = 0;
  let otherClicks = 0;
  let otherRows = 0;
  for (const row of queries) {
    if (isBrandQuery(row.query)) {
      brandedImp += row.impressions;
      brandedClicks += row.clicks;
      brandedRows += 1;
    } else {
      otherImp += row.impressions;
      otherClicks += row.clicks;
      otherRows += 1;
    }
  }
  return {
    epistemic: "derived",
    approximate: true,
    classifier: GSC_BRAND_CLASSIFIER_ID,
    coverageNote: BRAND_COVERAGE_NOTE,
    branded: {
      impressions: brandedImp,
      clicks: brandedClicks,
      ctr: brandedImp > 0 ? brandedClicks / brandedImp : 0,
      queryRows: brandedRows,
    },
    nonBranded: {
      impressions: otherImp,
      clicks: otherClicks,
      ctr: otherImp > 0 ? otherClicks / otherImp : 0,
      queryRows: otherRows,
    },
  };
}

function wowRows<T extends { clicks: number; impressions: number; position: number }>(
  current: T[],
  previous: T[],
  keyOf: (row: T) => string,
): GscMovementRow[] {
  const prevMap = new Map(previous.map((row) => [keyOf(row), row]));
  return current.map((row) => {
    const key = keyOf(row);
    const prev = prevMap.get(key) ?? null;
    const comparable = prev != null && prev.clicks > 0;
    const clickDeltaPct = comparable
      ? ((row.clicks - prev.clicks) / prev.clicks) * 100
      : null;
    return {
      key,
      current: {
        clicks: row.clicks,
        impressions: row.impressions,
        position: row.position,
      },
      previous: prev
        ? {
            clicks: prev.clicks,
            impressions: prev.impressions,
            position: prev.position,
          }
        : null,
      clickDeltaPct,
      comparable,
    };
  });
}

function pagePath(page: string): string {
  try {
    const u = new URL(page);
    return u.pathname || "/";
  } catch {
    return page;
  }
}

function summariesFromCritical(
  rows: GscCriticalPageRow[],
  paths: readonly string[],
  globalPages: GscPageRow[],
): GscPathGroupSummary[] {
  return paths.map((path) => {
    const row = rows.find((r) => r.path === path);
    if (row?.state === "observed" && row.metrics) {
      return {
        pathOrPrefix: path,
        source: "critical-page-lookup",
        state: "observed",
        inGlobalTopPages: row.inGlobalTopPages,
        metrics: row.metrics,
      };
    }
    const fromGlobal = globalPages.find((p) => pagePath(p.page) === path);
    if (fromGlobal) {
      return {
        pathOrPrefix: path,
        source: "global-page-rows",
        state: "observed-from-global-list",
        inGlobalTopPages: true,
        metrics: fromGlobal,
      };
    }
    return {
      pathOrPrefix: path,
      source: "critical-page-lookup",
      state: row?.state ?? "not-fetched",
      inGlobalTopPages: row?.inGlobalTopPages ?? false,
      metrics: null,
    };
  });
}

function guideSummaries(pages: GscPageRow[]): GscPathGroupSummary[] {
  return pages
    .filter((p) => pagePath(p.page).includes("/diamond-guide/"))
    .map((p) => ({
      pathOrPrefix: pagePath(p.page),
      source: "path-group" as const,
      state: "observed-from-global-list" as const,
      inGlobalTopPages: true,
      metrics: p,
    }));
}

function sitemapUnknown(sitemaps: GscSitemapFetchResult | undefined): GscUnknownGap[] {
  if (!sitemaps) {
    return [
      {
        claim: "Submitted sitemap state",
        reason: "sitemaps.list was not fetched",
      },
    ];
  }
  if (sitemaps.status === "unavailable") {
    return [
      {
        claim: "Submitted sitemap state",
        reason: sitemaps.unavailableReason ?? "sitemaps.list failed",
      },
    ];
  }
  return [];
}

function criticalUnknown(
  rows: GscCriticalPageRow[],
  globalPages: GscPageRow[],
): GscUnknownGap[] {
  const globalPaths = new Set(globalPages.map((p) => pagePath(p.page)));
  const gaps: GscUnknownGap[] = [];
  for (const row of rows) {
    if (row.state === "observed") continue;
    if (globalPaths.has(row.path)) continue;
    if (row.state === "filtered-lookup-empty") {
      gaps.push({
        claim: `Search Analytics for ${row.path}`,
        reason:
          "Page-filtered lookup returned no rows and the page was not in the returned global page list. Absence is not an observed zero; anonymized or zero-traffic pages are omitted by Search Console.",
      });
      continue;
    }
    if (row.state === "lookup-failed" || row.state === "not-fetched") {
      gaps.push({
        claim: `Search Analytics for ${row.path}`,
        reason:
          row.state === "lookup-failed"
            ? "Critical-page filtered lookup failed"
            : "Critical-page lookup was not fetched",
      });
    }
  }
  return gaps;
}

export function buildGscEvidenceBundle(
  gsc: GscWeeklyBundle | null,
  opts?: { available?: boolean },
): GscEvidenceBundle {
  const available = Boolean(opts?.available && gsc?.current);
  const property = gsc?.siteUrl ?? null;
  const propertyDisplay = sanitizeGscSiteUrlForDisplay(property);
  const fetchedAt = gsc?.fetchedAt ?? new Date().toISOString();

  if (!available || !gsc) {
    return emptyGscEvidenceBundle({
      availability: availabilityFromBundle(gsc, false),
      unavailableReason:
        gsc?.unavailableReason ??
        "Search Console unavailable or empty for Search Strategy",
      failureCode: gsc?.failureCode ?? null,
      property,
      propertyDisplay,
      fetchedAt,
    });
  }

  const queries = gsc.current?.topQueries ?? [];
  const pages = gsc.current?.topPages ?? [];
  const previousQueries = gsc.previous?.topQueries ?? [];
  const previousPages = gsc.previous?.topPages ?? [];
  const critical = gsc.criticalPages?.current ?? [];
  const sitemapEntries =
    gsc.sitemaps?.status === "observed" ? gsc.sitemaps.entries : null;

  const unknown: GscUnknownGap[] = [
    ...DEFAULT_UNKNOWN,
    ...sitemapUnknown(gsc.sitemaps),
    ...criticalUnknown(critical, pages),
  ];

  if (!gsc.retrieval) {
    unknown.push({
      claim: "Query census completeness",
      reason: GSC_QUERY_COVERAGE_NOTE,
    });
  }

  const totals = gsc.current?.totals ?? null;

  return {
    source: GSC_EVIDENCE_SOURCE,
    property,
    propertyDisplay,
    fetchedAt,
    window: gsc.freshness?.windowsUsed ?? null,
    freshness: gsc.freshness ?? null,
    availability: availabilityFromBundle(gsc, true),
    unavailableReason: null,
    failureCode: null,
    retrieval: {
      queries: queryCoverageFromMeta(gsc.retrieval?.queries, queries.length),
      pages: gsc.retrieval?.pages ?? {
        rowsReturned: pages.length,
        requestLimit: pages.length,
        requestsMade: 0,
        truncatedOrPotentiallyIncomplete: true,
        stoppedReason: "complete",
        note: "Page row retrieval metadata missing — treat list as bounded, not complete.",
      },
    },
    observed: {
      totals,
      queries,
      pages,
      criticalPages: critical,
      sitemaps: sitemapEntries,
    },
    derived: {
      brandedVsNonBranded: deriveBrandSplit(queries),
      wowQueries: wowRows(queries, previousQueries, (r) => r.query.toLowerCase()),
      wowPages: wowRows(pages, previousPages, (r) => r.page),
      commercialPages: summariesFromCritical(critical, COMMERCIAL_PATHS, pages),
      toolPages: summariesFromCritical(critical, TOOL_PATHS, pages),
      guidePages: guideSummaries(pages),
      localQueries: queries.filter((q) => isLocalIntent(q.query) && !isBrandQuery(q.query)),
    },
    unknown,
  };
}

export function gscEvidenceDataGaps(evidence: GscEvidenceBundle): Array<{
  id: string;
  sourceId: "gsc";
  description: string;
  impactOnRecommendations: string;
  suggestedRemedy: string;
}> {
  if (
    evidence.availability === "not-configured" ||
    evidence.availability === "auth-failed" ||
    evidence.availability === "property-denied" ||
    evidence.availability === "unavailable"
  ) {
    return [];
  }
  return evidence.unknown.slice(0, 8).map((gap, i) => ({
    id: `gap-search-gsc-unknown-${i + 1}`,
    sourceId: "gsc" as const,
    description: `UNKNOWN: ${gap.claim} — ${gap.reason}`,
    impactOnRecommendations:
      "Do not treat this as an observed zero or as confirmed indexing/coverage state",
    suggestedRemedy: "Leave as unknown until a supported API or approved export exists",
  }));
}

export function sitemapHasObservedErrors(entries: GscSitemapEntry[] | null): boolean {
  if (!entries) return false;
  return entries.some((e) => (e.errors ?? 0) > 0);
}
