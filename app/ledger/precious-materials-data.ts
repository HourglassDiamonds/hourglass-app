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
  "Material markets remain connected to rates and reserve demand, but jewelry sourcing follows its own segmented logic. The Fed hold, Treasury curve, and gold move are Financial-channel evidence and are not counted again. Natural diamonds show improving volume beside much lower realized prices; lab-grown listings remain cheaper and highly dispersed.";

export const PMI_CROSS_SYSTEM_PRESSURE = [
  "Gold closed near $3,975 on November 2 after the September reference price reached $4,176. The pullback is cooling evidence, but the absolute level remains elevated and jewelry demand remains price-sensitive.",
  "Platinum traded near $1,432–$1,444 on November 2. The available evidence supports a firm, supply-sensitive market rather than a verified broad shortage.",
  "De Beers Q3 paired higher sales volume with a 45% lower average realized price and an 18% year-to-date price-index decline. Rapaport's October review showed gains in headline small and 1-carat indices but softer selected higher-quality 1-carat bands. Natural diamonds remain segmented, not generically scarce.",
  "Caratlytics' November 2 listing sample placed the lab-grown median far below natural and showed wider dispersion. Listings are not completed transactions or appraisals, but they reinforce continued commodity-style compression.",
] as const;

export const PMI_WHAT_MOVED = [
  "Gold closed near $3,975 on November 2 and platinum traded around $1,432–$1,444; gold remained below its September level despite continuing geopolitical stress.",
  "De Beers reported Q3 sales volume of 9.8 million carats and $731 million of consolidated rough revenue, while average realized price fell 45% year over year to $84 per carat.",
  "Rapaport's November 2 review described mixed October polished pricing: firmer small goods, a second monthly 1-carat gain, and softer higher-quality 1-carat subsegments by month-end.",
  "Lab-grown retail listings remain structurally cheaper and highly dispersed; listed-price datasets are not transaction prices or appraisals.",
] as const;

