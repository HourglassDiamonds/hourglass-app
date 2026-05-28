/**
 * Normalized weekly intelligence snapshot — ingestion target for GA4, GSC, GMB, Supabase.
 * Dashboard reads this shape (via map-report-to-dashboard) rather than live API calls.
 */

import { isGscLive, type GscWeeklyBundle } from "@/lib/integrations/gsc";
import { BRAND_QUERY_PATTERNS } from "./brand-queries";
import { deltaPercentage } from "./compare";
import { mapGscToBrandDemand, mapGscToSearchAuthority } from "./map-gsc-snapshot";
import type { Ga4WeeklyBundle, WeeklyReportRecord } from "./types";

export { BRAND_QUERY_PATTERNS } from "./brand-queries";

// —— Source provenance ——

export type DataSourceId =
  | "ga4"
  | "gsc"
  | "gmb"
  | "supabase"
  | "ledger"
  | "hubspot"
  | "concierge";

export type IntegrationStatus = "live" | "pending" | "static" | "partial";

export type SnapshotMetric = {
  value: number | string | null;
  previousValue?: number | string | null;
  deltaPercentage?: number | null;
  unit?: "count" | "percent" | "position" | "ratio";
  source: DataSourceId;
  status: IntegrationStatus;
  label: string;
};

export type SnapshotListItem = {
  primary: string;
  secondary: string;
  source: DataSourceId;
  status: IntegrationStatus;
};

// —— Section snapshots ——

export type SearchAuthorityMomentumSnapshot = {
  source: "gsc";
  status: IntegrationStatus;
  totalImpressions: SnapshotMetric;
  impressionsWeekOverWeek: SnapshotMetric;
  totalClicks: SnapshotMetric;
  clicksWeekOverWeek: SnapshotMetric;
  averagePosition: SnapshotMetric;
  positionMovement: SnapshotMetric;
  ctrTrend: SnapshotMetric;
  indexedPages: SnapshotMetric;
  newlyIndexedPages: SnapshotMetric;
  topGainingQueries: SnapshotListItem[];
  topLosingQueries: SnapshotListItem[];
  topPagesByImpressions: SnapshotListItem[];
  fastestClimbingPages: SnapshotListItem[];
  pagesLosingMomentum: SnapshotListItem[];
};

export type BrandDemandSnapshot = {
  source: "gsc";
  status: IntegrationStatus;
  brandedImpressions: SnapshotMetric;
  brandedClicks: SnapshotMetric;
  brandedCtr: SnapshotMetric;
  brandSearchGrowthWeekOverWeek: SnapshotMetric;
  nonBrandVsBrandSplit: SnapshotMetric;
  trackedQueryPatterns: readonly string[];
};

export type GmbLocalAuthoritySnapshot = {
  source: "gmb";
  status: IntegrationStatus;
  profileViews: SnapshotMetric;
  websiteClicksFromGbp: SnapshotMetric;
  calls: SnapshotMetric;
  directionRequests: SnapshotMetric;
  reviewCount: SnapshotMetric;
  reviewAverage: SnapshotMetric;
  reviewVelocity: SnapshotMetric;
  unansweredReviewsOrQuestions: SnapshotMetric;
  postCadence: SnapshotMetric;
  mapPackRankingTrend: SnapshotMetric;
};

export type DiamondStudioIntelligenceSnapshot = {
  source: "ga4";
  status: IntegrationStatus;
  studioVisits: SnapshotMetric;
  returnUsagePercent: SnapshotMetric;
  topShapes: SnapshotListItem[];
  caratCluster: SnapshotMetric;
  fingerSizeDistribution: SnapshotMetric;
  coverageZoneDistribution: SnapshotMetric;
  orientationUsage: SnapshotMetric;
  mobileVsDesktop: SnapshotMetric;
  sessionDepth: SnapshotMetric;
  ctaConversionPathing: SnapshotMetric;
  abandonmentDropoff: SnapshotMetric;
  highIntentSessions: SnapshotMetric;
  repeatUsersWithin7Days: SnapshotMetric;
  consultationCtaClicks: SnapshotMetric;
  consultationCtaRate: SnapshotMetric;
};

export type AssistedConversionPathsSnapshot = {
  source: "ga4";
  status: IntegrationStatus;
  pathsBeforeConciergeVisit: SnapshotListItem[];
  pathsBeforeConsultationCtaClick: SnapshotListItem[];
  pathsToFormSubmit: SnapshotListItem[];
  assistingPagesAndTools: SnapshotListItem[];
  studioAssistedConversionRate: SnapshotMetric;
};

