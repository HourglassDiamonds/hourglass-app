/**
 * Infrastructure Strain — weekly data.
 * ARCHIVED NUMERICAL SERIES — public page is a qualitative Infrastructure Strain Monitor.
 * Composite scores, recent readings, benchmarks, and calculation rows remain for rebuild.
 */

import {
  LEDGER_EVIDENCE_CUTOFF,
  LEDGER_METHODOLOGY_VERSION,
  latestSnapshot,
  type LedgerMonitorSeries,
} from "./ledger-monitor-framework";

export const ISI_UPDATED_LABEL = "";

export const ISI_READING = {
  score: 87,
  label: "Infrastructure Strain",
  status: "High Strain",
  weeklyChange: 0,
} as const;

export const ISI_INTRO =
  "A weekly reading of the physical constraints beneath digital, economic, and industrial acceleration: power, transmission, transformers, data centers, water, skilled labor, semiconductors, and logistics. The purpose is not to predict failure. It is to track a capacity expansion race — where capital deploys quickly, buildout timing stays uneven, and flexibility narrows beneath functioning systems.";

export const ISI_SUMMARY =
  "Public infrastructure strain remains high and multi-regional, with active adaptation. EIA’s September 9 STEO forecasts record U.S. electricity sales of 4,135 billion kWh in 2026 and 4,211 billion kWh in 2027, driven in significant part by data-center development and manufacturing. Texas is enforcing data-center water reporting and had paused new data-center grid connections pending a power/water audit — gating load, not a grid failure. EIA lowered its West South Central sales path after that pause. Previously scored PJM congestion and European water-to-power effects remain in the picture. Energy shipping and refining constraints are counted on Global Pressure rather than added again here. Systems function; there is no synchronized grid failure.";

export const ISI_WEEKLY_SIGNAL =
  "The live U.S. evidence is now EIA record-demand confirmation plus Texas power/water gating of data centers. That is active adaptation under high strain, not expired July emergency orders and not a failing grid. Internal System Temperature infrastructure holds high / partial.";

export const ISI_CATEGORIES = [
  {
    name: "Grid & Transmission",
    score: 87,
    state: "High",
    body: "EIA forecasts record U.S. electricity sales in 2026 and 2027. Texas paused new data-center grid connections pending an audit and is enforcing water reporting. Previously scored PJM congestion remains structural. European operators continue compensating through imports, alternate generation, and river engineering. Systems function; spare flexibility is narrower.",
  },
  {
    name: "Data-Center Load",
    score: 90,
    state: "High",
    body: "Large-load / data-center adaptation is now an explicit reliability and resource problem: Texas interconnection pause and water-reporting enforcement sit beside previously identified bring-your-own-capacity, registry, and curtailment pathways. EIA still sees data centers as a significant driver of record national demand.",
  },
  {
    name: "Transformer Supply",
    score: 84,
    state: "High",
    body: "Manufacturing lead times remain constrained — utilities and hyperscalers competing for large-unit capacity, slowing substation and interconnection work.",
  },
  {
    name: "Semiconductor Capacity",
    score: 77,
    state: "Elevated",
    body: "Advanced packaging and HBM remain tight; AI infrastructure demand is still the dominant allocator, with supply functioning but not slack.",
  },
  {
    name: "Skilled Labor",
    score: 79,
    state: "Elevated",
    body: "Electrical, utility, HVAC, and industrial construction labor remain practical limits on how quickly capital plans become energized capacity.",
  },
  {
    name: "Water & Cooling",
    score: 82,
    state: "High",
    body: "Texas data-center water reporting is now an enforcement issue alongside European river-level constraints that transmit into nuclear cooling, hydro output, freight, and some municipal / agricultural restrictions. This is multi-regional operational strain, not a continental water-system collapse. Improving basins are tracked on the Water monitor.",
  },
] as const;

