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

export const ISI_UPDATED_LABEL =
  "Interim status — methodology revision in progress";

export const ISI_READING = {
  score: 87,
  label: "Infrastructure Strain",
  status: "Elevated Strain",
  weeklyChange: 0,
} as const;

export const ISI_INTRO =
  "A weekly reading of the physical constraints beneath digital, economic, and industrial acceleration: power, transmission, transformers, data centers, water, skilled labor, semiconductors, and logistics. The purpose is not to predict failure. It is to track a capacity expansion race — where capital deploys quickly, buildout timing stays uneven, and flexibility narrows beneath functioning systems.";

export const ISI_SUMMARY =
  "Strain remains elevated as a structural large-load and resource-adequacy problem. PJM’s Interim Resource Adequacy / large-load framework — including registry, bring-your-own-capacity pathways, and proposed curtailment for non-firm new large loads from June 2027 — is now the live planning story. Mid-July DOE emergency-order and Maximum Generation alert windows have expired and are historical context only. Reviewed evidence does not show a confirmed broad blackout; systems function with narrowed flexibility.";

export const ISI_WEEKLY_SIGNAL =
  "PJM board materials and subsequent coverage describe a multi-part large-load adequacy package: a large-load registry, Interim Resource Adequacy Service for new loads that do not bring sufficient capacity, and related reliability-backstop procurement work aimed at FERC. The practical effect is that AI data-center growth is being treated as a binding reliability and cost-allocation problem, not merely a summer heat anecdote. Expired July 14–21 emergency-order language is no longer described as current.";

export const ISI_CATEGORIES = [
  {
    name: "Grid & Transmission",
    score: 87,
    state: "High",
    body: "Resource-adequacy shortfalls and large-load additions dominate the live read. Summer 2026 heat alerts and the expired DOE Order 202-26-35 window remain useful historical context for thin spare capacity, but they are not current emergency authorities.",
  },
  {
    name: "Data-Center Load",
    score: 90,
    state: "High",
    body: "PJM’s IRAS / bring-your-own-capacity framing would require many new large loads to secure supply or accept priority curtailment in shortage conditions from 2027 — a structural transmission of AI load into interconnection and siting reality.",
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
    score: 75,
    state: "Elevated",
    body: "Cooling and water constraints remain relevant for large-load siting even outside active heat-alert windows — uneven by geography, structurally persistent.",
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
    title: "PJM IRAS / large-load FERC path",
    body: "Whether PJM’s Interim Resource Adequacy and related large-load filings advance, face challenge, or are revised before the 2027 curtailment framework would apply.",
  },
  {
    title: "Bring-your-own-capacity contracting",
    body: "Whether new data-center projects secure generation or demand-response arrangements fast enough to retain firmer service characteristics.",
  },
  {
    title: "Reliability backstop procurement",
    body: "How one-time or emergency capacity procurements interact with ordinary auctions and ratepayer-protection commitments.",
  },
  {
    title: "Transformer manufacturing",
    body: "Lead times, order books, and competition between utilities and hyperscalers for large transformer capacity.",
  },
  {
    title: "Electrical labor availability",
    body: "Electricians, lineworkers, utility engineers, and industrial crews — the practical limit on how fast plans become energized capacity.",
  },
  {
    title: "Cooling and water siting constraints",
    body: "Whether large-load proposals increasingly stall on cooling, water, or local acceptance rather than software demand alone.",
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
    body: "PJM operations updates, Hot Weather and Maximum Generation alerts, DOE Order 202-26-35, FERC large-load rules, transmission queues, interconnection delays, and regional upgrade timelines.",
  },
  {
    name: "Data-Center Reporting",
    body: "Hyperscale expansion, power contracts, backup generation, cooling design, site selection, and utility coordination for large load.",
  },
  {
    name: "Event & Transit Reporting",
    body: "World Cup transportation, security, weather response, crowd management, and host-city infrastructure capacity.",
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
      evidenceCutoff: LEDGER_EVIDENCE_CUTOFF,
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
  ],
};

export const ISI_SNAPSHOT = latestSnapshot(ISI_SERIES);
