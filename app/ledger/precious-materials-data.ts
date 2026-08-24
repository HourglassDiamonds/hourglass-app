/**
 * Precious Materials — weekly data.
 * ARCHIVED NUMERICAL SERIES — public page is a qualitative Precious Materials Monitor.
 * Proprietary 0–100 scores and weighting rows remain for rebuild.
 */

import {
  LEDGER_EVIDENCE_CUTOFF,
  LEDGER_METHODOLOGY_VERSION,
  latestSnapshot,
  type LedgerMonitorSeries,
} from "./ledger-monitor-framework";

export const PMI_UPDATED_LABEL = "";

export const PMI_MARKET_PRESSURE = {
  score: 85,
  status: "Strategically Firm",
  weeklyChange: 0,
} as const;

export const PMI_INTRO =
  "A weekly index tracking the material conditions behind fine jewelry — gold, platinum, natural diamonds, and the sourcing environment that shapes quality, availability, and long-term value for clients and makers.";

export const PMI_METALS_PRESSURE = [
  { metal: "Gold Monetary Pressure", score: 87, state: "Elevated" },
  { metal: "Silver Pressure", score: 78, state: "Elevated" },
  { metal: "Platinum / Palladium", score: 72, state: "Firm" },
] as const;

export const PMI_DIAMOND_SPLIT = [
  { segment: "Premium Natural", score: 78, note: "Selectively firm in key sizes" },
  { segment: "Commercial Natural", score: 55, note: "Price-sensitive" },
  { segment: "Lab-Grown", score: 88, note: "Share pressure rising" },
] as const;

export const PMI_JEWELRY_DEMAND = [
  { channel: "Jewelry Demand Pressure", read: "78/100", note: "Bridal and high jewelry firm" },
  { channel: "Colored Gemstone Scarcity", read: "74/100", note: "Key origins constrained" },
] as const;

export const PMI_RECENT_READINGS = [
  { week: "This Week", score: 85 },
  { week: "Last Week", score: 85 },
  { week: "2 Weeks Ago", score: 85 },
  { week: "3 Weeks Ago", score: 85 },
] as const;

export const PMI_CROSS_SYSTEM_BRIDGE =
  "Material markets remain connected to broader macro and reserve-asset conditions — but jewelry sourcing follows its own segmented logic beneath the geopolitical layer. Gold is not a simple war-to-price story this week.";

export const PMI_CROSS_SYSTEM_PRESSURE = [
  "Gold remains around $4,650 on August 24 — highest since mid-May, with more than a 5% gain in the prior week — as a weaker dollar and concern surrounding Treasury long-bond buybacks / fiscal confidence supported the bid. Jewelry demand remains price-sensitive. This is the same monetary/fiscal event already captured in the Financial System Temperature channel, not a separate materials increment.",
  "World Gold Council Q2 2026 data show official-sector purchases of 289t, supporting the structural reserve-demand read beneath near-term price action.",
  "Natural-diamond markets remain segmented rather than broadly recovered or collapsed. De Beers H1 realized price was $105/ct, down 32%. Larger/higher-quality natural goods were comparatively resilient; smaller/lower-value natural goods remain pressured by synthetic lab-grown competition. Global finished diamond jewelry sales were broadly stable year-on-year, with better U.S. independent-jeweler signals and continued mainland-China weakness.",
  "Lab-grown continues to track wholesale compression, commodity economics, manufacturing scale, adoption, and retailer margin structure.",
] as const;

export const PMI_WHAT_MOVED = [
  "No materials-regime change this week — strategically firm and highly segmented remains the posture.",
  "Gold around ~$4,650 reflects weaker-dollar and fiscal-confidence sensitivity around Treasury long-bond buybacks, not a monocausal war bid. Do not double-count this as a materials System Temperature increment.",
  "Natural diamonds should be read as segmented (premium versus commercial, supply discipline, producer economics) rather than as broadly scarce.",
] as const;

