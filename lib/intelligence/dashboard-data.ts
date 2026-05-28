/** Data shape powering /executive-dashboard (matches existing UI components). */

import type {
  DashboardIntelligenceSnapshot,
  SnapshotListItem,
  SnapshotMetric,
} from "./dashboard-snapshot";
import { BRAND_QUERY_PATTERNS } from "./dashboard-snapshot";

export type MetricStatus =
  | "Stable"
  | "Accelerating"
  | "Emerging"
  | "Watch"
  | "Cooling";

export type MetricField = {
  value: string;
  trendLine: string;
  status?: MetricStatus;
  /** Subtle provenance hint shown under the value (e.g. GA4, Not connected). */
  sourceLabel?: string;
};

export type DashboardListRow = {
  title: string;
  note: string;
};

export type RecommendationCard = {
  title: string;
  rationale: string;
  priority: string;
  sourceLabel: string;
  roiScore?: string;
  confidence?: string;
  actionType?: string;
};

/** Subscriber / email list — no integration yet. */
export const SUBSCRIBERS_NOT_CONNECTED: MetricField = {
  value: "—",
  trendLine: "Awaiting Ledger or CRM connection",
  sourceLabel: "Not connected",
};

/** Verified public rating; GMB API not wired yet. */
export const STATIC_GOOGLE_REVIEWS: MetricField = {
  value: "5.0",
  trendLine: "5 stars · verified rating",
  status: "Stable",
  sourceLabel: "Static",
};

export function gmbNotConnected(label: string): MetricField {
  return {
    value: "—",
    trendLine: `${label} · GMB not connected`,
    sourceLabel: "Pending · GMB",
  };
}

export function gscPending(label: string): MetricField {
  return {
    value: "—",
    trendLine: `${label} · Search Console pending`,
    sourceLabel: "Pending · GSC",
  };
}

export function ga4PendingMetric(detail: string): MetricField {
  return {
    value: "—",
    trendLine: detail,
    sourceLabel: "Pending · GA4",
  };
}

export function scaffoldMetric(sample: string, note: string): MetricField {
  return {
    value: sample,
    trendLine: note,
    sourceLabel: "Illustrative",
  };
}

function sourceLabelFromStatus(
  source: string,
  status: string,
): string {
  if (status === "live") return source.toUpperCase();
  if (status === "static") return "Static";
  if (status === "partial") return `${source.toUpperCase()} · partial`;
  return `Pending · ${source.toUpperCase()}`;
}

export function snapshotMetricToField(m: SnapshotMetric): MetricField {
  const value =
    m.value === null || m.value === undefined
      ? "—"
      : typeof m.value === "number"
        ? m.unit === "percent"
          ? `${Math.round(m.value * 10) / 10}%`
          : m.unit === "position"
            ? m.value.toFixed(1)
            : String(Math.round(m.value))
        : String(m.value);

  let trendLine = m.label;
  if (m.deltaPercentage != null && m.status === "live") {
    const sign = m.deltaPercentage > 0 ? "+" : "";
    trendLine = `${m.label} · ${sign}${Math.round(m.deltaPercentage)}% WoW`;
  } else if (m.status === "pending") {
    trendLine = `${m.label} · awaiting source`;
  }

  return {
    value,
    trendLine,
    sourceLabel: sourceLabelFromStatus(m.source, m.status),
  };
}

export function snapshotListToRows(items: SnapshotListItem[]): DashboardListRow[] {
  return items.map((item) => ({
    title: item.primary,
    note: `${item.secondary} · ${sourceLabelFromStatus(item.source, item.status)}`,
  }));
}

export type SearchAuthoritySection = {
  sectionNote: string;
  totalImpressions: MetricField;
  impressionsTrend: MetricField;
  totalClicks: MetricField;
  clicksTrend: MetricField;
  averagePosition: MetricField;
  positionMovement: MetricField;
  ctrTrend: MetricField;
  indexedPages: MetricField;
  newlyIndexedPages: MetricField;
  topGainingQueries: DashboardListRow[];
  topLosingQueries: DashboardListRow[];
  topPagesByImpressions: DashboardListRow[];
  fastestClimbingPages: DashboardListRow[];
  pagesLosingMomentum: DashboardListRow[];
};

