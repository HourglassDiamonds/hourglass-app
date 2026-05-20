import {
  capitalizeShape,
  deltaPercentage,
  formatDeltaLine,
  formatInteger,
  formatPercent,
  semanticStatus,
} from "./compare";
import type {
  ContentOpportunityInput,
  Ga4WeeklyBundle,
  MetricSnapshotInput,
  RecommendationInput,
  WeeklyReportSections,
} from "./types";

function topChannel(bundle: Ga4WeeklyBundle): string {
  return bundle.current.sources[0]?.value ?? "direct";
}

function mobileShare(bundle: Ga4WeeklyBundle): number {
  const mobile = bundle.current.devices.find(
    (d) => d.value.toLowerCase() === "mobile",
  );
  const total = bundle.current.devices.reduce((s, d) => s + d.sessions, 0);
  if (!total) return 0;
  return (mobile?.sessions ?? 0) / total;
}

export function buildRecommendationsAndSignals(
  ga4: Ga4WeeklyBundle,
): {
  recommendations: RecommendationInput[];
  opportunities: string[];
  problems: string[];
  snapshots: MetricSnapshotInput[];
  sections: WeeklyReportSections;
} {
  const sessionsDelta = deltaPercentage(
    ga4.current.traffic.sessions,
    ga4.previous.traffic.sessions,
  );
  const engagementDelta = deltaPercentage(
    ga4.current.traffic.engagementRate,
    ga4.previous.traffic.engagementRate,
  );
  const studioViewsDelta = deltaPercentage(
    ga4.current.studioViews,
    ga4.previous.studioViews,
  );
  const ctaDelta = deltaPercentage(
    ga4.current.consultationCtaClicks,
    ga4.previous.consultationCtaClicks,
  );

  const topShape = ga4.current.topShapes[0]?.shape ?? "oval";
  const prevTopShape = ga4.previous.topShapes[0]?.shape;
  const shapeLeader = capitalizeShape(topShape);
  const mobilePct = Math.round(mobileShare(ga4) * 100);
  const desktopPct = 100 - mobilePct;

  const opportunities: string[] = [];
  const problems: string[] = [];
  const recommendations: RecommendationInput[] = [];

  if (ga4.current.topShapes.length >= 2) {
    const runner = capitalizeShape(ga4.current.topShapes[1]?.shape ?? "");
    opportunities.push(
      `${shapeLeader} continues to lead Studio depth; ${runner} is the fastest secondary exploration path.`,
    );
  } else {
    opportunities.push(
      `${shapeLeader} remains the clearest shape signal in Diamond Studio this week.`,
    );
  }

  const growingPages = ga4.current.landingPages
    .slice(0, 5)
    .filter((p) => p.value.includes("/diamond"));
  if (growingPages[0]) {
    opportunities.push(
      `Landing momentum on ${growingPages[0].value} — reinforce internal links from guides and Studio.`,
    );
  }

  if ((ctaDelta ?? 0) > 5) {
    opportunities.push(
      "Consultation CTA clicks improved — keep editorial inline placement in Studio.",
    );
  }

  if ((sessionsDelta ?? 0) < -10) {
    problems.push(
      `Sessions softened ${formatDeltaLine(sessionsDelta)} — review channel mix (${topChannel(ga4)} leading).`,
    );
  }
  if ((engagementDelta ?? 0) < -5) {
    problems.push(
      "Engagement rate declined — prioritize clarity on high-exit education pages.",
    );
  }
  if (ga4.current.consultationCtaClicks === 0 && ga4.current.studioViews > 20) {
    problems.push(
      "Studio views without consultation CTA clicks — verify GA4 event registration in production.",
    );
  }

  recommendations.push({
    category: "content",
    recommendation:
      "Publish or refresh one proportion-focused guide tied to the leading Studio shape.",
    priority: "high",
    source_signal: `shape:${topShape}`,
  });
  recommendations.push({
    category: "diamond_studio",
    recommendation:
      "Highlight visual reassurance for balanced and statement coverage zones in on-page copy.",
    priority: "medium",
    source_signal: "studio_engagement",
  });
  recommendations.push({
    category: "traffic",
    recommendation: `Review ${topChannel(ga4)} traffic quality and top landing paths for drop-offs.`,
    priority: "medium",
    source_signal: "ga4_traffic",
  });

  const executive_summary = [
    `${shapeLeader} led Diamond Studio interaction${prevTopShape && prevTopShape !== topShape ? ` (prior leader: ${capitalizeShape(prevTopShape)})` : ""}.`,
    `Sessions ${formatDeltaLine(sessionsDelta)} with engagement at ${formatPercent(ga4.current.traffic.engagementRate)} (${formatDeltaLine(engagementDelta, " pts")}).`,
    `Mobile/desktop split held near ${mobilePct}% / ${desktopPct}%.`,
    recommendations[0]?.recommendation ?? "Maintain calm editorial CTAs from Studio to Concierge.",
  ].join(" ");

  const traffic_summary = [
    `Sessions: ${formatInteger(ga4.current.traffic.sessions)} (${formatDeltaLine(sessionsDelta)}).`,
    `Engaged sessions: ${formatInteger(ga4.current.traffic.engagedSessions)}.`,
    `Engagement rate: ${formatPercent(ga4.current.traffic.engagementRate)}.`,
    `Top channel: ${topChannel(ga4)}.`,
  ].join(" ");

  const diamond_studio_summary = [
    `Studio views: ${formatInteger(ga4.current.studioViews)} (${formatDeltaLine(studioViewsDelta)}).`,
    `Consultation CTA clicks: ${formatInteger(ga4.current.consultationCtaClicks)} (${formatDeltaLine(ctaDelta)}).`,
    `Top shape: ${shapeLeader}.`,
    `Orientation & coverage events tracked for engaged sessions.`,
  ].join(" ");

  const landing_page_summary = ga4.current.landingPages
    .slice(0, 5)
    .map((p) => `${p.value} — ${formatInteger(p.sessions)} sessions`)
    .join("\n");

  const sections: WeeklyReportSections = {
    executive_summary,
    traffic_summary,
    diamond_studio_summary,
    landing_page_summary: landing_page_summary || "No landing page data for the period.",
    opportunities,
    problems,
    recommendations: recommendations.map((r) => r.recommendation),
  };

  const snapshots = buildSnapshotInputs(ga4, {
    sessionsDelta,
    engagementDelta,
    studioViewsDelta,
    ctaDelta,
    topShape,
    mobilePct,
    desktopPct,
  });

  return { recommendations, opportunities, problems, snapshots, sections };
}