export const ISI_RECENT_READINGS = [
  { week: "This Week", score: 87 },
  { week: "Last Week", score: 87 },
  { week: "2 Weeks Ago", score: 87 },
  { week: "3 Weeks Ago", score: 86 },
] as const;

export const ISI_BENCHMARKS = [
  { name: "Stable Buildout", score: 45, note: "Low constraint", tier: "quiet" as const },
  { name: "Post-Covid Construction Cycle", score: 68, note: "Supply tightness", tier: "mid" as const },
  { name: "Energy Crunch", score: 84, note: "Europe 2022", tier: "high" as const },
  { name: "Supply Chain Shock", score: 88, note: "2020–21", tier: "high" as const },
  { name: "Wartime Industrial Surge", score: 91, note: "Forced capacity", tier: "high" as const },
];

export const ISI_WHAT_WATCHING = [
  {
    title: "Texas power/water gating",
    body: "Whether the data-center interconnection pause and water-reporting enforcement remain adaptation gates, or whether load is re-admitted faster than supply and water plans can absorb.",
  },
  {
    title: "EIA demand path versus Texas pause",
    body: "Whether national record-demand forecasts hold even after EIA lowered the West South Central path, or whether other regions offset the Texas gate.",
  },
  {
    title: "PJM reliability actions",
    body: "Whether the 6,831 MW shortfall, reliability-backstop auction, and IRAS / large-load path advance, face challenge, or are revised.",
  },
  {
    title: "European river recovery or deterioration",
    body: "Whether Danube and Rhine levels, nuclear cooling, hydro output, and freight constraints ease seasonally or deepen.",
  },
  {
    title: "Transformer manufacturing",
    body: "Lead times, order books, and competition between utilities and hyperscalers for large transformer capacity.",
  },
  {
    title: "Cooling, water & labor siting",
    body: "Whether large-load proposals stall on cooling, water, skilled trades, or local acceptance rather than software demand alone.",
  },
] as const;

export const ISI_WHAT_WOULD_EASE = [
  {
    title: "Matched load and supply growth",
    body: "New large loads arriving with committed capacity, demand response, or onsite generation that protects existing customers.",
  },
  {
    title: "Interconnection throughput",
    body: "Faster, clearer pathways from queued projects to energized capacity without shifting emergency risk onto the broader system.",
  },
  {
    title: "Transformer lead-time relief",
    body: "Expanded manufacturing throughput and shorter delivery windows for large electrical equipment serving grid and data-center load.",
  },
  {
    title: "Labor and construction capacity",
    body: "More available electrical and utility trades so capital plans convert into operating infrastructure on shorter timelines.",
  },
] as const;

export const ISI_CALCULATION_ROWS = [
  {
    category: "Grid & Transmission",
    weight: "24%",
    score: "87",
    contribution: "20.9",
    reason:
      "Early-July peak and mid-July Hot Weather / Maximum Generation alerts managed without a publicly confirmed broad blackout; thin spare capacity and DOE Order 202-26-35 keep strain elevated.",
  },
  {
    category: "Data-Center Load",
    weight: "22%",
    score: "90",
    contribution: "19.8",
    reason:
      "Hyperscale demand remains strategically coupled to grid readiness, large-load integration, and backup-generation flexibility under summer alerts.",
  },
  {
    category: "Transformer Supply",
    weight: "16%",
    score: "84",
    contribution: "13.4",
    reason:
      "Manufacturing lead times still constrained — utilities and hyperscalers competing for large-unit capacity.",
  },
  {
    category: "Semiconductor Capacity",
    weight: "14%",
    score: "77",
    contribution: "10.8",
    reason:
      "Advanced packaging and HBM remain tight; AI infrastructure demand still dominant in allocation.",
  },
  {
    category: "Skilled Labor",
    weight: "12%",
    score: "79",
    contribution: "9.5",
    reason:
      "World Cup logistics and industrial construction sustained labor demand — electrical and utility trades remain a meaningful buildout limit.",
  },
  {
    category: "Water & Cooling",
    weight: "12%",
    score: "75",
    contribution: "9.0",
    reason:
      "Summer heat keeps cooling load relevant in reliability discussions through successive July alert windows.",
  },
] as const;