export type BrandDemandSection = {
  sectionNote: string;
  brandedImpressions: MetricField;
  brandedClicks: MetricField;
  brandedCtr: MetricField;
  brandSearchGrowth: MetricField;
  nonBrandVsBrand: MetricField;
  trackedQueriesNote: string;
};

export type ConsultationFunnelSection = {
  sectionNote: string;
  weeklyTraffic: MetricField;
  subscribers: MetricField;
  conciergeInquiries: MetricField;
  consultationConversion: MetricField;
  returningVisitors: MetricField;
};

export type DiamondStudioSection = {
  sectionNote: string;
  mostSelectedShape: MetricField;
  fastestGrowingShape: MetricField;
  avgCaratCluster: MetricField;
  mostCommonCoverageZone: MetricField;
  mobileVsDesktop: MetricField;
  eastWestInterest: MetricField;
  studioVisits: MetricField;
  returnUsage: MetricField;
  sessionDepth: MetricField;
  highIntentSessions: MetricField;
  repeatUsers7d: MetricField;
  ctaPathing: MetricField;
};

export type LocalAuthoritySection = {
  sectionNote: string;
  googleReviews: MetricField;
  profileViews: MetricField;
  websiteClicksFromGbp: MetricField;
  directionRequests: MetricField;
  calls: MetricField;
  gmbEngagement: MetricField;
  reviewVelocity: MetricField;
  unansweredItems: MetricField;
  postCadence: MetricField;
  mapPackTrend: MetricField;
};

export type AssistedPathsSection = {
  sectionNote: string;
  pathsBeforeConcierge: DashboardListRow[];
  pathsBeforeCtaClick: DashboardListRow[];
  pathsToFormSubmit: DashboardListRow[];
  assistingPages: DashboardListRow[];
  studioAssistedConversion: MetricField;
};

export type RecommendationEngineSection = {
  sectionNote: string;
  items: RecommendationCard[];
};

export type ContentSection = {
  sectionNote: string;
  topArticles: DashboardListRow[];
  fastestGrowingPages: DashboardListRow[];
  pagesToUpgrade: DashboardListRow[];
};

export type LedgerSection = {
  sectionNote: string;
  currentEnvironment: string;
  messagingGuidance: string;
  consumerSentiment: string;
};

/** UI-ready dashboard sections (derived from DashboardIntelligenceSnapshot). */
export type ExecutiveDashboardData = {
  weeklySignal: {
    status: MetricStatus;
    insight: string;
    note: string;
  };
  searchAuthority: SearchAuthoritySection;
  /** Consultation funnel — same metrics as legacy businessPulse. */
  consultationFunnel: ConsultationFunnelSection;
  /** @deprecated Use consultationFunnel — kept for gradual migration */
  businessPulse: ConsultationFunnelSection;
  diamondStudio: DiamondStudioSection;
  content: ContentSection;
  localAuthority: LocalAuthoritySection;
  assistedPaths: AssistedPathsSection;
  recommendations: RecommendationEngineSection;
  brandDemand: BrandDemandSection;
  ledger: LedgerSection;
};

/** Full payload: normalized snapshot + display layer. */
export type ExecutiveDashboardPayload = {
  snapshot: DashboardIntelligenceSnapshot;
  display: ExecutiveDashboardData;
  isLive: boolean;
  weekLabel?: string;
};

const GSC_NOTE =
  "Google Search Console integration pending — metrics will populate from weekly snapshots once wired.";

const BRAND_NOTE = `Brand-demand queries tracked: ${BRAND_QUERY_PATTERNS.slice(0, 3).join(", ")}, and similar variants · GSC pending.`;

