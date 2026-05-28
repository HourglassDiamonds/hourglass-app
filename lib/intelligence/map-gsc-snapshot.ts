import type {
  GscPageRow,
  GscQueryRow,
  GscWeeklyBundle,
} from "@/lib/integrations/gsc";
import { isGscLive } from "@/lib/integrations/gsc";
import { BRAND_QUERY_PATTERNS } from "./brand-queries";
import { deltaPercentage } from "./compare";
import type {
  BrandDemandSnapshot,
  SearchAuthorityMomentumSnapshot,
  SnapshotListItem,
  SnapshotMetric,
} from "./dashboard-snapshot";

function liveMetric(
  label: string,
  value: number,
  opts?: {
    previousValue?: number;
    deltaPercentage?: number | null;
    unit?: SnapshotMetric["unit"];
  },
): SnapshotMetric {
  return {
    label,
    value,
    previousValue: opts?.previousValue,
    deltaPercentage: opts?.deltaPercentage,
    unit: opts?.unit ?? "count",
    source: "gsc",
    status: "live",
  };
}

function pendingGscMetric(label: string): SnapshotMetric {
  return {
    label,
    value: null,
    source: "gsc",
    status: "pending",
    unit: "count",
  };
}

function listFromRows(
  rows: { primary: string; secondary: string }[],
): SnapshotListItem[] {
  return rows.map((r) => ({
    primary: r.primary,
    secondary: r.secondary,
    source: "gsc" as const,
    status: "live" as const,
  }));
}

function queryMovement(
  current: GscQueryRow[],
  previous: GscQueryRow[],
): { gaining: SnapshotListItem[]; losing: SnapshotListItem[] } {
  const prevMap = new Map(previous.map((r) => [r.query, r.impressions]));
  const deltas = current
    .map((r) => ({
      query: r.query,
      delta: r.impressions - (prevMap.get(r.query) ?? 0),
      impressions: r.impressions,
    }))
    .filter((r) => r.delta !== 0);

  const gaining = [...deltas]
    .filter((r) => r.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3)
    .map((r) => ({
      primary: r.query,
      secondary: `+${r.delta} impressions · ${r.impressions} total`,
    }));

  const losing = [...deltas]
    .filter((r) => r.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3)
    .map((r) => ({
      primary: r.query,
      secondary: `${r.delta} impressions · ${r.impressions} total`,
    }));

  return {
    gaining: listFromRows(
      gaining.length ? gaining : [{ primary: "—", secondary: "No gainers" }],
    ),
    losing: listFromRows(
      losing.length ? losing : [{ primary: "—", secondary: "No losers" }],
    ),
  };
}

function pageMovement(
  current: GscPageRow[],
  previous: GscPageRow[],
): { climbing: SnapshotListItem[]; losing: SnapshotListItem[] } {
  const prevMap = new Map(previous.map((r) => [r.page, r.impressions]));
  const deltas = current
    .map((r) => ({
      page: r.page,
      delta: r.impressions - (prevMap.get(r.page) ?? 0),
      impressions: r.impressions,
    }))
    .filter((r) => r.delta !== 0);

  const climbing = [...deltas]
    .filter((r) => r.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3)
    .map((r) => ({
      primary: r.page.replace(/^https?:\/\/[^/]+/, "") || r.page,
      secondary: `+${r.delta} impressions`,
    }));

  const losing = [...deltas]
    .filter((r) => r.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3)
    .map((r) => ({
      primary: r.page.replace(/^https?:\/\/[^/]+/, "") || r.page,
      secondary: `${r.delta} impressions`,
    }));

  return {
    climbing: listFromRows(
      climbing.length ? climbing : [{ primary: "—", secondary: "No climbers" }],
    ),
    losing: listFromRows(
      losing.length ? losing : [{ primary: "—", secondary: "No decliners" }],
    ),
  };
}