export type RecommendationUrgency = "critical" | "high" | "medium" | "low";

export type RecommendationActionType =
  | "seo"
  | "content"
  | "studio"
  | "gmb"
  | "brand"
  | "conversion"
  | "ops";

export type PrioritizedRecommendation = {
  id: string;
  title: string;
  rationale: string;
  priority: RecommendationUrgency;
  roiScore: number | null;
  confidenceScore: number | null;
  sourceMetric: string;
  actionType: RecommendationActionType;
  status: IntegrationStatus;
};

export type RecommendationEngineSnapshot = {
  status: IntegrationStatus;
  items: PrioritizedRecommendation[];
};

export type ConsultationFunnelSnapshot = {
  source: "ga4";
  status: IntegrationStatus;
  weeklySessions: SnapshotMetric;
  consultationCtaClicks: SnapshotMetric;
  consultationCtaRate: SnapshotMetric;
  engagedSessionRate: SnapshotMetric;
  subscribers: SnapshotMetric;
};

export type ContentPerformanceSnapshot = {
  source: "ga4";
  status: IntegrationStatus;
  topLandingPages: SnapshotListItem[];
  fastestGrowingPages: SnapshotListItem[];
  pagesToUpgrade: SnapshotListItem[];
};

export type ExecutiveSummarySnapshot = {
  status: IntegrationStatus;
  headline: string;
  supportingNote: string;
  momentumLabel: string;
};

export type LedgerMarketToneSnapshot = {
  source: "ledger";
  status: IntegrationStatus;
  currentEnvironment: string;
  messagingGuidance: string;
  consumerSentiment: string;
};

/** Unified weekly payload stored in raw_payload.dashboardSnapshot over time. */
export type DashboardIntelligenceSnapshot = {
  version: 1;
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  sources: Record<DataSourceId, IntegrationStatus>;
  executiveSummary: ExecutiveSummarySnapshot;
  searchAuthority: SearchAuthorityMomentumSnapshot;
  brandDemand: BrandDemandSnapshot;
  consultationFunnel: ConsultationFunnelSnapshot;
  diamondStudio: DiamondStudioIntelligenceSnapshot;
  contentPerformance: ContentPerformanceSnapshot;
  localAuthority: GmbLocalAuthoritySnapshot;
  assistedPaths: AssistedConversionPathsSnapshot;
  recommendationEngine: RecommendationEngineSnapshot;
  ledger: LedgerMarketToneSnapshot;
};

// —— Pending metric factories ——

function pendingMetric(
  label: string,
  source: DataSourceId,
  note: string,
): SnapshotMetric {
  return {
    label,
    value: null,
    source,
    status: "pending",
    unit: "count",
    previousValue: null,
    deltaPercentage: null,
  };
}

function pendingList(
  source: DataSourceId,
  placeholder: string,
): SnapshotListItem[] {
  return [
    { primary: "—", secondary: placeholder, source, status: "pending" },
    { primary: "—", secondary: placeholder, source, status: "pending" },
    { primary: "—", secondary: placeholder, source, status: "pending" },
  ];
}

function liveMetric(
  label: string,
  value: number,
  source: DataSourceId,
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
    source,
    status: "live",
  };
}

function gscPendingSnapshot(): SearchAuthorityMomentumSnapshot {
  const pending = "pending" as const;
  const note = "Google Search Console · pending integration";
  return {
    source: "gsc",
    status: pending,
    totalImpressions: pendingMetric("Total impressions", "gsc", note),
    impressionsWeekOverWeek: pendingMetric("Impressions trend", "gsc", note),
    totalClicks: pendingMetric("Total clicks", "gsc", note),
    clicksWeekOverWeek: pendingMetric("Clicks trend", "gsc", note),
    averagePosition: pendingMetric("Average position", "gsc", note),
    positionMovement: pendingMetric("Position movement", "gsc", note),
    ctrTrend: pendingMetric("CTR trend", "gsc", note),
    indexedPages: pendingMetric("Indexed pages", "gsc", note),
    newlyIndexedPages: pendingMetric("Newly indexed pages", "gsc", note),
    topGainingQueries: pendingList("gsc", note),
    topLosingQueries: pendingList("gsc", note),
    topPagesByImpressions: pendingList("gsc", note),
    fastestClimbingPages: pendingList("gsc", note),
    pagesLosingMomentum: pendingList("gsc", note),
  };
}