const PATH_NOTE =
  "GA4 path and funnel exploration pending — architecture reserved for assisted conversion analysis.";

const SEARCH_PLACEHOLDER: SearchAuthoritySection = {
  sectionNote: GSC_NOTE,
  totalImpressions: gscPending("Total impressions"),
  impressionsTrend: gscPending("Impressions WoW"),
  totalClicks: gscPending("Total clicks"),
  clicksTrend: gscPending("Clicks WoW"),
  averagePosition: gscPending("Average position"),
  positionMovement: gscPending("Position movement"),
  ctrTrend: gscPending("CTR trend"),
  indexedPages: gscPending("Indexed pages"),
  newlyIndexedPages: gscPending("Newly indexed"),
  topGainingQueries: [{ title: "—", note: "GSC · pending" }],
  topLosingQueries: [{ title: "—", note: "GSC · pending" }],
  topPagesByImpressions: [{ title: "—", note: "GSC · pending" }],
  fastestClimbingPages: [{ title: "—", note: "GSC · pending" }],
  pagesLosingMomentum: [{ title: "—", note: "GSC · pending" }],
};

const BRAND_PLACEHOLDER: BrandDemandSection = {
  sectionNote: BRAND_NOTE,
  brandedImpressions: gscPending("Branded impressions"),
  brandedClicks: gscPending("Branded clicks"),
  brandedCtr: gscPending("Branded CTR"),
  brandSearchGrowth: gscPending("Brand growth WoW"),
  nonBrandVsBrand: gscPending("Non-brand vs brand"),
  trackedQueriesNote: BRAND_QUERY_PATTERNS.join(" · "),
};

const FUNNEL_PLACEHOLDER: ConsultationFunnelSection = {
  sectionNote:
    "Illustrative layout only — run the weekly intelligence job for live GA4 traffic and consultation CTA metrics.",
  weeklyTraffic: scaffoldMetric("—", "GA4 weekly report not loaded"),
  subscribers: SUBSCRIBERS_NOT_CONNECTED,
  conciergeInquiries: scaffoldMetric("—", "consultation_cta_clicked · GA4"),
  consultationConversion: scaffoldMetric("—", "CTA / studio views · GA4"),
  returningVisitors: scaffoldMetric("—", "Engagement rate · GA4"),
};

const STUDIO_PLACEHOLDER: DiamondStudioSection = {
  sectionNote:
    "Illustrative layout — shape and device metrics populate from GA4 when a weekly report exists.",
  mostSelectedShape: scaffoldMetric("—", "Top shape · GA4 events"),
  fastestGrowingShape: scaffoldMetric("—", "Week-over-week shape depth · GA4"),
  avgCaratCluster: ga4PendingMetric("Carat cluster not yet mapped in GA4"),
  mostCommonCoverageZone: ga4PendingMetric("Coverage zone not yet mapped in GA4"),
  mobileVsDesktop: scaffoldMetric("—", "Device split · GA4 sessions"),
  eastWestInterest: scaffoldMetric("—", "Orientation events · GA4"),
  studioVisits: scaffoldMetric("—", "diamond_studio_view · GA4"),
  returnUsage: ga4PendingMetric("Return usage % · pending"),
  sessionDepth: ga4PendingMetric("studio_session_engaged · pending"),
  highIntentSessions: ga4PendingMetric("High-intent composite · pending"),
  repeatUsers7d: ga4PendingMetric("Repeat users 7d · pending"),
  ctaPathing: ga4PendingMetric("CTA pathing · pending"),
};

