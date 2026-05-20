/** Shared types for the Hourglass Intelligence Engine (V1). */

export type WeekRange = {
  start: string; // YYYY-MM-DD
  end: string;
};

export type Ga4TrafficMetrics = {
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
};

export type Ga4DimensionRow = {
  dimension: string;
  value: string;
  sessions: number;
  eventCount?: number;
};

export type Ga4StudioEventCounts = Record<string, number>;

export type Ga4ShapeRow = {
  shape: string;
  eventCount: number;
};

export type Ga4PeriodBundle = {
  traffic: Ga4TrafficMetrics;
  sources: Ga4DimensionRow[];
  landingPages: Ga4DimensionRow[];
  devices: Ga4DimensionRow[];
  studioEvents: Ga4StudioEventCounts;
  topShapes: Ga4ShapeRow[];
  consultationCtaClicks: number;
  studioViews: number;
};

export type Ga4WeeklyBundle = {
  current: Ga4PeriodBundle;
  previous: Ga4PeriodBundle;
  fetchedAt: string;
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
  raw_payload: Ga4WeeklyBundle & {
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