function brandDemandPending(): BrandDemandSnapshot {
  const note = "Branded query filter · GSC pending";
  return {
    source: "gsc",
    status: "pending",
    brandedImpressions: pendingMetric("Branded impressions", "gsc", note),
    brandedClicks: pendingMetric("Branded clicks", "gsc", note),
    brandedCtr: pendingMetric("Branded CTR", "gsc", note),
    brandSearchGrowthWeekOverWeek: pendingMetric("Brand growth WoW", "gsc", note),
    nonBrandVsBrandSplit: pendingMetric("Non-brand vs brand", "gsc", note),
    trackedQueryPatterns: BRAND_QUERY_PATTERNS,
  };
}

function gmbPending(): GmbLocalAuthoritySnapshot {
  const note = "Google Business Profile API · pending";
  return {
    source: "gmb",
    status: "pending",
    profileViews: pendingMetric("Profile views", "gmb", note),
    websiteClicksFromGbp: pendingMetric("Website clicks", "gmb", note),
    calls: pendingMetric("Calls", "gmb", note),
    directionRequests: pendingMetric("Direction requests", "gmb", note),
    reviewCount: pendingMetric("Review count", "gmb", note),
    reviewAverage: {
      label: "Review average",
      value: 5.0,
      source: "gmb",
      status: "static",
      unit: "ratio",
    },
    reviewVelocity: pendingMetric("Review velocity", "gmb", note),
    unansweredReviewsOrQuestions: pendingMetric("Unanswered items", "gmb", note),
    postCadence: pendingMetric("Post cadence", "gmb", note),
    mapPackRankingTrend: pendingMetric("Map pack trend", "gmb", note),
  };
}

function assistedPathsPending(): AssistedConversionPathsSnapshot {
  const note = "GA4 path exploration · pending";
  return {
    source: "ga4",
    status: "pending",
    pathsBeforeConciergeVisit: pendingList("ga4", note),
    pathsBeforeConsultationCtaClick: pendingList("ga4", note),
    pathsToFormSubmit: pendingList("ga4", note),
    assistingPagesAndTools: pendingList("ga4", note),
    studioAssistedConversionRate: pendingMetric(
      "Studio-assisted conversion",
      "ga4",
      note,
    ),
  };
}

function buildRecommendationsFromReport(
  report: WeeklyReportRecord | null,
  ga4: Ga4WeeklyBundle | null,
): RecommendationEngineSnapshot {
  if (!report?.recommendations?.length) {
    return { status: "pending", items: [] };
  }

  const items: PrioritizedRecommendation[] = report.recommendations
    .slice(0, 6)
    .map((text, i) => ({
      id: `rule-${i}`,
      title: text.length > 72 ? `${text.slice(0, 69)}…` : text,
      rationale: text,
      priority: (i === 0 ? "high" : "medium") as RecommendationUrgency,
      roiScore: null,
      confidenceScore: null,
      sourceMetric: "weekly_intelligence_rules",
      actionType: "ops" as RecommendationActionType,
      status: "partial" as IntegrationStatus,
    }));

  if (ga4 && ga4.current.consultationCtaClicks > 0) {
    items.unshift({
      id: "cta-live",
      title: "Consultation CTA tracking is live",
      rationale: `${ga4.current.consultationCtaClicks} consultation_cta_clicked events this week — monitor funnel paths next.`,
      priority: "medium",
      roiScore: null,
      confidenceScore: 0.9,
      sourceMetric: "consultation_cta_clicked",
      actionType: "conversion",
      status: "live",
    });
  }

  return { status: "partial", items };
}