/** Fallback when no weekly report exists in Supabase. */
export const PLACEHOLDER_DASHBOARD_DATA: ExecutiveDashboardData = {
  weeklySignal: {
    status: "Watch",
    insight:
      "No weekly intelligence report loaded — run the GA4 pipeline to populate this panel.",
    note: "Illustrative scaffold only. Live copy is generated from the latest Supabase weekly report.",
  },
  searchAuthority: SEARCH_PLACEHOLDER,
  consultationFunnel: FUNNEL_PLACEHOLDER,
  businessPulse: FUNNEL_PLACEHOLDER,
  diamondStudio: STUDIO_PLACEHOLDER,
  brandDemand: BRAND_PLACEHOLDER,
  content: {
    sectionNote:
      "Illustrative lists — landing paths and session notes come from GA4 after a weekly report runs.",
    topArticles: [
      { title: "—", note: "GA4 landing pages · not loaded" },
      { title: "—", note: "GA4 landing pages · not loaded" },
      { title: "—", note: "GA4 landing pages · not loaded" },
    ],
    fastestGrowingPages: [
      { title: "—", note: "GA4 week-over-week · not loaded" },
      { title: "—", note: "GA4 week-over-week · not loaded" },
      { title: "—", note: "GA4 week-over-week · not loaded" },
    ],
    pagesToUpgrade: [
      { title: "—", note: "Intelligence recommendations · not loaded" },
      { title: "—", note: "Intelligence recommendations · not loaded" },
      { title: "—", note: "Intelligence recommendations · not loaded" },
    ],
  },
  localAuthority: {
    sectionNote:
      "Google rating shown at 5.0 / 5 stars (verified). GBP insights await Google Business Profile API.",
    googleReviews: STATIC_GOOGLE_REVIEWS,
    profileViews: gmbNotConnected("Profile views"),
    websiteClicksFromGbp: gmbNotConnected("Website clicks"),
    directionRequests: gmbNotConnected("Direction requests"),
    calls: gmbNotConnected("Calls"),
    gmbEngagement: gmbNotConnected("Profile engagement"),
    reviewVelocity: gmbNotConnected("Review velocity"),
    unansweredItems: gmbNotConnected("Unanswered reviews"),
    postCadence: gmbNotConnected("Post cadence"),
    mapPackTrend: gmbNotConnected("Map pack trend"),
  },
  assistedPaths: {
    sectionNote: PATH_NOTE,
    pathsBeforeConcierge: [{ title: "—", note: "GA4 paths · pending" }],
    pathsBeforeCtaClick: [{ title: "—", note: "GA4 paths · pending" }],
    pathsToFormSubmit: [{ title: "—", note: "Concierge submit · pending" }],
    assistingPages: [{ title: "—", note: "Assisted pages · pending" }],
    studioAssistedConversion: ga4PendingMetric("Studio-assisted rate · pending"),
  },
  recommendations: {
    sectionNote:
      "Rule-based recommendations from weekly intelligence — scored recommendations pending.",
    items: [],
  },
  ledger: {
    sectionNote:
      "Illustrative macro tone — Ledger indices not yet wired to this dashboard.",
    currentEnvironment: "Measured caution with selective confidence",
    messagingGuidance:
      "Lead with calm guidance and permanence; avoid urgency framing",
    consumerSentiment:
      "Quiet luxury and process clarity resonate; information fatigue elevated in macro indices",
  },
};

