import type { Ga4WeeklyBundle } from "@/lib/intelligence/types";
import type { GscWeeklyBundle } from "@/lib/integrations/gsc";
import type { WeeklyReportRecord } from "@/lib/intelligence/types";

/** Deterministic fixture bundle for Agent OS validation — aggregate metrics only. */
export function createFixtureGa4Bundle(
  collectedAt = "2026-07-20T14:00:00.000Z",
): Ga4WeeklyBundle {
  return {
    fetchedAt: collectedAt,
    current: {
      traffic: {
        sessions: 1840,
        engagedSessions: 1120,
        engagementRate: 0.609,
      },
      sources: [
        { dimension: "sessionDefaultChannelGroup", value: "Organic Search", sessions: 620 },
        { dimension: "sessionDefaultChannelGroup", value: "Direct", sessions: 510 },
        { dimension: "sessionDefaultChannelGroup", value: "Organic Social", sessions: 210 },
        { dimension: "sessionDefaultChannelGroup", value: "Referral", sessions: 140 },
      ],
      landingPages: [
        { dimension: "landingPage", value: "/", sessions: 480 },
        { dimension: "landingPage", value: "/diamond-shape-studio", sessions: 390 },
        { dimension: "landingPage", value: "/guides/oval-vs-round", sessions: 180 },
        { dimension: "landingPage", value: "/concierge", sessions: 95 },
      ],
      devices: [
        { dimension: "deviceCategory", value: "mobile", sessions: 1180 },
        { dimension: "deviceCategory", value: "desktop", sessions: 660 },
      ],
      studioEvents: {
        diamond_studio_view: 390,
        shape_selected: 240,
        carat_changed: 180,
        consultation_cta_clicked: 42,
        studio_session_engaged: 160,
      },
      topShapes: [
        { shape: "oval", eventCount: 110 },
        { shape: "round", eventCount: 72 },
        { shape: "emerald", eventCount: 31 },
      ],
      consultationCtaClicks: 42,
      studioViews: 390,
    },
    previous: {
      traffic: {
        sessions: 2110,
        engagedSessions: 1280,
        engagementRate: 0.606,
      },
      sources: [
        { dimension: "sessionDefaultChannelGroup", value: "Organic Search", sessions: 710 },
        { dimension: "sessionDefaultChannelGroup", value: "Direct", sessions: 540 },
        { dimension: "sessionDefaultChannelGroup", value: "Organic Social", sessions: 250 },
        { dimension: "sessionDefaultChannelGroup", value: "Referral", sessions: 160 },
      ],
      landingPages: [
        { dimension: "landingPage", value: "/", sessions: 520 },
        { dimension: "landingPage", value: "/diamond-shape-studio", sessions: 360 },
        { dimension: "landingPage", value: "/guides/oval-vs-round", sessions: 150 },
        { dimension: "landingPage", value: "/concierge", sessions: 110 },
      ],
      devices: [
        { dimension: "deviceCategory", value: "mobile", sessions: 1320 },
        { dimension: "deviceCategory", value: "desktop", sessions: 790 },
      ],
      studioEvents: {
        diamond_studio_view: 360,
        shape_selected: 220,
        carat_changed: 170,
        consultation_cta_clicked: 48,
        studio_session_engaged: 150,
      },
      topShapes: [
        { shape: "oval", eventCount: 98 },
        { shape: "round", eventCount: 80 },
        { shape: "emerald", eventCount: 28 },
      ],
      consultationCtaClicks: 48,
      studioViews: 360,
    },
  };
}

