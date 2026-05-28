import {
  capitalizeShape,
  deltaPercentage,
  formatDeltaLine,
  formatInteger,
  formatPercent,
  semanticStatus,
} from "./compare";
import type { ExecutiveDashboardData, MetricStatus } from "./dashboard-data";
import {
  displayFromSnapshot,
  ga4PendingMetric,
  gmbNotConnected,
  PLACEHOLDER_DASHBOARD_DATA,
  STATIC_GOOGLE_REVIEWS,
  SUBSCRIBERS_NOT_CONNECTED,
  type ExecutiveDashboardPayload,
} from "./dashboard-data";
import { buildDashboardSnapshot } from "./dashboard-snapshot";
import type { WeeklyReportRecord } from "./types";

function metric(
  value: string,
  trendLine: string,
  status?: MetricStatus,
  sourceLabel = "GA4",
): ExecutiveDashboardData["consultationFunnel"]["weeklyTraffic"] {
  return { value, trendLine, status, sourceLabel };
}

/**
 * Legacy mapper — enriches snapshot display with GA4-derived status labels
 * where the generic snapshot mapper uses simpler formatting.
 */
function enrichLiveDisplay(
  display: ExecutiveDashboardData,
  report: WeeklyReportRecord,
): ExecutiveDashboardData {
  const ga4 = report.raw_payload;
  const cur = ga4?.current;
  const prev = ga4?.previous;
  if (!cur || !prev) return display;

  const sessionsDelta = deltaPercentage(
    cur.traffic.sessions,
    prev.traffic.sessions,
  );
  const engagementDelta = deltaPercentage(
    cur.traffic.engagementRate,
    prev.traffic.engagementRate,
  );
  const studioDelta = deltaPercentage(cur.studioViews, prev.studioViews);
  const ctaDelta = deltaPercentage(
    cur.consultationCtaClicks,
    prev.consultationCtaClicks,
  );

  const topShape = cur.topShapes[0]?.shape ?? "oval";
  const secondShape = cur.topShapes[1]?.shape;
  const shapeDelta =
    cur.topShapes[0] && prev.topShapes[0]
      ? deltaPercentage(cur.topShapes[0].eventCount, prev.topShapes[0].eventCount)
      : null;

  const mobile = cur.devices.find((d) => d.value.toLowerCase() === "mobile");
  const desktop = cur.devices.find((d) => d.value.toLowerCase() === "desktop");
  const totalDevice = (mobile?.sessions ?? 0) + (desktop?.sessions ?? 0);
  const mobilePct = totalDevice
    ? Math.round(((mobile?.sessions ?? 0) / totalDevice) * 100)
    : 0;

  const ctaRate =
    cur.studioViews > 0
      ? (cur.consultationCtaClicks / cur.studioViews) * 100
      : 0;
  const prevCtaRate =
    prev.studioViews > 0
      ? (prev.consultationCtaClicks / prev.studioViews) * 100
      : 0;
  const ctaRateDelta = deltaPercentage(ctaRate, prevCtaRate);

  const funnel = {
    sectionNote: report.traffic_summary.split(".")[0] + ".",
    weeklyTraffic: metric(
      formatInteger(cur.traffic.sessions),
      formatDeltaLine(sessionsDelta),
      semanticStatus(sessionsDelta) as MetricStatus,
    ),
    subscribers: SUBSCRIBERS_NOT_CONNECTED,
    conciergeInquiries: metric(
      formatInteger(cur.consultationCtaClicks),
      `Consultation CTA clicks · ${formatDeltaLine(ctaDelta)}`,
      semanticStatus(ctaDelta) as MetricStatus,
    ),
    consultationConversion: metric(
      `${Math.round(ctaRate * 10) / 10}%`,
      `CTA / studio views · ${formatDeltaLine(ctaRateDelta)}`,
      semanticStatus(ctaRateDelta) as MetricStatus,
    ),
    returningVisitors: metric(
      formatPercent(cur.traffic.engagementRate),
      `Engaged session rate · ${formatDeltaLine(engagementDelta)}`,
      semanticStatus(engagementDelta) as MetricStatus,
    ),
  };

  const insightSentence =
    report.executive_summary.split(".")[0]?.trim() ||
    PLACEHOLDER_DASHBOARD_DATA.weeklySignal.insight;

  return {
    ...display,
    weeklySignal: {
      status: semanticStatus(studioDelta) as MetricStatus,
      insight: insightSentence.endsWith(".") ? insightSentence : `${insightSentence}.`,
      note:
        report.recommendations[0] ??
        PLACEHOLDER_DASHBOARD_DATA.weeklySignal.note,
    },
    consultationFunnel: funnel,
    businessPulse: funnel,
    diamondStudio: {
      sectionNote: report.diamond_studio_summary.split(".")[0] + ".",
      mostSelectedShape: metric(
        capitalizeShape(topShape),
        "Most session depth",
        "Stable",
      ),
      fastestGrowingShape: metric(
        secondShape ? capitalizeShape(secondShape) : "—",
        formatDeltaLine(shapeDelta),
        semanticStatus(shapeDelta) as MetricStatus,
      ),
      avgCaratCluster: ga4PendingMetric("Carat cluster not yet mapped in GA4"),
      mostCommonCoverageZone: ga4PendingMetric(
        "Coverage zone not yet mapped in GA4",
      ),
      mobileVsDesktop: metric(
        `${mobilePct}% / ${100 - mobilePct}%`,
        "Mobile-led exploration",
        "Stable",
      ),
      eastWestInterest: metric(
        (cur.studioEvents.orientation_changed ?? 0) >
        (prev.studioEvents.orientation_changed ?? 0)
          ? "Rising"
          : "Stable",
        `Orientation events ${formatInteger(cur.studioEvents.orientation_changed ?? 0)}`,
        "Emerging",
      ),
      studioVisits: metric(
        formatInteger(cur.studioViews),
        formatDeltaLine(studioDelta),
        semanticStatus(studioDelta) as MetricStatus,
      ),
      returnUsage: display.diamondStudio.returnUsage,
      sessionDepth: display.diamondStudio.sessionDepth,
      highIntentSessions: display.diamondStudio.highIntentSessions,
      repeatUsers7d: display.diamondStudio.repeatUsers7d,
      ctaPathing: display.diamondStudio.ctaPathing,
    },
    localAuthority: {
      ...display.localAuthority,
      googleReviews: STATIC_GOOGLE_REVIEWS,
      directionRequests: gmbNotConnected("Direction requests"),
      calls: gmbNotConnected("Calls"),
    },
  };
}

export function buildExecutiveDashboardPayload(
  report: WeeklyReportRecord | null,
  weekLabel?: string,
): ExecutiveDashboardPayload {
  const ga4 = report?.raw_payload ?? null;
  const gsc = report?.raw_payload?.gsc ?? null;
  const snapshot =
    report?.raw_payload?.dashboardSnapshot ??
    buildDashboardSnapshot(report, ga4, gsc);
  const baseDisplay = displayFromSnapshot(snapshot, report);
  const display = report
    ? enrichLiveDisplay(baseDisplay, report)
    : PLACEHOLDER_DASHBOARD_DATA;

  return {
    snapshot,
    display,
    isLive: Boolean(report && ga4?.current),
    weekLabel,
  };
}

/** @deprecated Prefer buildExecutiveDashboardPayload */
export function mapReportToDashboard(
  report: WeeklyReportRecord,
): ExecutiveDashboardData {
  return buildExecutiveDashboardPayload(report).display;
}