export function displayFromSnapshot(
  snapshot: DashboardIntelligenceSnapshot,
  report: {
    traffic_summary: string;
    diamond_studio_summary: string;
    landing_page_summary: string;
    recommendations: string[];
  } | null,
): ExecutiveDashboardData {
  const s = snapshot;
  const funnelNote =
    (report?.traffic_summary.split(".")[0] ?? "") + "." ||
    FUNNEL_PLACEHOLDER.sectionNote;

  const topShape = s.diamondStudio.topShapes[0];
  const secondShape = s.diamondStudio.topShapes[1];

  return {
    weeklySignal: {
      status: "Watch",
      insight: s.executiveSummary.headline.endsWith(".")
        ? s.executiveSummary.headline
        : `${s.executiveSummary.headline}.`,
      note: s.executiveSummary.supportingNote,
    },
    searchAuthority: {
      sectionNote: GSC_NOTE,
      totalImpressions: snapshotMetricToField(s.searchAuthority.totalImpressions),
      impressionsTrend: snapshotMetricToField(
        s.searchAuthority.impressionsWeekOverWeek,
      ),
      totalClicks: snapshotMetricToField(s.searchAuthority.totalClicks),
      clicksTrend: snapshotMetricToField(s.searchAuthority.clicksWeekOverWeek),
      averagePosition: snapshotMetricToField(s.searchAuthority.averagePosition),
      positionMovement: snapshotMetricToField(s.searchAuthority.positionMovement),
      ctrTrend: snapshotMetricToField(s.searchAuthority.ctrTrend),
      indexedPages: snapshotMetricToField(s.searchAuthority.indexedPages),
      newlyIndexedPages: snapshotMetricToField(s.searchAuthority.newlyIndexedPages),
      topGainingQueries: snapshotListToRows(s.searchAuthority.topGainingQueries),
      topLosingQueries: snapshotListToRows(s.searchAuthority.topLosingQueries),
      topPagesByImpressions: snapshotListToRows(
        s.searchAuthority.topPagesByImpressions,
      ),
      fastestClimbingPages: snapshotListToRows(
        s.searchAuthority.fastestClimbingPages,
      ),
      pagesLosingMomentum: snapshotListToRows(s.searchAuthority.pagesLosingMomentum),
    },
    brandDemand: {
      sectionNote: BRAND_NOTE,
      brandedImpressions: snapshotMetricToField(s.brandDemand.brandedImpressions),
      brandedClicks: snapshotMetricToField(s.brandDemand.brandedClicks),
      brandedCtr: snapshotMetricToField(s.brandDemand.brandedCtr),
      brandSearchGrowth: snapshotMetricToField(
        s.brandDemand.brandSearchGrowthWeekOverWeek,
      ),
      nonBrandVsBrand: snapshotMetricToField(s.brandDemand.nonBrandVsBrandSplit),
      trackedQueriesNote: s.brandDemand.trackedQueryPatterns.join(" · "),
    },
    consultationFunnel: {
      sectionNote: funnelNote,
      weeklyTraffic: snapshotMetricToField(s.consultationFunnel.weeklySessions),
      subscribers: snapshotMetricToField(s.consultationFunnel.subscribers),
      conciergeInquiries: snapshotMetricToField(
        s.consultationFunnel.consultationCtaClicks,
      ),
      consultationConversion: snapshotMetricToField(
        s.consultationFunnel.consultationCtaRate,
      ),
      returningVisitors: snapshotMetricToField(
        s.consultationFunnel.engagedSessionRate,
      ),
    },
    businessPulse: {
      sectionNote: funnelNote,
      weeklyTraffic: snapshotMetricToField(s.consultationFunnel.weeklySessions),
      subscribers: snapshotMetricToField(s.consultationFunnel.subscribers),
      conciergeInquiries: snapshotMetricToField(
        s.consultationFunnel.consultationCtaClicks,
      ),
      consultationConversion: snapshotMetricToField(
        s.consultationFunnel.consultationCtaRate,
      ),
      returningVisitors: snapshotMetricToField(
        s.consultationFunnel.engagedSessionRate,
      ),
    },
    diamondStudio: {
      sectionNote:
        (report?.diamond_studio_summary.split(".")[0] ?? "") + "." ||
        STUDIO_PLACEHOLDER.sectionNote,
      mostSelectedShape: topShape
        ? {
            value: topShape.primary,
            trendLine: topShape.secondary,
            sourceLabel: "GA4",
            status: "Stable",
          }
        : STUDIO_PLACEHOLDER.mostSelectedShape,
      fastestGrowingShape: secondShape
        ? {
            value: secondShape.primary,
            trendLine: secondShape.secondary,
            sourceLabel: "GA4",
          }
        : STUDIO_PLACEHOLDER.fastestGrowingShape,
      avgCaratCluster: snapshotMetricToField(s.diamondStudio.caratCluster),
      mostCommonCoverageZone: snapshotMetricToField(
        s.diamondStudio.coverageZoneDistribution,
      ),
      mobileVsDesktop: snapshotMetricToField(s.diamondStudio.mobileVsDesktop),
      eastWestInterest: snapshotMetricToField(s.diamondStudio.orientationUsage),
      studioVisits: snapshotMetricToField(s.diamondStudio.studioVisits),
      returnUsage: snapshotMetricToField(s.diamondStudio.returnUsagePercent),
      sessionDepth: snapshotMetricToField(s.diamondStudio.sessionDepth),
      highIntentSessions: snapshotMetricToField(s.diamondStudio.highIntentSessions),
      repeatUsers7d: snapshotMetricToField(s.diamondStudio.repeatUsersWithin7Days),
      ctaPathing: snapshotMetricToField(s.diamondStudio.ctaConversionPathing),
    },
    content: {
      sectionNote: report?.landing_page_summary
        ? "Landing paths below reflect GA4 session entry for the week."
        : PLACEHOLDER_DASHBOARD_DATA.content.sectionNote,
      topArticles: snapshotListToRows(s.contentPerformance.topLandingPages),
      fastestGrowingPages: snapshotListToRows(
        s.contentPerformance.fastestGrowingPages,
      ),
      pagesToUpgrade: snapshotListToRows(s.contentPerformance.pagesToUpgrade),
    },
    localAuthority: {
      sectionNote:
        "Google rating at 5.0 / 5 stars (verified). GBP metrics populate when Google Business Profile API is wired.",
      googleReviews: STATIC_GOOGLE_REVIEWS,
      profileViews: snapshotMetricToField(s.localAuthority.profileViews),
      websiteClicksFromGbp: snapshotMetricToField(
        s.localAuthority.websiteClicksFromGbp,
      ),
      directionRequests: snapshotMetricToField(s.localAuthority.directionRequests),
      calls: snapshotMetricToField(s.localAuthority.calls),
      gmbEngagement: snapshotMetricToField(s.localAuthority.profileViews),
      reviewVelocity: snapshotMetricToField(s.localAuthority.reviewVelocity),
      unansweredItems: snapshotMetricToField(
        s.localAuthority.unansweredReviewsOrQuestions,
      ),
      postCadence: snapshotMetricToField(s.localAuthority.postCadence),
      mapPackTrend: snapshotMetricToField(s.localAuthority.mapPackRankingTrend),
    },
    assistedPaths: {
      sectionNote: PATH_NOTE,
      pathsBeforeConcierge: snapshotListToRows(
        s.assistedPaths.pathsBeforeConciergeVisit,
      ),
      pathsBeforeCtaClick: snapshotListToRows(
        s.assistedPaths.pathsBeforeConsultationCtaClick,
      ),
      pathsToFormSubmit: snapshotListToRows(s.assistedPaths.pathsToFormSubmit),
      assistingPages: snapshotListToRows(s.assistedPaths.assistingPagesAndTools),
      studioAssistedConversion: snapshotMetricToField(
        s.assistedPaths.studioAssistedConversionRate,
      ),
    },
    recommendations: {
      sectionNote:
        "Prioritized actions from weekly intelligence — ROI and confidence scoring expand as GSC and path data connect.",
      items: s.recommendationEngine.items.map((item) => ({
        title: item.title,
        rationale: item.rationale,
        priority: item.priority,
        sourceLabel: sourceLabelFromStatus("intel", item.status),
        roiScore:
          item.roiScore != null ? String(item.roiScore) : undefined,
        confidence:
          item.confidenceScore != null
            ? `${Math.round(item.confidenceScore * 100)}%`
            : undefined,
        actionType: item.actionType,
      })),
    },
    ledger: {
      sectionNote:
        "Macro tone from weekly intelligence narrative — Ledger index feeds not yet wired.",
      currentEnvironment: s.ledger.currentEnvironment,
      messagingGuidance: s.ledger.messagingGuidance,
      consumerSentiment: s.ledger.consumerSentiment,
    },
  };
}
