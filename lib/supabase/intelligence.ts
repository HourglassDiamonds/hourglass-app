import type {
  ContentOpportunityInput,
  IntelligenceRawPayload,
  MetricSnapshotInput,
  RecommendationInput,
  WeeklyReportRecord,
  WeeklyReportSections,
} from "@/lib/intelligence/types";
import { getSupabaseAdmin, isSupabaseConfigured } from "./client";

type SaveWeeklyReportInput = {
  reportDate: string;
  weekStart: string;
  weekEnd: string;
  sections: WeeklyReportSections;
  rawPayload: IntelligenceRawPayload;
  snapshots: MetricSnapshotInput[];
  recommendations: RecommendationInput[];
  contentOpportunities: ContentOpportunityInput[];
};

export async function saveWeeklyReport(
  input: SaveWeeklyReportInput,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const { data: report, error: reportError } = await supabase
    .from("weekly_reports")
    .insert({
      report_date: input.reportDate,
      week_start: input.weekStart,
      week_end: input.weekEnd,
      executive_summary: input.sections.executive_summary,
      traffic_summary: input.sections.traffic_summary,
      diamond_studio_summary: input.sections.diamond_studio_summary,
      landing_page_summary: input.sections.landing_page_summary,
      opportunities: input.sections.opportunities,
      problems: input.sections.problems,
      recommendations: input.sections.recommendations,
      raw_payload: input.rawPayload,
    })
    .select("id")
    .single();

  if (reportError || !report) {
    throw new Error(reportError?.message ?? "Failed to save weekly report");
  }

  const reportId = report.id as string;

  if (input.snapshots.length) {
    const { error: snapError } = await supabase.from("metric_snapshots").insert(
      input.snapshots.map((s) => ({
        report_id: reportId,
        source: s.source,
        metric_name: s.metric_name,
        metric_value: s.metric_value,
        comparison_value: s.comparison_value,
        delta_percentage: s.delta_percentage,
        dimension: s.dimension,
        dimension_value: s.dimension_value,
        snapshot_date: s.snapshot_date,
      })),
    );
    if (snapError) throw new Error(snapError.message);
  }

  if (input.recommendations.length) {
    const { error: recError } = await supabase.from("recommendations").insert(
      input.recommendations.map((r) => ({
        report_id: reportId,
        category: r.category,
        recommendation: r.recommendation,
        priority: r.priority,
        source_signal: r.source_signal,
      })),
    );
    if (recError) throw new Error(recError.message);
  }

  if (input.contentOpportunities.length) {
    const { error: coError } = await supabase.from("content_opportunities").insert(
      input.contentOpportunities.map((c) => ({
        report_id: reportId,
        page: c.page,
        query: c.query,
        opportunity_type: c.opportunity_type,
        recommendation: c.recommendation,
        priority: c.priority,
      })),
    );
    if (coError) throw new Error(coError.message);
  }

  return reportId;
}

export async function getLatestWeeklyReport(): Promise<WeeklyReportRecord | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("weekly_reports")
    .select("*")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    report_date: data.report_date,
    week_start: data.week_start,
    week_end: data.week_end,
    executive_summary: data.executive_summary,
    traffic_summary: data.traffic_summary,
    diamond_studio_summary: data.diamond_studio_summary,
    landing_page_summary: data.landing_page_summary,
    opportunities: (data.opportunities as string[]) ?? [],
    problems: (data.problems as string[]) ?? [],
    recommendations: (data.recommendations as string[]) ?? [],
    raw_payload: data.raw_payload as WeeklyReportRecord["raw_payload"],
    created_at: data.created_at,
  };
}