export const PMI_WHAT_TO_WATCH = [
  "Whether gold holds around the $4,650 area as dollar and fiscal-confidence signals compete with official-sector demand.",
  "Whether official-sector accumulation remains a multi-quarter support after the strong Q2 rebound.",
  "Whether higher-value natural goods continue to diverge from commercial / lower-value ranges.",
  "Producer economics, supply discipline, and rough / polished dynamics — not a generic scarcity headline.",
  "Lab-grown wholesale compression, manufacturing scale, adoption, and retailer margin structure.",
  "Sourcing discipline in a segmented market — provenance and selective inventory over reactive accumulation.",
] as const;

export const PMI_CALCULATION_ROWS = [
  { component: "Metals complex", weight: "30%", note: "Gold, silver, platinum, palladium" },
  { component: "Diamond market stress", weight: "35%", note: "Natural, lab-grown, segmented demand" },
  { component: "Jewelry demand pressure", weight: "20%", note: "Bridal, high jewelry, channel load" },
  { component: "Gemstone scarcity", weight: "15%", note: "Colored stones, selective supply" },
] as const;

export const PMI_SOURCES_NOTE =
  "Directly sourced market prices and observable movements are retained. This monitor is editorial — not a traded product or investment recommendation.";

export const PMI_FOOTER_METHOD_NOTE =
  "The Precious Materials Monitor is a qualitative editorial framework for fine jewelry sourcing orientation — not commodity speculation.";