export const ISI_CALCULATION_TOTAL = {
  contribution: "84.4 → 87",
  reason:
    "Elevated strain holds after a managed early-July peak and a mid-July hot-weather alert window under DOE Order 202-26-35 — flexibility narrowing beneath still-functioning systems.",
} as const;

export const ISI_SOURCES = [
  {
    name: "Utility & Grid Reporting",
    body: "PJM H1 congestion and wholesale-cost reporting, Monitoring Analytics State of the Market, FERC large-load rules, transmission queues, interconnection delays, and regional upgrade timelines. Expired July emergency-order windows are historical context, not current heat.",
  },
  {
    name: "Data-Center Reporting",
    body: "Hyperscale expansion, power contracts, backup generation, cooling design, site selection, and utility coordination for large load.",
  },
  {
    name: "Event & Transit Reporting",
    body: "Danube nuclear-cooling and freight reporting, including Cernavoda shutdowns and Paks engineering adaptation. World Cup event-load language is no longer a live driver.",
  },
  {
    name: "Shipping & Energy Reporting",
    body: "Hormuz routing, permit and insurance conditions, corridor confidence, and sanctions-related flow shifts.",
  },
  {
    name: "Construction & Labor Reporting",
    body: "Electrical and industrial labor availability, project duration, trade demand, and construction capacity.",
  },
] as const;

export const ISI_FOOTER_NOTE =
  "The Infrastructure Strain Monitor is an editorial framework. It tracks physical-system constraints — whether growth is supported by available capacity, slowed by bottlenecks, or operating with narrowing flexibility beneath still-functioning systems.";

