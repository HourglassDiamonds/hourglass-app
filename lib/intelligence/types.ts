/** Shared types for the Hourglass Intelligence Engine (V1). */

export type WeekRange = {
  start: string; // YYYY-MM-DD
  end: string;
};

export type Ga4TrafficMetrics = {
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  /** Present when the Data API request includes activeUsers. */
  activeUsers?: number;
  /** Present when the Data API request includes newUsers. */
  newUsers?: number;
};

export type Ga4DimensionRow = {
  dimension: string;
  value: string;
  sessions: number;
  eventCount?: number;
};

export type Ga4SourceMediumRow = {
  source: string;
  medium: string;
  sessions: number;
};

export type Ga4StudioEventCounts = Record<string, number>;

export type Ga4ShapeRow = {
  shape: string;
  eventCount: number;
};

export type Ga4PeriodBundle = {
  traffic: Ga4TrafficMetrics;
  /** sessionDefaultChannelGroup rows */
  sources: Ga4DimensionRow[];
  landingPages: Ga4DimensionRow[];
  devices: Ga4DimensionRow[];
  /** Queried event allowlist counts (Studio + Concierge + Conversations when expanded). */
  studioEvents: Ga4StudioEventCounts;
  topShapes: Ga4ShapeRow[];
  consultationCtaClicks: number;
  studioViews: number;
  /** sessionSource / sessionMedium rows when fetched. */
  sourceMediumRows?: Ga4SourceMediumRow[];
  /** generate_lead count when queried. */
  generateLeadCount?: number;
  conciergeFormStarted?: number;
  conciergeFormSubmitted?: number;
};

export type Ga4BundleWindowMeta = {
  timezone: string;
  windowKind: "completed-7d-et" | "calendar-week-utc";
  currentRange: WeekRange;
  previousRange: WeekRange;
  mostRecentCompleteDay?: WeekRange;
  priorCompleteDay?: WeekRange;
  baseline28dRange?: WeekRange;
};

export type Ga4WeeklyBundle = {
  current: Ga4PeriodBundle;
  previous: Ga4PeriodBundle;
  fetchedAt: string;
  /** Optional Agent OS window metadata (weekly intelligence may omit). */
  windowMeta?: Ga4BundleWindowMeta;
  /** Lightweight day-over-day traffic when fetched for Agent OS. */
  daily?: {
    current: Pick<Ga4PeriodBundle, "traffic" | "studioEvents">;
    previous: Pick<Ga4PeriodBundle, "traffic" | "studioEvents">;
    currentRange: WeekRange;
    previousRange: WeekRange;
  };
  /** Optional 28-day traffic baseline. */
  baseline28d?: {
    traffic: Ga4TrafficMetrics;
    range: WeekRange;
  };
};

/** Weekly ingestion payload stored in Supabase `weekly_reports.raw_payload`. */
export type IntelligenceRawPayload = Ga4WeeklyBundle & {
  gsc?: import("@/lib/integrations/gsc").GscWeeklyBundle;
  dashboardSnapshot?: import("./dashboard-snapshot").DashboardIntelligenceSnapshot;
};

export type MetricSnapshotInput = {
  source: string;
  metric_name: string;
  metric_value: number;
  comparison_value: number | null;
  delta_percentage: number | null;
  dimension: string | null;
  dimension_value: string | null;
  snapshot_date: string;
};

export type RecommendationInput = {
  category: string;
  recommendation: string;
  priority: "high" | "medium" | "low";
  source_signal: string;
};

/** Future scored recommendations (dashboard + weekly email). */
export type ScoredRecommendationInput = RecommendationInput & {
  roi_score?: number | null;
  confidence_score?: number | null;
  urgency?: "critical" | "high" | "medium" | "low";
  action_type?: string;
};

export type ContentOpportunityInput = {
  page: string;
  query: string | null;
  opportunity_type: string;
  recommendation: string;
  priority: "high" | "medium" | "low";
};

export type WeeklyReportSections = {
  executive_summary: string;
  traffic_summary: string;
  diamond_studio_summary: string;
  landing_page_summary: string;
  opportunities: string[];
  problems: string[];
  recommendations: string[];
};

export type WeeklyReportRecord = {
  id: string;
  report_date: string;
  week_start: string;
  week_end: string;
  executive_summary: string;
  traffic_summary: string;
  diamond_studio_summary: string;
  landing_page_summary: string;
  opportunities: string[];
  problems: string[];
  recommendations: string[];
  raw_payload: IntelligenceRawPayload & {
    dashboardHints?: Record<string, unknown>;
  };
  created_at: string;
};

export type WeeklyIntelligenceJobResult = {
  ok: boolean;
  reportId?: string;
  weekStart: string;
  weekEnd: string;
  source: "ga4";
  emailSent: boolean;
  emailSkipped?: boolean;
  warning?: string;
  skipped?: string;
  error?: string;
};
