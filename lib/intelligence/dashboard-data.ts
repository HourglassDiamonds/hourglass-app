/** Data shape powering /executive-dashboard (matches existing UI components). */

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
    sourceLabel: "Not connected",
  };
}

export function ga4PendingMetric(detail: string): MetricField {
  return {
    value: "—",
    trendLine: detail,
    sourceLabel: "GA4 pending",
  };
}

export function scaffoldMetric(sample: string, note: string): MetricField {
  return {
    value: sample,
    trendLine: note,
    sourceLabel: "Illustrative",
  };
}

export type ExecutiveDashboardData = {
  weeklySignal: {
    status: MetricStatus;
    insight: string;
    note: string;
  };
  businessPulse: {
    sectionNote: string;
    weeklyTraffic: MetricField;
    subscribers: MetricField;
    conciergeInquiries: MetricField;
    consultationConversion: MetricField;
    returningVisitors: MetricField;
  };
  diamondStudio: {
    sectionNote: string;
    mostSelectedShape: MetricField;
    fastestGrowingShape: MetricField;
    avgCaratCluster: MetricField;
    mostCommonCoverageZone: MetricField;
    mobileVsDesktop: MetricField;
    eastWestInterest: MetricField;
  };
  content: {
    sectionNote: string;
    topArticles: { title: string; note: string }[];
    fastestGrowingPages: { title: string; note: string }[];
    pagesToUpgrade: { title: string; note: string }[];
  };
  localAuthority: {
    sectionNote: string;
    googleReviews: MetricField;
    directionRequests: MetricField;
    calls: MetricField;
    gmbEngagement: MetricField;
  };
  ledger: {
    sectionNote: string;
    currentEnvironment: string;
    messagingGuidance: string;
    consumerSentiment: string;
  };
};

/** Fallback when no weekly report exists in Supabase. */
export const PLACEHOLDER_DASHBOARD_DATA: ExecutiveDashboardData = {
  weeklySignal: {
    status: "Watch",
    insight:
      "No weekly intelligence report loaded — run the GA4 pipeline to populate this panel.",
    note: "Illustrative scaffold only. Live copy is generated from the latest Supabase weekly report.",
  },
  businessPulse: {
    sectionNote:
      "Illustrative layout only — run the weekly intelligence job for live GA4 traffic and studio metrics.",
    weeklyTraffic: scaffoldMetric("—", "GA4 weekly report not loaded"),
    subscribers: SUBSCRIBERS_NOT_CONNECTED,
    conciergeInquiries: scaffoldMetric("—", "Studio CTA clicks · GA4"),
    consultationConversion: scaffoldMetric("—", "CTA / studio views · GA4"),
    returningVisitors: scaffoldMetric("—", "Engagement rate · GA4"),
  },
  diamondStudio: {
    sectionNote:
      "Illustrative layout — shape and device metrics populate from GA4 when a weekly report exists.",
    mostSelectedShape: scaffoldMetric("—", "Top shape · GA4 events"),
    fastestGrowingShape: scaffoldMetric("—", "Week-over-week shape depth · GA4"),
    avgCaratCluster: ga4PendingMetric("Carat cluster not yet mapped in GA4"),
    mostCommonCoverageZone: ga4PendingMetric("Coverage zone not yet mapped in GA4"),
    mobileVsDesktop: scaffoldMetric("—", "Device split · GA4 sessions"),
    eastWestInterest: scaffoldMetric("—", "Orientation events · GA4"),
  },
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
      "Google rating shown at 5.0 / 5 stars (verified). Direction, calls, and profile metrics await Google Business Profile API.",
    googleReviews: STATIC_GOOGLE_REVIEWS,
    directionRequests: gmbNotConnected("Direction requests"),
    calls: gmbNotConnected("Calls"),
    gmbEngagement: gmbNotConnected("Profile engagement"),
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
