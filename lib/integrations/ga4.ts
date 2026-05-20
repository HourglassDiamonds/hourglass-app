import { BetaAnalyticsDataClient } from "@google-analytics/data";
import type {
  Ga4DimensionRow,
  Ga4PeriodBundle,
  Ga4ShapeRow,
  Ga4StudioEventCounts,
  Ga4TrafficMetrics,
  Ga4WeeklyBundle,
  WeekRange,
} from "@/lib/intelligence/types";
import {
  Ga4OAuthError,
  ga4PropertyResourceName,
  getGa4AuthClient,
  isGa4OAuthConfigured,
  mapGa4ApiError,
} from "@/lib/intelligence/google-oauth";

const STUDIO_EVENTS = [
  "diamond_studio_view",
  "carat_changed",
  "finger_size_changed",
  "shape_selected",
  "skin_tone_selected",
  "orientation_changed",
  "coverage_zone_changed",
  "consultation_cta_clicked",
  "studio_session_engaged",
  "home_clicked",
] as const;

let client: BetaAnalyticsDataClient | null = null;

async function getClient(): Promise<BetaAnalyticsDataClient> {
  if (client) return client;
  const auth = await getGa4AuthClient();
  client = new BetaAnalyticsDataClient({ authClient: auth });
  return client;
}

function propertyName(): string {
  return ga4PropertyResourceName();
}

function dateRange(week: WeekRange) {
  return { startDate: week.start, endDate: week.end };
}

function parseMetric(
  row: { metricValues?: { value?: string | null }[] | null } | undefined,
  index: number,
): number {
  const raw = row?.metricValues?.[index]?.value;
  if (raw === undefined || raw === null || raw === "") return 0;
  return Number(raw);
}

async function runReport(params: {
  dimensions: string[];
  metrics: string[];
  week: WeekRange;
  dimensionFilter?: object;
  limit?: number;
}) {
  try {
    const ga = await getClient();
    const [response] = await ga.runReport({
      property: propertyName(),
      dateRanges: [dateRange(params.week)],
      dimensions: params.dimensions.map((name) => ({ name })),
      metrics: params.metrics.map((name) => ({ name })),
      dimensionFilter: params.dimensionFilter,
      limit: params.limit ?? 50,
    });
    return response.rows ?? [];
  } catch (err) {
    if (err instanceof Ga4OAuthError) throw err;
    throw mapGa4ApiError(err);
  }
}

async function fetchTraffic(week: WeekRange): Promise<Ga4TrafficMetrics> {
  try {
    const ga = await getClient();
    const [response] = await ga.runReport({
      property: propertyName(),
      dateRanges: [dateRange(week)],
      metrics: [
        { name: "sessions" },
        { name: "engagedSessions" },
        { name: "engagementRate" },
      ],
    });
    const row = response.rows?.[0];
    return {
      sessions: parseMetric(row, 0),
      engagedSessions: parseMetric(row, 1),
      engagementRate: parseMetric(row, 2),
    };
  } catch (err) {
    if (err instanceof Ga4OAuthError) throw err;
    throw mapGa4ApiError(err);
  }
}

async function fetchByDimension(
  week: WeekRange,
  dimension: string,
  limit = 12,
): Promise<Ga4DimensionRow[]> {
  const rows = await runReport({
    dimensions: [dimension],
    metrics: ["sessions"],
    week,
    limit,
  });
  return rows
    .map((row) => ({
      dimension,
      value: row.dimensionValues?.[0]?.value ?? "(not set)",
      sessions: parseMetric(row, 0),
    }))
    .filter((r) => r.value && r.sessions > 0)
    .sort((a, b) => b.sessions - a.sessions);
}

async function fetchStudioEvents(week: WeekRange): Promise<Ga4StudioEventCounts> {
  const rows = await runReport({
    dimensions: ["eventName"],
    metrics: ["eventCount"],
    week,
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        inListFilter: { values: [...STUDIO_EVENTS] },
      },
    },
    limit: 20,
  });

  const counts: Ga4StudioEventCounts = {};
  for (const row of rows) {
    const name = row.dimensionValues?.[0]?.value ?? "";
    counts[name] = parseMetric(row, 0);
  }
  return counts;
}

async function fetchTopShapes(week: WeekRange): Promise<Ga4ShapeRow[]> {
  try {
    const rows = await runReport({
      dimensions: ["customEvent:shape"],
      metrics: ["eventCount"],
      week,
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          stringFilter: { value: "shape_selected" },
        },
      },
      limit: 12,
    });
    return rows
      .map((row) => ({
        shape: row.dimensionValues?.[0]?.value ?? "",
        eventCount: parseMetric(row, 0),
      }))
      .filter((r) => r.shape && r.eventCount > 0)
      .sort((a, b) => b.eventCount - a.eventCount);
  } catch {
    return [];
  }
}

async function fetchPeriod(week: WeekRange): Promise<Ga4PeriodBundle> {
  const [traffic, sources, landingPages, devices, studioEvents, topShapes] =
    await Promise.all([
      fetchTraffic(week),
      fetchByDimension(week, "sessionDefaultChannelGroup", 10),
      fetchByDimension(week, "landingPagePlusQueryString", 15),
      fetchByDimension(week, "deviceCategory", 5),
      fetchStudioEvents(week),
      fetchTopShapes(week),
    ]);

  return {
    traffic,
    sources,
    landingPages,
    devices,
    studioEvents,
    topShapes,
    consultationCtaClicks: studioEvents.consultation_cta_clicked ?? 0,
    studioViews: studioEvents.diamond_studio_view ?? 0,
  };
}

export async function fetchGa4WeeklyBundle(
  currentWeek: WeekRange,
  previousWeek: WeekRange,
): Promise<Ga4WeeklyBundle> {
  const [current, previous] = await Promise.all([
    fetchPeriod(currentWeek),
    fetchPeriod(previousWeek),
  ]);
  return {
    current,
    previous,
    fetchedAt: new Date().toISOString(),
  };
}

export function isGa4Configured(): boolean {
  return isGa4OAuthConfigured();
}
