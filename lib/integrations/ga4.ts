import { BetaAnalyticsDataClient } from "@google-analytics/data";
import type {
  Ga4DimensionRow,
  Ga4PeriodBundle,
  Ga4ShapeRow,
  Ga4SourceMediumRow,
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
import {
  getAgentOsMeasurementWindows,
  MEASUREMENT_TIMEZONE,
} from "@/lib/agent-os/measurement/date-windows";

/**
 * Live GA4 Data API event allowlist — repository-backed emitters only.
 * Keep in sync with lib/agent-os/bi/expected-events.ts GA4_ADAPTER_QUERIED_EVENTS.
 */
export const GA4_LIVE_QUERIED_EVENTS = [
  // Diamond Studio
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
  // Concierge / conversion
  "concierge_form_started",
  "concierge_form_submitted",
  "generate_lead",
  // Conversations
  "conversation_video_started",
  "conversation_video_progress",
  "conversation_video_completed",
  "conversation_related_resource_clicked",
  "conversation_concierge_clicked",
] as const;

/** @deprecated Use GA4_LIVE_QUERIED_EVENTS — kept for older Studio-only references. */
export const STUDIO_EVENTS = GA4_LIVE_QUERIED_EVENTS;

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
        { name: "activeUsers" },
        { name: "newUsers" },
      ],
    });
    const row = response.rows?.[0];
    return {
      sessions: parseMetric(row, 0),
      engagedSessions: parseMetric(row, 1),
      engagementRate: parseMetric(row, 2),
      activeUsers: parseMetric(row, 3),
      newUsers: parseMetric(row, 4),
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

async function fetchSourceMedium(
  week: WeekRange,
  limit = 25,
): Promise<Ga4SourceMediumRow[]> {
  try {
    const rows = await runReport({
      dimensions: ["sessionSource", "sessionMedium"],
      metrics: ["sessions"],
      week,
      limit,
    });
    return rows
      .map((row) => ({
        source: row.dimensionValues?.[0]?.value ?? "(not set)",
        medium: row.dimensionValues?.[1]?.value ?? "(not set)",
        sessions: parseMetric(row, 0),
      }))
      .filter((r) => r.sessions > 0)
      .sort((a, b) => b.sessions - a.sessions);
  } catch {
    // Dimension availability can vary by property — degrade honestly.
    return [];
  }
}

async function fetchQueriedEvents(week: WeekRange): Promise<Ga4StudioEventCounts> {
  const rows = await runReport({
    dimensions: ["eventName"],
    metrics: ["eventCount"],
    week,
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        inListFilter: { values: [...GA4_LIVE_QUERIED_EVENTS] },
      },
    },
    limit: GA4_LIVE_QUERIED_EVENTS.length + 5,
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
  const [
    traffic,
    sources,
    landingPages,
    devices,
    studioEvents,
    topShapes,
    sourceMediumRows,
  ] = await Promise.all([
    fetchTraffic(week),
    fetchByDimension(week, "sessionDefaultChannelGroup", 10),
    fetchByDimension(week, "landingPagePlusQueryString", 15),
    fetchByDimension(week, "deviceCategory", 5),
    fetchQueriedEvents(week),
    fetchTopShapes(week),
    fetchSourceMedium(week, 25),
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
    sourceMediumRows,
    generateLeadCount: studioEvents.generate_lead ?? 0,
    conciergeFormStarted: studioEvents.concierge_form_started ?? 0,
    conciergeFormSubmitted: studioEvents.concierge_form_submitted ?? 0,
  };
}

async function fetchLightPeriod(
  week: WeekRange,
): Promise<Pick<Ga4PeriodBundle, "traffic" | "studioEvents">> {
  const [traffic, studioEvents] = await Promise.all([
    fetchTraffic(week),
    fetchQueriedEvents(week),
  ]);
  return { traffic, studioEvents };
}

/**
 * Weekly Mon–Sun (or caller-supplied) bundle for the intelligence pipeline.
 * Preserved for weekly-report consumers.
 */
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
    windowMeta: {
      timezone: "UTC",
      windowKind: "calendar-week-utc",
      currentRange: currentWeek,
      previousRange: previousWeek,
    },
  };
}

/**
 * Agent OS live GA4 pull — America/New_York completed 7d + day-over-day + 28d baseline.
 */
export async function fetchGa4AgentOsBundle(
  asOf: Date = new Date(),
): Promise<Ga4WeeklyBundle> {
  const windows = getAgentOsMeasurementWindows(asOf);
  const [current, previous, dailyCurrent, dailyPrevious, baselineTraffic] =
    await Promise.all([
      fetchPeriod(windows.rolling7d),
      fetchPeriod(windows.prior7d),
      fetchLightPeriod(windows.mostRecentCompleteDay),
      fetchLightPeriod(windows.priorCompleteDay),
      fetchTraffic(windows.baseline28d),
    ]);

  return {
    current,
    previous,
    fetchedAt: new Date().toISOString(),
    windowMeta: {
      timezone: MEASUREMENT_TIMEZONE,
      windowKind: "completed-7d-et",
      currentRange: windows.rolling7d,
      previousRange: windows.prior7d,
      mostRecentCompleteDay: windows.mostRecentCompleteDay,
      priorCompleteDay: windows.priorCompleteDay,
      baseline28dRange: windows.baseline28d,
    },
    daily: {
      current: dailyCurrent,
      previous: dailyPrevious,
      currentRange: windows.mostRecentCompleteDay,
      previousRange: windows.priorCompleteDay,
    },
    baseline28d: {
      traffic: baselineTraffic,
      range: windows.baseline28d,
    },
  };
}

export function isGa4Configured(): boolean {
  return isGa4OAuthConfigured();
}

/** Row/metric counts for smoke/preflight — no secrets. */
export function summarizeGa4Bundle(bundle: Ga4WeeklyBundle): {
  sessionsCurrent: number;
  sessionsPrevious: number;
  eventNamesWithVolume: number;
  channelRows: number;
  landingPageRows: number;
  sourceMediumRows: number;
  generateLeadCurrent: number;
  windowKind: string | null;
  currentRange: WeekRange | null;
  previousRange: WeekRange | null;
} {
  return {
    sessionsCurrent: bundle.current.traffic.sessions,
    sessionsPrevious: bundle.previous.traffic.sessions,
    eventNamesWithVolume: Object.values(bundle.current.studioEvents).filter(
      (n) => n > 0,
    ).length,
    channelRows: bundle.current.sources.length,
    landingPageRows: bundle.current.landingPages.length,
    sourceMediumRows: bundle.current.sourceMediumRows?.length ?? 0,
    generateLeadCurrent: bundle.current.generateLeadCount ?? 0,
    windowKind: bundle.windowMeta?.windowKind ?? null,
    currentRange: bundle.windowMeta?.currentRange ?? null,
    previousRange: bundle.windowMeta?.previousRange ?? null,
  };
}
