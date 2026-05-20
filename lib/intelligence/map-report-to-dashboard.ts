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
  ga4PendingMetric,
  gmbNotConnected,
  PLACEHOLDER_DASHBOARD_DATA,
  STATIC_GOOGLE_REVIEWS,
  SUBSCRIBERS_NOT_CONNECTED,
} from "./dashboard-data";
import type { WeeklyReportRecord } from "./types";

function metric(
  value: string,
  trendLine: string,
  status?: MetricStatus,
  sourceLabel = "GA4",
): ExecutiveDashboardData["businessPulse"]["weeklyTraffic"] {
  return { value, trendLine, status, sourceLabel };
}

export function mapReportToDashboard(
  report: WeeklyReportRecord,
): ExecutiveDashboardData {
  const ga4 = report.raw_payload;
  const cur = ga4?.current;
  const prev = ga4?.previous;
  if (!cur || !prev) return PLACEHOLDER_DASHBOARD_DATA;

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

  const topPages = cur.landingPages.slice(0, 3);
  const growing = topPages.map((p, i) => {
    const prevPage = prev.landingPages.find((x) => x.value === p.value);
    const d = prevPage
      ? deltaPercentage(p.sessions, prevPage.sessions)
      : null;
    const status = semanticStatus(d);
    return {
      title: p.value,
      note: `GA4 · ${formatDeltaLine(d)}${i === 0 && status === "Accelerating" ? ` · ${status}` : ""}`,
    };
  });

  const insightSentence =
    report.executive_summary.split(".")[0]?.trim() ||
    PLACEHOLDER_DASHBOARD_DATA.weeklySignal.insight;

  return {
    weeklySignal: {
      status: semanticStatus(studioDelta) as MetricStatus,
      insight: insightSentence.endsWith(".") ? insightSentence : `${insightSentence}.`,
      note:
        report.recommendations[0] ??
        PLACEHOLDER_DASHBOARD_DATA.weeklySignal.note,
    },
    businessPulse: {
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
    },
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
    },
    content: {
      sectionNote: report.landing_page_summary.split("\n")[0]
        ? "Landing paths below reflect GA4 session entry for the week."
        : PLACEHOLDER_DASHBOARD_DATA.content.sectionNote,
      topArticles: topPages.map((p) => ({
        title: p.value.replace(/^\//, "").replace(/-/g, " ") || p.value,
        note: `GA4 · ${formatInteger(p.sessions)} sessions`,
      })),
      fastestGrowingPages:
        growing.length > 0
          ? growing
          : PLACEHOLDER_DASHBOARD_DATA.content.fastestGrowingPages,
      pagesToUpgrade:
        report.problems.length > 0
          ? report.problems.slice(0, 3).map((p) => ({
              title: "Review item",
              note: `Intelligence · ${p}`,
            }))
          : PLACEHOLDER_DASHBOARD_DATA.content.pagesToUpgrade,
    },
    localAuthority: {
      sectionNote:
        "Google rating at 5.0 / 5 stars (verified). Direction, calls, and profile metrics await Google Business Profile API.",
      googleReviews: STATIC_GOOGLE_REVIEWS,
      directionRequests: gmbNotConnected("Direction requests"),
      calls: gmbNotConnected("Calls"),
      gmbEngagement: gmbNotConnected("Profile engagement"),
    },
    ledger: {
      ...PLACEHOLDER_DASHBOARD_DATA.ledger,
      sectionNote:
        "Macro tone from weekly intelligence narrative — Ledger index feeds not yet wired.",
    },
  };
}