export function mapGscToSearchAuthority(
  gsc: GscWeeklyBundle,
): SearchAuthorityMomentumSnapshot {
  if (!isGscLive(gsc) || !gsc.current || !gsc.previous) {
    return {
      source: "gsc",
      status: "pending",
      totalImpressions: pendingGscMetric("Total impressions"),
      impressionsWeekOverWeek: pendingGscMetric("Impressions trend"),
      totalClicks: pendingGscMetric("Total clicks"),
      clicksWeekOverWeek: pendingGscMetric("Clicks trend"),
      averagePosition: pendingGscMetric("Average position"),
      positionMovement: pendingGscMetric("Position movement"),
      ctrTrend: pendingGscMetric("CTR trend"),
      indexedPages: pendingGscMetric("Indexed pages"),
      newlyIndexedPages: pendingGscMetric("Newly indexed"),
      topGainingQueries: [],
      topLosingQueries: [],
      topPagesByImpressions: [],
      fastestClimbingPages: [],
      pagesLosingMomentum: [],
    };
  }

  const cur = gsc.current.totals;
  const prev = gsc.previous.totals;
  const impDelta = deltaPercentage(cur.impressions, prev.impressions);
  const clickDelta = deltaPercentage(cur.clicks, prev.clicks);
  const ctrDelta = deltaPercentage(cur.ctr * 100, prev.ctr * 100);
  const posDelta = cur.position - prev.position;
  const positionNote =
    posDelta < -0.05
      ? "Improving (lower position)"
      : posDelta > 0.05
        ? "Declining"
        : "Stable";

  const { gaining, losing } = queryMovement(
    gsc.current.topQueries,
    gsc.previous.topQueries,
  );
  const pages = pageMovement(gsc.current.topPages, gsc.previous.topPages);

  const topPages = gsc.current.topPages.slice(0, 3).map((p) => ({
    primary: p.page.replace(/^https?:\/\/[^/]+/, "") || p.page,
    secondary: `${p.impressions} impressions · ${(p.ctr * 100).toFixed(1)}% CTR`,
  }));

  return {
    source: "gsc",
    status: "live",
    totalImpressions: liveMetric("Total impressions", cur.impressions, {
      previousValue: prev.impressions,
      deltaPercentage: impDelta,
    }),
    impressionsWeekOverWeek: liveMetric("Impressions WoW", impDelta ?? 0, {
      unit: "percent",
    }),
    totalClicks: liveMetric("Total clicks", cur.clicks, {
      previousValue: prev.clicks,
      deltaPercentage: clickDelta,
    }),
    clicksWeekOverWeek: liveMetric("Clicks WoW", clickDelta ?? 0, {
      unit: "percent",
    }),
    averagePosition: liveMetric("Average position", cur.position, {
      previousValue: prev.position,
      unit: "position",
    }),
    positionMovement: {
      label: "Position movement",
      value: positionNote,
      previousValue: prev.position,
      deltaPercentage: null,
      unit: "position",
      source: "gsc",
      status: "live",
    },
    ctrTrend: liveMetric("CTR", cur.ctr * 100, {
      previousValue: prev.ctr * 100,
      deltaPercentage: ctrDelta,
      unit: "percent",
    }),
    indexedPages: pendingGscMetric("Indexed pages"),
    newlyIndexedPages: pendingGscMetric("Newly indexed pages"),
    topGainingQueries: gaining,
    topLosingQueries: losing,
    topPagesByImpressions: listFromRows(
      topPages.length ? topPages : [{ primary: "—", secondary: "No page data" }],
    ),
    fastestClimbingPages: pages.climbing,
    pagesLosingMomentum: pages.losing,
  };
}

export function mapGscToBrandDemand(gsc: GscWeeklyBundle): BrandDemandSnapshot {
  if (!isGscLive(gsc) || !gsc.brand) {
    return {
      source: "gsc",
      status: "pending",
      brandedImpressions: pendingGscMetric("Branded impressions"),
      brandedClicks: pendingGscMetric("Branded clicks"),
      brandedCtr: pendingGscMetric("Branded CTR"),
      brandSearchGrowthWeekOverWeek: pendingGscMetric("Brand growth"),
      nonBrandVsBrandSplit: pendingGscMetric("Non-brand vs brand"),
      trackedQueryPatterns: BRAND_QUERY_PATTERNS,
    };
  }

  const cur = gsc.brand.current;
  const prev = gsc.brand.previous;
  const brandImpDelta = deltaPercentage(cur.impressions, prev.impressions);
  const totalCur = gsc.current!.totals.impressions;
  const nonBrand = Math.max(0, totalCur - cur.impressions);
  const splitPct = totalCur > 0 ? Math.round((cur.impressions / totalCur) * 100) : 0;

  return {
    source: "gsc",
    status: "live",
    brandedImpressions: liveMetric("Branded impressions", cur.impressions, {
      previousValue: prev.impressions,
      deltaPercentage: brandImpDelta,
    }),
    brandedClicks: liveMetric("Branded clicks", cur.clicks, {
      previousValue: prev.clicks,
      deltaPercentage: deltaPercentage(cur.clicks, prev.clicks),
    }),
    brandedCtr: liveMetric("Branded CTR", cur.ctr * 100, {
      previousValue: prev.ctr * 100,
      unit: "percent",
    }),
    brandSearchGrowthWeekOverWeek: liveMetric(
      "Brand impressions WoW",
      brandImpDelta ?? 0,
      { unit: "percent" },
    ),
    nonBrandVsBrandSplit: {
      label: "Brand share of impressions",
      value: `${splitPct}% brand · ${nonBrand} non-brand`,
      source: "gsc",
      status: "live",
      unit: "ratio",
    },
    trackedQueryPatterns: BRAND_QUERY_PATTERNS,
  };
}