export const PMI_WHAT_TO_WATCH = [
  "Whether gold stabilizes after late-October cooling or reaccelerates with inflation, yields, or energy risk.",
  "Whether official-sector accumulation remains a multi-quarter support after the strong Q2 rebound.",
  "Whether October's small-stone gains broaden or reverse as Indian inventory builds.",
  "Producer economics, supply discipline, and rough / polished dynamics — not a generic scarcity headline.",
  "Lab-grown listed-price dispersion, manufacturing scale, adoption, disclosure, and retailer margin structure.",
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
      evidenceCutoff: "August 24, 2026",
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
    {
      reviewDate: "September 16, 2026",
      evidenceCutoff: LEDGER_EVIDENCE_CUTOFF,
      currentState: "Strategically firm / Highly segmented",
      currentDirection: "Rate-sensitive gold cooling / Diamonds still segmented",
      previousState: "Strategically firm / Highly segmented",
      materialChangeSummary:
        "No materials-regime change and no System Temperature materials increment. Spot gold around $4,266–$4,297 on September 15 — near the lowest since early August — as yields, the dollar, and hike odds overpowered some safe-haven demand. That is disconfirming while geopolitical risk is high. Rapaport August RAPI: 1-carat +0.5% (first monthly rise in 15 months), 0.30-carat +2%, 0.50-carat +2.5%; 3-carat −0.4%. The gold/rates/dollar event is already captured in Financial.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "Reuters / Kitco",
          title: "Gold eases on stronger US rate hike odds",
          date: "September 15, 2026",
          url: "http://www.kitco.com/news/off-the-wire/2026-09-15/gold-eases-stronger-us-rate-hike-odds",
          supports:
            "Spot gold around $4,266 on September 15, near the lowest since August 7, as hike odds, a firmer dollar, and higher long-end yields pressured bullion",
        },
        {
          institution: "Rapaport USA / GlobeNewswire",
          title: "Diamond Price Recovery Broadens Further in August",
          date: "September 2, 2026 (reviewed September 16, 2026)",
          url: "https://lifestyle.pspl.com/story/829646/diamond-price-recovery-broadens-further-in-august/",
          supports:
            "August RAPI +0.5% for 1-carat (first monthly increase in 15 months); 0.30-carat +2%; 0.50-carat +2.5%; 3-carat −0.4%; recovery broadening as supply cuts bite, not a generic shortage",
        },
        {
          institution: "De Beers Group",
          title: "Interim financial results for 2026",
          date: "H1 2026 results (reviewed September 16, 2026)",
          url: "https://www.debeersgroup.com/news-insights/latest-group-news/2026/interim-financial-results-for-2026",
          supports:
            "Producer-economics context remaining segmented: H1 realized $105/ct, down 32%, with commercial goods still pressured by lab-grown competition",
        },
      ],
    },
    {
      reviewDate: "October 29, 2026",
      evidenceCutoff: LEDGER_EVIDENCE_CUTOFF,
      currentState: "Strategically firm / Highly segmented",
      currentDirection: "Gold cooling / Diamond recovery broadening unevenly",
      previousState: "Strategically firm / Highly segmented",
      materialChangeSummary:
        "No materials-regime change and no System Temperature materials increment. Gold reference prices fell toward roughly $4,013 by October 23 from the high-$4,200s in mid-September despite continued geopolitical pressure. September RAPI rose 3.2% for 0.30-carat, 2.5% for 0.50-carat, 0.3% for 1-carat, and 1.5% for 3-carat goods. That is a broader but supply-led diamond recovery inside a downsized, still-segmented industry.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "World Gold Council",
          title: "Gold spot prices and market history",
          date: "Data reviewed October 27, 2026",
          url: "https://www.gold.org/goldhub/data/gold-prices",
          supports:
            "Late-October gold reference data confirming further cooling from the September review window",
        },
        {
          institution: "Rapaport News",
          title: "Small Diamonds Lead Price Gains in September",
          date: "October 6, 2026",
          url: "https://rapaport.com/news/small-diamonds-lead-price-gains-in-september/",
          supports:
            "September RAPI gains across all four tracked size bands, led by smaller goods, alongside continuing mine and producer restructuring",
        },
        {
          institution: "Board of Governors of the Federal Reserve System",
          title: "Federal Reserve issues FOMC statement",
          date: "October 28, 2026",
          url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm",
          supports:
            "Persistently elevated inflation and restrictive rates as context for gold's rate sensitivity; the same event remains scored in Financial",
        },
      ],
    },
    {
      reviewDate: "November 3, 2026",
      evidenceCutoff: LEDGER_EVIDENCE_CUTOFF,
      currentState: "Strategically firm / Highly segmented",
      currentDirection: "Rate-sensitive metals / Mixed natural diamonds / Lab-grown dispersion",
      previousState: "Strategically firm / Highly segmented",
      materialChangeSummary: PMI_WHAT_MOVED.join(" "),
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "Reuters",
          title: "Gold rises on softer oil; markets parse Fed signals",
          date: "Published November 2, 2026",
          dataPeriod: "November 2, 2026 intraday market",
          evidenceLabel: "Provisional",
          url: "https://www.marketscreener.com/news/gold-rises-on-softer-oil-markets-parse-fed-signals-ce785fd8dc88f220",
          supports: "Gold rebounded as oil softened; platinum was about $1,431.50 during the cited measurement window.",
        },
        {
          institution: "World Gold Council",
          title: "Gold Market Commentary: Go with the flow",
          date: "Published October 7, 2026",
          dataPeriod: "September 2026",
          evidenceLabel: "Lagged",
          url: "https://www.gold.org/goldhub/research/gold-market-commentary-september-2026",
          supports: "September reference price of $4,176 and the distinction between price weakness, ETF inflows, and futures positioning.",
        },
        {
          institution: "De Beers Group",
          title: "Production Report for the Third Quarter of 2026",
          date: "Published October 20, 2026",
          dataPeriod: "Third quarter and year-to-date 2026",
          evidenceLabel: "Observed",
          url: "https://www.debeersgroup.com/news-insights/latest-group-news/2026/production-report-for-the-third-quarter-of-2026",
          supports: "Q3 production down 11% year over year; sales volume up 71%; revenue up 4%; average realized price down 45%; lower-value naturals still pressured by lab-grown competition.",
        },
        {
          institution: "Rapaport Trade",
          title: "Small Gains, Big Moves: October's Diamond Market and Industry Highlights",
          date: "Published November 2, 2026",
          dataPeriod: "October 2026",
          evidenceLabel: "Observed",
          url: "https://rapaport.com/trade/blog/octobers-diamond-market-and-industry-highlights/",
          supports: "Mixed polished market: 0.30-carat +3.2%, 0.50-carat +2.5%, 1-carat +0.3%, with softer selected 1-carat quality bands and inventory pressure by month-end.",
        },
        {
          institution: "Caratlytics",
          title: "Diamond Price Index — October 2026",
          date: "Generated November 2, 2026",
          dataPeriod: "October 2026 live listings",
          evidenceLabel: "Estimated",
          url: "https://caratlytics.com/price-index/",
          supports: "Systematic listed-price sample shows lab-grown median far below natural and much wider cross-retailer dispersion; listings are not transactions.",
        },
        {
          institution: "Gemological Institute of America",
          title: "Disclosing Treated or Laboratory-Grown Gem Material to GIA",
          date: "Accessed November 3, 2026",
          dataPeriod: "Current disclosure practice",
          evidenceLabel: "Observed",
          url: "https://www.gia.edu/gem-lab-disclosure",
          supports: "Identification, disclosure, and inscription practices for laboratory-grown material.",
        },
      ],
    },
  ],
};

export const PMI_SNAPSHOT = latestSnapshot(PMI_SERIES);