function buildSnapshotInputs(
  ga4: Ga4WeeklyBundle,
  ctx: {
    sessionsDelta: number | null;
    engagementDelta: number | null;
    studioViewsDelta: number | null;
    ctaDelta: number | null;
    topShape: string;
    mobilePct: number;
    desktopPct: number;
  },
) {
  const date = ga4.current.traffic.sessions ? ga4.fetchedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const base = (metric_name: string, metric_value: number, comparison_value: number, delta: number | null, dimension: string | null = null, dimension_value: string | null = null) => ({
    source: "ga4",
    metric_name,
    metric_value,
    comparison_value,
    delta_percentage: delta,
    dimension,
    dimension_value,
    snapshot_date: date,
  });

  return [
    base("sessions", ga4.current.traffic.sessions, ga4.previous.traffic.sessions, ctx.sessionsDelta),
    base("engaged_sessions", ga4.current.traffic.engagedSessions, ga4.previous.traffic.engagedSessions, deltaPercentage(ga4.current.traffic.engagedSessions, ga4.previous.traffic.engagedSessions)),
    base("engagement_rate", ga4.current.traffic.engagementRate, ga4.previous.traffic.engagementRate, ctx.engagementDelta),
    base("diamond_studio_views", ga4.current.studioViews, ga4.previous.studioViews, ctx.studioViewsDelta),
    base("consultation_cta_clicks", ga4.current.consultationCtaClicks, ga4.previous.consultationCtaClicks, ctx.ctaDelta),
    base("top_shape_events", ga4.current.topShapes[0]?.eventCount ?? 0, ga4.previous.topShapes[0]?.eventCount ?? 0, deltaPercentage(ga4.current.topShapes[0]?.eventCount ?? 0, ga4.previous.topShapes[0]?.eventCount ?? 0), "shape", ctx.topShape),
    base("mobile_session_share", ctx.mobilePct / 100, ctx.desktopPct / 100, null, "device", "mobile"),
  ];
}

export function buildContentOpportunities(
  ga4: Ga4WeeklyBundle,
  reportOpportunities: string[],
): ContentOpportunityInput[] {
  const pages = ga4.current.landingPages.slice(0, 3);
  return pages.map((p, i) => ({
    page: p.value,
    query: null,
    opportunity_type: i === 0 ? "landing_momentum" : "visibility",
    recommendation: reportOpportunities[i] ?? `Review content depth on ${p.value}.`,
    priority: i === 0 ? "high" : "medium",
  }));
}