export function createFixtureGscBundle(
  collectedAt = "2026-07-20T14:05:00.000Z",
): GscWeeklyBundle {
  return {
    status: "live",
    siteUrl: "https://www.hourglassdiamonds.com/",
    fetchedAt: collectedAt,
    current: {
      totals: {
        impressions: 18200,
        clicks: 640,
        ctr: 0.0352,
        position: 18.4,
      },
      topQueries: [
        {
          query: "hourglass diamonds",
          impressions: 920,
          clicks: 110,
          ctr: 0.12,
          position: 3.2,
        },
        {
          // high-impression / low-CTR non-brand
          query: "oval engagement ring",
          impressions: 2400,
          clicks: 48,
          ctr: 0.02,
          position: 22.1,
        },
        {
          // near page one (positions 4–15)
          query: "lab grown vs natural diamonds",
          impressions: 860,
          clicks: 42,
          ctr: 0.049,
          position: 8.4,
        },
        {
          // local intent
          query: "custom engagement rings charlotte",
          impressions: 320,
          clicks: 18,
          ctr: 0.056,
          position: 11.2,
        },
        {
          query: "diamond fluorescence meaning",
          impressions: 540,
          clicks: 12,
          ctr: 0.022,
          position: 14.6,
        },
      ],
      topPages: [
        {
          page: "https://www.hourglassdiamonds.com/diamond-shape-studio",
          impressions: 3100,
          clicks: 95,
          ctr: 0.0306,
          position: 14.2,
        },
        {
          page: "https://www.hourglassdiamonds.com/diamond-guide/oval-vs-round-diamond",
          impressions: 1800,
          clicks: 62,
          ctr: 0.0344,
          position: 16.8,
        },
        {
          page: "https://www.hourglassdiamonds.com/diamond-guide/natural-vs-lab-diamonds",
          impressions: 1200,
          clicks: 55,
          ctr: 0.0458,
          position: 9.1,
        },
        {
          // high impressions, weak CTR
          page: "https://www.hourglassdiamonds.com/diamond-guide/what-is-diamond-cut",
          impressions: 900,
          clicks: 14,
          ctr: 0.0156,
          position: 12.4,
        },
      ],
    },
    previous: {
      totals: {
        impressions: 17600,
        clicks: 610,
        ctr: 0.0347,
        position: 18.9,
      },
      topQueries: [
        {
          query: "hourglass diamonds",
          impressions: 880,
          clicks: 105,
          ctr: 0.119,
          position: 3.4,
        },
        {
          query: "oval engagement ring",
          impressions: 2100,
          clicks: 55,
          ctr: 0.026,
          position: 21.0,
        },
        {
          query: "lab grown vs natural diamonds",
          impressions: 700,
          clicks: 30,
          ctr: 0.043,
          position: 9.2,
        },
      ],
      topPages: [
        {
          page: "https://www.hourglassdiamonds.com/diamond-shape-studio",
          impressions: 2900,
          clicks: 88,
          ctr: 0.0303,
          position: 14.8,
        },
        {
          page: "https://www.hourglassdiamonds.com/diamond-guide/oval-vs-round-diamond",
          impressions: 1600,
          clicks: 70,
          ctr: 0.0438,
          position: 15.5,
        },
      ],
    },
    brand: {
      current: { impressions: 1400, clicks: 160, ctr: 0.114 },
      previous: { impressions: 1320, clicks: 150, ctr: 0.114 },
    },
  };
}

export function createFixtureWeeklyReport(
  collectedAt = "2026-07-21T13:00:00.000Z",
): WeeklyReportRecord {
  const ga4 = createFixtureGa4Bundle(collectedAt);
  const gsc = createFixtureGscBundle(collectedAt);
  return {
    id: "fixture-weekly-report-001",
    report_date: "2026-07-21",
    week_start: "2026-07-13",
    week_end: "2026-07-19",
    executive_summary:
      "Sessions softened week-over-week while Diamond Studio views rose. Organic search remains the top channel. Consultation CTA clicks dipped — investigate funnel clarity before declaring demand decline.",
    traffic_summary:
      "Sessions 1,840 vs 2,110 prior week. Engagement rate stable near 61%. Organic Search leads channel mix.",
    diamond_studio_summary:
      "Studio views 390 (+8% WoW). Oval leads shape exploration. CTA clicks 42 vs 48 prior.",
    landing_page_summary:
      "Homepage and Diamond Studio dominate landings. Guide /guides/oval-vs-round continued to gain sessions.",
    opportunities: [
      "Studio depth rising — reinforce oval editorial path into consultation.",
      "Guide landing momentum on oval-vs-round.",
    ],
    problems: [
      "Sessions down ~13% WoW — check channel mix and tracking completeness before acting.",
      "Consultation CTA clicks down ~12.5% while Studio views rose.",
    ],
    recommendations: [
      "Verify consultation CTA event firing on Studio before changing CTA copy.",
      "Do not infer revenue from traffic alone.",
    ],
    raw_payload: {
      ...ga4,
      gsc,
    },
    created_at: collectedAt,
  };
}

export const FIXTURE_REPORTING_PERIOD = {
  start: "2026-07-13",
  end: "2026-07-19",
} as const;