/** Append-only public series. Future reviews push a new snapshot. */
export const ISI_SERIES: LedgerMonitorSeries = {
  id: "infrastructure-strain",
  methodologyVersion: LEDGER_METHODOLOGY_VERSION,
  snapshots: [
    {
      reviewDate: "August 3, 2026",
      evidenceCutoff: "August 3, 2026",
      currentState: "Elevated infrastructure strain",
      currentDirection: "Functioning with narrowed flexibility",
      previousState: "Elevated Strain (archived numerical series)",
      materialChangeSummary:
        "PJM summer alert window and DOE Order 202-26-35 managed without a confirmed broad blackout; structural tightness remains.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "PJM Interconnection",
          title: "Operations updates — peak demand and summer alerts",
          date: "July 2026 (reviewed through August 3, 2026)",
          url: "https://www.pjm.com/",
          supports:
            "Early-July peak near 168 GW; Hot Weather and Maximum Generation alerts July 14–17",
        },
      ],
    },
    {
      reviewDate: "August 12, 2026",
      evidenceCutoff: "August 12, 2026",
      currentState: "Elevated infrastructure strain",
      currentDirection: "Functioning with narrowed flexibility",
      previousState: "Elevated infrastructure strain",
      materialChangeSummary:
        "Live story shifted from expired mid-July emergency-order/alert windows to PJM’s structural large-load / Interim Resource Adequacy framework and related FERC-path proposals.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "PJM Interconnection",
          title:
            "Interim Resource Adequacy Service / framework for service during periods of insufficient resource adequacy",
          date: "July 27, 2026 board materials (reviewed August 12, 2026)",
          url: "https://www.pjm.com/-/media/DotCom/about-pjm/who-we-are/public-disclosures/2026/20260727-cifp-framework-for-service-during-periods-of-insufficient-resource-adequacy-executive-summary.pdf",
          supports:
            "Primary IRAS / BYONC framing for new large loads and curtailment pathways when resource adequacy is short",
        },
        {
          institution: "Data Center Knowledge",
          title: "PJM says AI data centers must bring capacity to earn firm service",
          date: "Reviewed August 12, 2026",
          url: "https://www.datacenterknowledge.com/energy-power-supply/pjm-says-ai-data-centers-must-bring-capacity-to-earn-firm-service",
          supports:
            "Independent industry read-through of PJM large-load curtailment and capacity requirements",
        },
      ],
    },
    {
      reviewDate: "August 18, 2026",
      evidenceCutoff: "August 18, 2026",
      currentState: "High infrastructure strain / Active adaptation",
      currentDirection: "Multi-regional — systems functioning",
      previousState: "Elevated infrastructure strain",
      materialChangeSummary:
        "Public state moved from elevated/PJM-centric to high / active adaptation across U.S. large-load adequacy and European water-constrained power and freight. Operators are adapting; there is no synchronized grid failure. Internal System Temperature infrastructure remains high / partial and does not cross to very-high.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "PJM Interconnection",
          title: "2028/2029 Base Residual Auction Report",
          date: "July 14, 2026 (reviewed August 18, 2026)",
          url: "https://www.pjm.com/-/media/DotCom/markets-ops/rpm/rpm-auction-info/2028-2029/2028-2029-bra-results-report.pdf",
          supports:
            "6,831.3 MW UCAP short of the 2028/2029 RTO Reliability Requirement; structural adequacy gap, not a current blackout",
        },
        {
          institution: "PJM Interconnection / PR Newswire",
          title:
            "PJM Capacity Auction Procures 138,318 MW of Generation Resources as Work Continues To Address Growing Electricity Demand",
          date: "July 14, 2026 (reviewed August 18, 2026)",
          url: "https://www.prnewswire.com/news-releases/pjm-capacity-auction-procures-138-318-mw-of-generation-resources-as-work-continues-to-address-growing-electricity-demand-302825613.html",
          supports:
            "6,831 MW short of the reliability requirement; planned reliability-backstop procurement as active adaptation, not loss of current system function",
        },
        {
          institution: "PJM Interconnection",
          title:
            "Interim Resource Adequacy Service / framework for service during periods of insufficient resource adequacy",
          date: "July 27, 2026 board materials (reviewed August 18, 2026)",
          url: "https://www.pjm.com/-/media/DotCom/about-pjm/who-we-are/public-disclosures/2026/20260727-cifp-framework-for-service-during-periods-of-insufficient-resource-adequacy-executive-summary.pdf",
          supports:
            "IRAS / large-load / bring-your-own-capacity adaptation framework remaining the live U.S. planning constraint",
        },
        {
          institution: "BBC News",
          title:
            "Romania shuts only nuclear plant as heat causes drop in Danube River level",
          date: "August 13–14, 2026 (reviewed August 18, 2026)",
          url: "https://www.bbc.com/news/articles/cqlxpq5q799o",
          supports:
            "Cernavodă shutdown on low Danube cooling water; hydro weakness; Rhine traffic severely limited; operators adapting via imports and alternate generation",
        },
        {
          institution: "Euronews",
          title:
            "Romania shuts off second reactor at Cernavodă NPP amid low water levels on Danube",
          date: "August 13, 2026 (reviewed August 18, 2026)",
          url: "https://www.euronews.com/my-europe/2026/08/13/romania-shuts-off-second-reactor-at-cernavoda-npp-amid-low-water-levels-on-danube",
          supports:
            "Danube-linked nuclear and shipping effects; neighboring plants still operating with emergency measures — no synchronized continental grid failure",
        },
      ],
    },
    {
      reviewDate: "August 24, 2026",
      evidenceCutoff: "August 24, 2026",
      currentState: "High infrastructure strain",
      currentDirection: "Active adaptation / Multi-regional constraints",
      previousState: "High infrastructure strain / Active adaptation",
      materialChangeSummary:
        "Public state remains high strain with active adaptation across multiple regions. New PJM H1 evidence confirms structural grid congestion and wholesale-cost pressure. Romania’s Cernavodă remains shut on historically low Danube water, with emergency river-level measures; Hungary’s Paks shows successful engineering adaptation. July emergency-order and World Cup language are no longer live drivers. Internal System Temperature infrastructure holds high / partial.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "Reuters / Monitoring Analytics",
          title: "Largest US grid's transmission constraint costs surge to $6 billion in 2026",
          date: "August 21, 2026 (reviewed August 24, 2026)",
          url: "http://www.kitco.com/news/off-the-wire/2026-08-21/largest-us-grids-transmission-constraint-costs-surge-6-billion-2026",
          supports:
            "PJM H1 congestion costs about $6B, +43%; real-time wholesale cost about $29.4B vs $20.4B; average wholesale about $72.54/MWh vs $51.75; 500-kV operating-limit incidents materially higher",
        },
        {
          institution: "World Nuclear News",
          title: "Romanian plant taken offline as Hungary moves to keep Paks operating",
          date: "August 2026 (reviewed August 24, 2026)",
          url: "https://world-nuclear-news.org/articles/romanian-plant-taken-offline-as-hungary-moves-to-keep-paks-operating",
          supports:
            "Cernavodă remains offline on low Danube cooling water; Hungary taking engineering measures so Paks can continue operating — strain plus adaptation",
        },
        {
          institution: "EU Today",
          title: "Romania begins emergency river works to restore Cernavoda cooling supply",
          date: "August 21, 2026 (reviewed August 24, 2026)",
          url: "https://eutoday.net/romania-emergency-river-engineering-cernavoda-cooling/",
          supports:
            "Emergency measures to raise Danube levels for Cernavodă cooling; both reactors still shut as of the review window",
        },
      ],
    },
    {
      reviewDate: "September 16, 2026",
      evidenceCutoff: LEDGER_EVIDENCE_CUTOFF,
      currentState: "High infrastructure strain",
      currentDirection: "Active adaptation / Power-water co-constraint tightening",
      previousState: "High infrastructure strain",
      materialChangeSummary:
        "Public state remains high strain with active adaptation. EIA’s September 9 STEO forecasts record U.S. electricity sales in 2026 and 2027, with data centers a significant driver; the Texas interconnection pause lowered the West South Central path. Texas is now enforcing data-center water reporting alongside the earlier grid-connection halt. That is load-gating under strain, not grid failure. Energy shipping/refining is counted on Global Pressure. Internal System Temperature infrastructure holds high / partial.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "U.S. Energy Information Administration",
          title: "Short-Term Energy Outlook — September 2026",
          date: "September 9, 2026 (reviewed September 16, 2026)",
          url: "https://www.eia.gov/outlooks/steo/",
          supports:
            "Record U.S. electricity sales of 4,135 billion kWh in 2026 and 4,211 billion kWh in 2027; data-center and manufacturing demand; West South Central path lowered after the Texas data-center connection pause",
        },
        {
          institution: "Reuters",
          title: "Texas moves to penalize data centers for water violations",
          date: "September 14, 2026 (reviewed September 16, 2026)",
          url: "https://www.reuters.com/legal/litigation/texas-moves-penalize-data-centers-water-violations-2026-09-14/",
          supports:
            "Texas directed penalties for data-center water-reporting failures and had halted new data-center grid connections pending a power/water review",
        },
        {
          institution: "Office of the Texas Governor",
          title:
            "Governor Abbott Directs TWDB To Penalize Data Center Reporting Failures",
          date: "September 14, 2026 (reviewed September 16, 2026)",
          url: "https://gov.texas.gov/news/post/governor-abbott-directs-twdb-to-penalize-data-center-reporting-failures",
          supports:
            "First-party directive to impose legal consequences for data-center water-survey noncompliance and to partner with ERCOT on the interconnection audit",
        },
      ],
    },
  ],
};

export const ISI_SNAPSHOT = latestSnapshot(ISI_SERIES);