/** Append-only public series. Future reviews push a new snapshot. */
export const PMI_SERIES: LedgerMonitorSeries = {
  id: "precious-materials",
  methodologyVersion: LEDGER_METHODOLOGY_VERSION,
  snapshots: [
    {
      reviewDate: "August 3, 2026",
      evidenceCutoff: "August 3, 2026",
      currentState: "Strategically firm",
      currentDirection: "Highly segmented",
      previousState: "Strategically Firm (archived numerical series)",
      materialChangeSummary:
        "No materials-regime change. Market pricing indicated gold near the $4,000 area; diamond segmentation and lab-grown compression continued.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "LBMA / public spot market reporting",
          title: "Gold spot price near the $4,000 area",
          date: "Accessed August 3, 2026",
          supports:
            "Market pricing indicated gold trading around the $4,000 area without a materials-regime break",
        },
      ],
    },
    {
      reviewDate: "August 12, 2026",
      evidenceCutoff: "August 12, 2026",
      currentState: "Strategically firm",
      currentDirection: "Highly segmented",
      previousState: "Strategically firm",
      materialChangeSummary:
        "No materials-regime change. Gold traded near the $4,400 area; World Gold Council Q2 data showed a strong official-sector purchase rebound; diamond markets remained segmented.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "World Gold Council",
          title: "Gold Demand Trends: Q2 2026",
          date: "Published July 30, 2026 (reviewed August 12, 2026)",
          url: "https://www.gold.org/goldhub/research/gold-demand-trends/gold-demand-trends-q2-2026",
          supports:
            "Official-sector net purchases of 289t in Q2; elevated average gold prices without treating spot moves as a jewelry-regime break",
        },
        {
          institution: "LBMA / public spot market reporting",
          title: "Gold near the $4,400 area ahead of U.S. CPI",
          date: "Accessed August 12, 2026",
          url: "https://www.lbma.org.uk/prices-and-data/precious-metal-prices#/",
          supports:
            "Market pricing indicated gold trading near the $4,400 area into the review window",
        },
        {
          institution: "Rapaport / trade commentary synthesis",
          title: "Natural vs lab-grown demand and pricing stability commentary",
          date: "Reviewed through August 12, 2026",
          supports:
            "Segmented natural-diamond stability narratives beside continued lab-grown commercial pressure",
        },
      ],
    },
    {
      reviewDate: "August 18, 2026",
      evidenceCutoff: "August 18, 2026",
      currentState: "Strategically firm / Highly segmented",
      currentDirection: "Highly segmented",
      previousState: "Strategically firm",
      materialChangeSummary:
        "No materials-regime change. Gold remains around ~$4,400 as safe-haven and official-sector demand compete with higher long-duration yields. Natural diamonds are read as segmented rather than generically scarce; lab-grown wholesale compression continues.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "World Gold Council",
          title: "Gold Demand Trends: Q2 2026",
          date: "Published July 30, 2026 (reviewed August 18, 2026)",
          url: "https://www.gold.org/goldhub/research/gold-demand-trends/gold-demand-trends-q2-2026",
          supports:
            "Official-sector net purchases of 289t in Q2 as structural reserve-demand context beneath near-term gold around $4,400",
        },
        {
          institution: "FXStreet",
          title: "Gold Price Forecast: XAU/USD eases below $4,400 as US yields rally",
          date: "August 18, 2026",
          url: "https://www.fxstreet.com/news/gold-price-forecast-xau-usd-eases-below-4-400-as-us-yields-rally-202608181043",
          supports:
            "Spot gold around / just below the $4,400 area on August 18 as higher long-duration yields competed against safe-haven support",
        },
        {
          institution: "De Beers Group",
          title: "Interim financial results for 2026",
          date: "H1 2026 results (reviewed August 18, 2026)",
          url: "https://www.debeersgroup.com/news-insights/latest-group-news/2026/interim-financial-results-for-2026",
          supports:
            "Producer economics and sales-mix toward lower-value goods; segmented natural market rather than generic scarcity; smaller/lower-quality naturals under lab-grown price pressure, with synthetic retail prices continuing to fall",
        },
      ],
    },
    {
      reviewDate: "August 24, 2026",
      evidenceCutoff: LEDGER_EVIDENCE_CUTOFF,
      currentState: "Strategically firm / Highly segmented",
      currentDirection: "Highly segmented",
      previousState: "Strategically firm / Highly segmented",
      materialChangeSummary:
        "No materials-regime change and no System Temperature materials increment. Spot gold around $4,650 on August 24 — highest since mid-May, with more than a 5% prior-week gain — as a weaker dollar and concern surrounding Treasury long-bond buybacks / fiscal confidence supported the bid. Gold state: monetary demand strengthening / fiscal-confidence sensitivity rising. De Beers H1 realized price $105/ct, down 32%; larger/higher-quality naturals comparatively resilient; smaller/lower-value goods pressured by lab-grown competition. The gold/Treasury/dollar event is already captured in Financial.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "Reuters",
          title: "Gold rally gains momentum ahead of US inflation, Jackson Hole event",
          date: "August 24, 2026",
          url: "https://www.kitco.com/news/off-the-wire/2026-08-24/gold-rally-gains-momentum-ahead-us-inflation-jackson-hole-event",
          supports:
            "Spot gold in the mid-$4,600s on August 24, highest since mid-May, with a more-than-5% prior-week gain; weaker dollar and Treasury buyback/fiscal-confidence concern as material drivers",
        },
        {
          institution: "U.S. Department of the Treasury",
          title:
            "Treasury Announces Increased Sizes of Nominal Long-End Liquidity Support Buybacks Beginning September 9",
          date: "August 19, 2026 (reviewed August 24, 2026)",
          url: "https://home.treasury.gov/news/press-releases/sb0607",
          supports:
            "Official long-end buyback expansion as a fiscal-confidence / dollar-channel driver of gold — already scored in Financial, not added again in Materials",
        },
        {
          institution: "De Beers Group",
          title: "Interim financial results for 2026",
          date: "H1 2026 results (reviewed August 24, 2026)",
          url: "https://www.debeersgroup.com/news-insights/latest-group-news/2026/interim-financial-results-for-2026",
          supports:
            "H1 realized price $105/ct, down 32%; segmented natural market with larger/higher-quality goods comparatively resilient and smaller/lower-value goods pressured by lab-grown competition",
        },
      ],
    },
  ],
};

export const PMI_SNAPSHOT = latestSnapshot(PMI_SERIES);