export function buildDashboardSnapshot(
  report: WeeklyReportRecord | null,
  ga4: Ga4WeeklyBundle | null,
  gsc: GscWeeklyBundle | null = null,
): DashboardIntelligenceSnapshot {
  const weekStart = report?.week_start ?? "";
  const weekEnd = report?.week_end ?? "";
  const hasGa4 = Boolean(ga4?.current && ga4?.previous);

  const hasGsc = isGscLive(gsc);

  const sources: DashboardIntelligenceSnapshot["sources"] = {
    ga4: hasGa4 ? "live" : "pending",
    gsc: hasGsc ? "live" : "pending",
    gmb: "pending",
    supabase: report ? "live" : "pending",
    ledger: "pending",
    hubspot: "pending",
    concierge: "pending",
  };

  let consultationFunnel: ConsultationFunnelSnapshot;
  let diamondStudio: DiamondStudioIntelligenceSnapshot;
  let contentPerformance: ContentPerformanceSnapshot;

  if (hasGa4 && ga4) {
    const cur = ga4.current;
    const prev = ga4.previous;
    const sessionsDelta = deltaPercentage(
      cur.traffic.sessions,
      prev.traffic.sessions,
    );
    const ctaDelta = deltaPercentage(
      cur.consultationCtaClicks,
      prev.consultationCtaClicks,
    );
    const engagementDelta = deltaPercentage(
      cur.traffic.engagementRate,
      prev.traffic.engagementRate,
    );
    const studioDelta = deltaPercentage(cur.studioViews, prev.studioViews);
    const ctaRate =
      cur.studioViews > 0
        ? (cur.consultationCtaClicks / cur.studioViews) * 100
        : 0;

    consultationFunnel = {
      source: "ga4",
      status: "live",
      weeklySessions: liveMetric("Weekly sessions", cur.traffic.sessions, "ga4", {
        previousValue: prev.traffic.sessions,
        deltaPercentage: sessionsDelta,
      }),
      consultationCtaClicks: liveMetric(
        "Consultation CTA clicks",
        cur.consultationCtaClicks,
        "ga4",
        { previousValue: prev.consultationCtaClicks, deltaPercentage: ctaDelta },
      ),
      consultationCtaRate: liveMetric("CTA / studio views", ctaRate, "ga4", {
        unit: "percent",
      }),
      engagedSessionRate: liveMetric(
        "Engaged session rate",
        cur.traffic.engagementRate * 100,
        "ga4",
        {
          previousValue: prev.traffic.engagementRate * 100,
          deltaPercentage: engagementDelta,
          unit: "percent",
        },
      ),
      subscribers: pendingMetric("Subscribers", "hubspot", "Ledger / CRM · not connected"),
    };

    const mobile = cur.devices.find((d) => d.value.toLowerCase() === "mobile");
    const desktop = cur.devices.find((d) => d.value.toLowerCase() === "desktop");
    const totalDevice = (mobile?.sessions ?? 0) + (desktop?.sessions ?? 0);
    const mobilePct = totalDevice
      ? Math.round(((mobile?.sessions ?? 0) / totalDevice) * 100)
      : 0;

    diamondStudio = {
      source: "ga4",
      status: "partial",
      studioVisits: liveMetric("Studio visits", cur.studioViews, "ga4", {
        previousValue: prev.studioViews,
        deltaPercentage: studioDelta,
      }),
      returnUsagePercent: pendingMetric(
        "Return usage %",
        "ga4",
        "Repeat studio sessions · GA4 pending",
      ),
      topShapes: cur.topShapes.slice(0, 3).map((s) => ({
        primary: s.shape,
        secondary: `${s.eventCount} events`,
        source: "ga4" as const,
        status: "live" as const,
      })),
      caratCluster: pendingMetric("Carat cluster", "ga4", "carat_changed · pending"),
      fingerSizeDistribution: pendingMetric(
        "Finger size distribution",
        "ga4",
        "finger_size_changed · pending",
      ),
      coverageZoneDistribution: pendingMetric(
        "Coverage zone distribution",
        "ga4",
        "coverage_zone_changed · pending",
      ),
      orientationUsage: liveMetric(
        "Orientation events",
        cur.studioEvents.orientation_changed ?? 0,
        "ga4",
        {
          previousValue: prev.studioEvents.orientation_changed ?? 0,
        },
      ),
      mobileVsDesktop: liveMetric("Mobile share", mobilePct, "ga4", {
        unit: "percent",
      }),
      sessionDepth: pendingMetric(
        "Session depth",
        "ga4",
        "studio_session_engaged · pending",
      ),
      ctaConversionPathing: pendingMetric(
        "CTA pathing",
        "ga4",
        "Path exploration · pending",
      ),
      abandonmentDropoff: pendingMetric("Drop-off points", "ga4", "Funnel · pending"),
      highIntentSessions: pendingMetric(
        "High-intent sessions",
        "ga4",
        "Engaged + CTA · pending",
      ),
      repeatUsersWithin7Days: pendingMetric(
        "Repeat users (7d)",
        "ga4",
        "User ID · pending",
      ),
      consultationCtaClicks: liveMetric(
        "Consultation CTA clicks",
        cur.consultationCtaClicks,
        "ga4",
      ),
      consultationCtaRate: liveMetric("CTA rate", ctaRate, "ga4", { unit: "percent" }),
    };

    contentPerformance = {
      source: "ga4",
      status: "partial",
      topLandingPages: cur.landingPages.slice(0, 3).map((p) => ({
        primary: p.value,
        secondary: `${p.sessions} sessions · GA4`,
        source: "ga4",
        status: "live",
      })),
      fastestGrowingPages: cur.landingPages.slice(0, 3).map((p) => {
        const prevPage = prev.landingPages.find((x) => x.value === p.value);
        const d = prevPage
          ? deltaPercentage(p.sessions, prevPage.sessions)
          : null;
        return {
          primary: p.value,
          secondary: d != null ? `WoW ${d > 0 ? "+" : ""}${Math.round(d)}%` : "GA4",
          source: "ga4" as const,
          status: "live" as const,
        };
      }),
      pagesToUpgrade: (report?.problems ?? []).slice(0, 3).map((p) => ({
        primary: "Review item",
        secondary: p,
        source: "supabase" as const,
        status: "partial" as const,
      })),
    };
  } else {
    consultationFunnel = {
      source: "ga4",
      status: "pending",
      weeklySessions: pendingMetric("Weekly sessions", "ga4", "No weekly report"),
      consultationCtaClicks: pendingMetric("Consultation CTA clicks", "ga4", "—"),
      consultationCtaRate: pendingMetric("CTA rate", "ga4", "—"),
      engagedSessionRate: pendingMetric("Engaged session rate", "ga4", "—"),
      subscribers: pendingMetric("Subscribers", "hubspot", "Not connected"),
    };
    diamondStudio = {
      source: "ga4",
      status: "pending",
      studioVisits: pendingMetric("Studio visits", "ga4", "—"),
      returnUsagePercent: pendingMetric("Return usage %", "ga4", "—"),
      topShapes: pendingList("ga4", "—"),
      caratCluster: pendingMetric("Carat cluster", "ga4", "—"),
      fingerSizeDistribution: pendingMetric("Finger size", "ga4", "—"),
      coverageZoneDistribution: pendingMetric("Coverage zone", "ga4", "—"),
      orientationUsage: pendingMetric("Orientation", "ga4", "—"),
      mobileVsDesktop: pendingMetric("Mobile vs desktop", "ga4", "—"),
      sessionDepth: pendingMetric("Session depth", "ga4", "—"),
      ctaConversionPathing: pendingMetric("CTA pathing", "ga4", "—"),
      abandonmentDropoff: pendingMetric("Drop-off", "ga4", "—"),
      highIntentSessions: pendingMetric("High-intent", "ga4", "—"),
      repeatUsersWithin7Days: pendingMetric("Repeat users", "ga4", "—"),
      consultationCtaClicks: pendingMetric("CTA clicks", "ga4", "—"),
      consultationCtaRate: pendingMetric("CTA rate", "ga4", "—"),
    };
    contentPerformance = {
      source: "ga4",
      status: "pending",
      topLandingPages: pendingList("ga4", "—"),
      fastestGrowingPages: pendingList("ga4", "—"),
      pagesToUpgrade: pendingList("ga4", "—"),
    };
  }

  return {
    version: 1,
    weekStart,
    weekEnd,
    generatedAt: report?.created_at ?? new Date().toISOString(),
    sources,
    executiveSummary: {
      status: report ? "partial" : "pending",
      headline:
        report?.executive_summary.split(".")[0]?.trim() ??
        "No weekly intelligence report loaded.",
      supportingNote:
        report?.recommendations[0] ??
        "Run the weekly GA4 pipeline to populate executive summary.",
      momentumLabel: hasGa4 ? "From GA4 weekly bundle" : "Awaiting data",
    },
    searchAuthority: hasGsc
      ? mapGscToSearchAuthority(gsc!)
      : gscPendingSnapshot(),
    brandDemand: hasGsc ? mapGscToBrandDemand(gsc!) : brandDemandPending(),
    consultationFunnel,
    diamondStudio,
    contentPerformance,
    localAuthority: gmbPending(),
    assistedPaths: assistedPathsPending(),
    recommendationEngine: buildRecommendationsFromReport(report, ga4),
    ledger: {
      source: "ledger",
      status: "pending",
      currentEnvironment: "Measured caution with selective confidence",
      messagingGuidance:
        "Lead with calm guidance and permanence; avoid urgency framing",
      consumerSentiment:
        "Quiet luxury and process clarity resonate; macro indices not wired",
    },
  };
}
