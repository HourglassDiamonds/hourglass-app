/**
 * Hourglass Ledger — weekly index readings.
 * Update this file when publishing new weekly briefs.
 */

export type LedgerIndexId =
  | "global-pressure"
  | "information-signal"
  | "ai-capability"
  | "precious-materials"
  | "infrastructure-strain";

export type RecentReading = {
  week: string;
  degrees: number;
  state: string;
};

export type MethodPill = {
  label: string;
  value: string;
};

export type BenchmarkTier = "quiet" | "mid" | "high";

export type BenchmarkReading = {
  name: string;
  score: number;
  note: string;
  /** Visual hierarchy for historical benchmarks (GPI) */
  tier?: BenchmarkTier;
};

export type EditorialBlock = {
  title: string;
  body: string;
};

export type LedgerIndexDefinition = {
  id: LedgerIndexId;
  /** URL path segment under /ledger/ */
  slug: string;
  seoTitle: string;
  seoDescription: string;
  displayTitle: string;
  /** Short label for subnav */
  subnavLabel: string;
  hubDescription: string;
  kicker: string;
  intro: string;
  updatedLabel: string;
  reading: number;
  readingLabel: string;
  status: string;
  weeklyDelta: number;
  scaleLabels: readonly string[];
  scaleGradient: string;
  summary: string;
  /** Optional editorial summary lead + emphasis (full meter only) */
  summaryLead?: string;
  summaryEmphasis?: string;
  summaryCompact: string;
  weeklyNote: string;
  weeklyNoteCompact: string;
  methodPills: readonly MethodPill[];
  recentReadings: readonly RecentReading[];
  benchmarks?: readonly BenchmarkReading[];
  /** Optional narrative blocks below the main card */
  editorialBlocks?: readonly EditorialBlock[];
  /** Optional title for editorial watch section (defaults vary by page) */
  watchingSectionTitle?: string;
};

export const LEDGER_UPDATED = "Updated weekly — May 19, 2026";

const SCALE_GRADIENT_PRESSURE =
  "linear-gradient(90deg, #617f98 0%, #86a2b4 16%, #aaa99d 32%, #c6b384 50%, #bd8d55 66%, #985844 82%, #5f2d31 100%)";

const SCALE_GRADIENT_SIGNAL =
  "linear-gradient(90deg, #8a9aa8 0%, #b0b5a8 30%, #c9c0a8 55%, #b8a690 75%, #8a7d6f 100%)";

const SCALE_GRADIENT_AI =
  "linear-gradient(90deg, #9aa8b5 0%, #b5b8a8 35%, #c4b59a 60%, #a89582 80%, #7a6e62 100%)";

const SCALE_GRADIENT_MATERIALS =
  "linear-gradient(90deg, #a8b0b8 0%, #c4bcb0 40%, #d4c4a8 65%, #b8a690 85%, #9a8b78 100%)";

const SCALE_GRADIENT_INFRASTRUCTURE =
  "linear-gradient(90deg, #9aa8b0 0%, #b5b0a0 30%, #c9b896 55%, #b89570 75%, #8a6e58 100%)";

export const LEDGER_INDEXES: readonly LedgerIndexDefinition[] = [
  {
    id: "global-pressure",
    slug: "global-pressure-index",
    seoTitle: "Global Pressure Index",
    seoDescription:
      "Hourglass Ledger Global Pressure Index — weekly reading across energy, infrastructure, financial conditions, commodities, and geopolitical friction.",
    displayTitle: "Global Pressure Index",
    subnavLabel: "Global Pressure",
    hubDescription:
      "A composite degree reading across energy, infrastructure, financial conditions, and coordination channels — structurally elevated, observational in tone.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A weekly reading of global pressure across geopolitics, energy, commodities, financial conditions, infrastructure, supply chains, and coordination channels. The purpose is not to predict collapse. It is to observe when stress is structurally elevated, when flexibility compresses, and when multiple systems respond more slowly beneath still-resilient markets.",
    updatedLabel: LEDGER_UPDATED,
    reading: 90,
    readingLabel: "Pressure Reading",
    status: "Persistent Elevated Pressure",
    weeklyDelta: 1,
    scaleLabels: ["Cold", "Stable", "Elevated", "Hot", "Critical"],
    scaleGradient: SCALE_GRADIENT_PRESSURE,
    summary:
      "Pressure is uneven but broadening: energy sensitivity, Gulf-route and shipping fragility, sticky inflation, long-duration bond stress, and grid-adjacent infrastructure strain are transmitting together. Market resilience and AI capital expenditure continue to offset part of the slowdown drag, leaving conditions elevated and coordination-strained — but not at disorder level.",
    summaryLead: "The system remains in a",
    summaryEmphasis: "persistent elevated pressure environment",
    summaryCompact:
      "Pressure holds in a persistent elevated band — broad coordination strain, resilient markets, with energy and infrastructure as key transmission channels and AI investment offsetting some slowdown pressure.",
    weeklyNote:
      "Energy volatility stayed in focus, long-duration bonds showed continued brittleness, and infrastructure-adjacent load persisted without acute breakdown. AI and compute capex continued to support growth and risk appetite in selective lanes, while sticky inflation kept policy and shipping-security uncertainty visible. The signal is breadth of pressure and compressed flexibility — not imminent dislocation.",
    weeklyNoteCompact:
      "Energy volatility, bond brittleness, infrastructure strain, AI investment support, and persistent inflation sensitivity remain in view.",
    methodPills: [
      { label: "Reading Type", value: "Weighted editorial index" },
      { label: "Primary Drivers", value: "Energy, bonds, infrastructure, AI capex" },
      { label: "Current Direction", value: "Elevated, unevenly distributed" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 90, state: "Elevated" },
      { week: "Last Week", degrees: 89, state: "Elevated" },
      { week: "2 Weeks Ago", degrees: 87, state: "Elevated" },
      { week: "3 Weeks Ago", degrees: 86, state: "Elevated" },
    ],
    benchmarks: [
      { name: "Stable Expansion", score: 50, note: "Low pressure", tier: "quiet" },
      { name: "Eurozone Debt Crisis", score: 70, note: "2011–12", tier: "mid" },
      { name: "Cold War Peaks", score: 82, note: "Proxy heat", tier: "mid" },
      { name: "Covid Shock", score: 91, note: "2020", tier: "high" },
      { name: "2008 Collapse", score: 96, note: "Credit seizure", tier: "high" },
    ],
    watchingSectionTitle: "What We're Watching",
    editorialBlocks: [
      {
        title: "Energy & shipping corridors",
        body: "Energy volatility and Gulf-route fragility remain primary transmission channels. Shipping and security uncertainty add coordination strain without implying imminent breakdown.",
      },
      {
        title: "Grid & infrastructure strain",
        body: "Electricity demand, data-center load, transformer constraints, and grid bottlenecks act as slow-moving amplifiers — compressing flexibility while systems continue to operate.",
      },
      {
        title: "Financial conditions & markets",
        body: "Long-duration bond stress and inflation sensitivity keep policy room narrow. AI capital expenditure and selective market resilience continue to offset some pressure beneath slower system responsiveness.",
      },
    ],
  },
  {
    id: "information-signal",
    slug: "information-signal-map",
    seoTitle: "Information Signal Map",
    seoDescription:
      "Hourglass Ledger Information Signal Map — a calm read on narrative density, institutional messaging, and information velocity across markets and policy.",
    displayTitle: "Information Signal Map",
    subnavLabel: "Information Map",
    hubDescription:
      "A narrative layer reading on signal convergence, framing comparison, and how institutional, market, and infrastructure channels interpret the same pressures.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A weekly map of how narratives move through markets, media, policy, and institutions — not to chase hidden truths, but to track when different information layers begin describing the same systems story. The goal is orientation: where framing converges, where it diverges, and what remains underweighted.",
    updatedLabel: LEDGER_UPDATED,
    reading: 79,
    readingLabel: "Signal Clarity",
    status: "Converging Narratives",
    weeklyDelta: 2,
    scaleLabels: ["Quiet", "Clear", "Mixed", "Noisy", "Saturated"],
    scaleGradient: SCALE_GRADIENT_SIGNAL,
    summary:
      "Narratives are converging more clearly around energy, AI infrastructure, grid strain, and inflation persistence — increasingly linked in coverage, with disagreement focused on tempo rather than whether pressure exists. Interpretation is improving without implying certainty.",
    summaryCompact:
      "Signal clarity is rising as institutional, market, infrastructure, and mainstream frames overlap on energy, AI physical capacity, and grid constraints beneath resilient markets.",
    weeklyNote:
      "AI is discussed more often as physical infrastructure; energy sits closer to AI scaling narratives; infrastructure constraints appear more frequently beside financial and media commentary on resilience. Physical bottlenecks are acknowledged more openly — without conspiratorial or hidden-truth framing.",
    weeklyNoteCompact:
      "Frames converging on energy, AI infrastructure, and grid strain — physical bottlenecks gaining visibility beneath market resilience.",
    methodPills: [
      { label: "Reading Type", value: "Editorial signal map" },
      { label: "Primary Channels", value: "Institutional, market, infrastructure, mainstream" },
      { label: "Current Direction", value: "Converging, nuanced" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 79, state: "Clear" },
      { week: "Last Week", degrees: 77, state: "Mixed" },
      { week: "2 Weeks Ago", degrees: 75, state: "Mixed" },
      { week: "3 Weeks Ago", degrees: 73, state: "Mixed" },
    ],
    benchmarks: [
      { name: "Quiet Cycle", score: 42, note: "Low density" },
      { name: "Brexit Referendum", score: 61, note: "2016" },
      { name: "Election Volatility", score: 69, note: "Typical peak" },
      { name: "Covid News Cycle", score: 86, note: "2020" },
      { name: "Flash Crash Media", score: 78, note: "2010" },
    ],
    editorialBlocks: [
      {
        title: "Institutional framing",
        body: "Resilience, inflation management, energy security, and infrastructure investment language continue to align across policy and official channels.",
      },
      {
        title: "Market framing",
        body: "Bond yields, oil sensitivity, AI capex, and earnings resilience dominate financial narrative — with growing references to volatility transmission.",
      },
      {
        title: "Infrastructure framing",
        body: "Grid strain, transmission delays, transformer shortages, and data-center load growth appear more often beside mainstream inflation and AI boom coverage.",
      },
    ],
  },
  {
    id: "ai-capability",
    slug: "ai-capability-acceleration-index",
    seoTitle: "AI Capability Acceleration Index",
    seoDescription:
      "Hourglass Ledger AI Capability Acceleration Index — analytical tracking of compute expansion, model capability, and infrastructure scaling.",
    displayTitle: "AI Capability Acceleration Index",
    subnavLabel: "AI Acceleration",
    hubDescription:
      "An analytical read on AI as industrial buildout — capability, deployment friction, and physical infrastructure constraints, without hype or fear framing.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A weekly index of how AI capability, deployment, and physical infrastructure move together: models, agents, enterprise integration, power, grid access, and organizational adaptation. The frame is operational and observational — not promotional.",
    updatedLabel: LEDGER_UPDATED,
    reading: 77,
    readingLabel: "Acceleration Reading",
    status: "Deployment-Bound Buildout",
    weeklyDelta: -1,
    scaleLabels: ["Early", "Building", "Rising", "Fast", "Surge"],
    scaleGradient: SCALE_GRADIENT_AI,
    summary:
      "Massive infrastructure investment and uneven enterprise adoption continue, with energy, cooling, transformers, and integration timelines increasingly co-equal with frontier model progress. Capability advances; deployment friction and physical constraints set pace.",
    summaryCompact:
      "Deployment-bound buildout — capability and infrastructure investment advance together under power, grid, and integration limits.",
    weeklyNote:
      "Infrastructure demand and enterprise friction tempered the headline score even as coding and selective agent workflows advanced. Power, cooling, and grid access are routine deployment limits alongside model releases.",
    weeklyNoteCompact:
      "Physical infrastructure and integration friction now share equal weight with frontier capability in the weekly read.",
    methodPills: [
      { label: "Reading Type", value: "Capability + infrastructure index" },
      { label: "Primary Drivers", value: "Deployment, power, integration" },
      { label: "Current Direction", value: "Advancing, constraint-bound" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 77, state: "Accelerating" },
      { week: "Last Week", degrees: 78, state: "Accelerating" },
      { week: "2 Weeks Ago", degrees: 80, state: "Fast" },
      { week: "3 Weeks Ago", degrees: 82, state: "Fast" },
    ],
    benchmarks: [
      { name: "Pre-Transformer", score: 38, note: "2017 era" },
      { name: "ChatGPT Launch", score: 62, note: "Late 2022" },
      { name: "Enterprise Wave", score: 71, note: "2024" },
      { name: "Capex Peak Cycle", score: 84, note: "Current" },
      { name: "Theoretical Max", score: 95, note: "Hypothetical" },
    ],
    editorialBlocks: [
      {
        title: "Infrastructure demand",
        body: "Data-center expansion, power contracts, cooling, and transformer lead times are central pressures — co-equal with software capability in deployment planning.",
      },
      {
        title: "Enterprise deployment",
        body: "Cautious acceleration in workflow augmentation and internal tooling; integration, review, and organizational adaptation lag broader capex narratives.",
      },
      {
        title: "Operational friction",
        body: "Agent reliability, verification layers, and governance gaps temper headline capability scores — especially outside coding and narrow workflows.",
      },
    ],
  },
  {
    id: "precious-materials",
    slug: "precious-materials-index",
    seoTitle: "Precious Materials Index",
    seoDescription:
      "Hourglass Ledger Precious Materials Index — elegant weekly intelligence on gold, platinum, diamonds, and the materials that shape fine jewelry markets.",
    displayTitle: "Precious Materials Index",
    subnavLabel: "Precious Materials",
    hubDescription:
      "Market pressure, metals map, diamond split, and jewelry demand — scored on a 0–100 scale for fine jewelry sourcing.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A weekly reading of the material conditions behind fine jewelry — gold, platinum, natural diamonds, and the sourcing realities that shape quality, availability, and long-term value. The purpose is not to chase commodity headlines. It is to clarify when material markets are firm, selective, or shifting beneath the surface.",
    updatedLabel: LEDGER_UPDATED,
    reading: 68,
    readingLabel: "Materials Reading",
    status: "Firm but Selective",
    weeklyDelta: 1,
    scaleLabels: ["Soft", "Stable", "Firm", "Tight", "Constrained"],
    scaleGradient: SCALE_GRADIENT_MATERIALS,
    summary:
      "Gold continues to hold structural support, platinum remains steady with measured industrial undertones, and natural diamonds stay bifurcated — exceptional stones firm in key categories, commercial ranges more price-sensitive. The environment rewards patience, provenance, and discernment over volume.",
    summaryLead: "Precious materials remain in a",
    summaryEmphasis: "firm but selective environment",
    summaryCompact:
      "Materials conditions remain firm and selective — favoring quality, provenance, and careful sourcing over broad accumulation.",
    weeklyNote:
      "The reading edged higher as gold held its range, rough flows remained disciplined, and premium natural diamonds showed continued resilience in well-cut, desirable sizes. Beneath that, mid-commercial grades remain cautious — where indiscriminate buying quickly erodes margin and long-term client trust.",
    weeklyNoteCompact:
      "Gold held range; premium natural categories remain resilient while mid-commercial grades stay selective.",
    methodPills: [
      { label: "Reading Type", value: "Materials + sourcing index" },
      { label: "Primary Focus", value: "Gold, platinum, diamonds" },
      { label: "Current Direction", value: "Firm and selective" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 68, state: "Firm" },
      { week: "Last Week", degrees: 67, state: "Firm" },
      { week: "2 Weeks Ago", degrees: 65, state: "Stable" },
      { week: "3 Weeks Ago", degrees: 64, state: "Stable" },
    ],
    benchmarks: [
      { name: "Quiet Wholesale", score: 45, note: "Buyer’s market" },
      { name: "Steady Luxury Cycle", score: 58, note: "Balanced" },
      { name: "Post-Crisis Recovery", score: 72, note: "2010–12" },
      { name: "Pandemic Disruption", score: 79, note: "2020–21" },
      { name: "Speculative Peak", score: 88, note: "Historical high" },
    ],
    editorialBlocks: [
      {
        title: "Gold & platinum",
        body: "Gold remains supported by macro uncertainty without dramatic volatility. Platinum is stable, with jewelry and industrial demand in balance.",
      },
      {
        title: "Natural diamonds",
        body: "Top-cut, well-proportioned stones in desirable sizes continue to perform. Commercial ranges require more careful selection and patient sourcing.",
      },
      {
        title: "Sourcing posture",
        body: "Long-term relationships and selective inventory remain preferable to reactive buying — particularly for engagement and heirloom-grade work.",
      },
    ],
  },
  {
    id: "infrastructure-strain",
    slug: "infrastructure-strain-index",
    seoTitle: "Infrastructure Strain Index",
    seoDescription:
      "Hourglass Ledger Infrastructure Strain Index — weekly reading of power, transmission, data centers, transformers, semiconductors, labor, and logistics constraints.",
    displayTitle: "Infrastructure Strain Index",
    subnavLabel: "Infrastructure",
    hubDescription:
      "A weekly reading of physical constraints in a capacity expansion race — power, grid, data centers, transformers, chips, labor, and water.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A weekly reading of physical constraints beneath digital and industrial acceleration: AI data-center load, power demand, transformers, interconnection, cooling, transmission, labor, and permitting — where systems function but flexibility narrows.",
    updatedLabel: LEDGER_UPDATED,
    reading: 80,
    readingLabel: "Infrastructure Strain",
    status: "Elevated Strain",
    weeklyDelta: 1,
    scaleLabels: ["Low", "Rising", "Elevated", "High", "Critical"],
    scaleGradient: SCALE_GRADIENT_INFRASTRUCTURE,
    summary:
      "Strain remains elevated but orderly — a capacity expansion race with uneven buildout timing. AI data-center growth, grid bottlenecks, transformer lead times, and cooling constraints persist beneath rapid capital deployment. The system functions; spare capacity and flexibility are narrowing.",
    summaryCompact:
      "Elevated physical strain — data-center power demand, grid bottlenecks, and transformer supply define the pace of expansion.",
    weeklyNote:
      "Data-center power demand, regional grid bottlenecks, utility timelines, transformer manufacturing, cooling infrastructure, and electrical labor availability remain the active watch set — capital ahead of many physical upgrade paths.",
    weeklyNoteCompact:
      "Persistent bottlenecks beneath rapid capex — power, grid, transformers, and cooling setting practical pace.",
    methodPills: [
      { label: "Reading Type", value: "Physical infrastructure index" },
      { label: "Primary Focus", value: "Power, grid, data centers" },
      { label: "Current Direction", value: "Elevated, expansion-bound" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 80, state: "Elevated" },
      { week: "Last Week", degrees: 79, state: "Elevated" },
      { week: "2 Weeks Ago", degrees: 81, state: "Elevated" },
      { week: "3 Weeks Ago", degrees: 82, state: "Elevated" },
    ],
    benchmarks: [
      { name: "Stable Buildout", score: 45, note: "Low constraint", tier: "quiet" },
      { name: "Post-Covid Construction Cycle", score: 68, note: "Supply tightness", tier: "mid" },
      { name: "Energy Crunch", score: 84, note: "Europe 2022", tier: "high" },
      { name: "Supply Chain Shock", score: 88, note: "2020–21", tier: "high" },
      { name: "Wartime Industrial Surge", score: 91, note: "Forced capacity", tier: "high" },
    ],
    editorialBlocks: [
      {
        title: "Data-center power demand",
        body: "Hyperscale load growth and power access as a strategic constraint — cooling and utility coordination shaping siting.",
      },
      {
        title: "Grid & transmission",
        body: "Interconnection queues, transmission delays, and regional bottlenecks where load clusters outpace upgrade timelines.",
      },
      {
        title: "Transformer & labor",
        body: "Manufacturing lead times and electrical trade availability — competing demand from utilities and hyperscalers.",
      },
      {
        title: "Cooling & water",
        body: "Rising relevance in site selection and community discussion — uneven by region, increasingly material to expansion plans.",
      },
    ],
    watchingSectionTitle: "What We're Watching",
  },
] as const;

export function getLedgerIndex(id: LedgerIndexId): LedgerIndexDefinition {
  const index = LEDGER_INDEXES.find((entry) => entry.id === id);
  if (!index) {
    throw new Error(`Unknown ledger index: ${id}`);
  }
  return index;
}

export function getLedgerIndexBySlug(slug: string): LedgerIndexDefinition | undefined {
  return LEDGER_INDEXES.find((entry) => entry.slug === slug);
}

export const LEDGER_HUB_INDEXES = LEDGER_INDEXES;

/** @deprecated Use ledger-data — re-exports for gradual migration */
export const GLOBAL_PRESSURE_INDEX = getLedgerIndex("global-pressure").reading;
export const PRESSURE_STATUS = getLedgerIndex("global-pressure").status;
export const WEEKLY_DELTA = getLedgerIndex("global-pressure").weeklyDelta;
export const GPI_UPDATED_LABEL = LEDGER_UPDATED;
export const GPI_SCALE_LABELS = getLedgerIndex("global-pressure").scaleLabels;
export const GPI_SCALE_GRADIENT = getLedgerIndex("global-pressure").scaleGradient;
export const GPI_SUMMARY = getLedgerIndex("global-pressure").summary;
export const GPI_SUMMARY_COMPACT = getLedgerIndex("global-pressure").summaryCompact;
export const GPI_WEEKLY_NOTE_BODY = getLedgerIndex("global-pressure").weeklyNote;
export const GPI_INTRO = getLedgerIndex("global-pressure").intro;
export const GPI_METHOD_PILLS = getLedgerIndex("global-pressure").methodPills;
export const GPI_RECENT_READINGS = getLedgerIndex("global-pressure").recentReadings;
export const GPI_BENCHMARKS = getLedgerIndex("global-pressure").benchmarks ?? [];

export const QUIET_METRICS = [
  {
    label: "Energy Pressure",
    value: "Elevated",
    note: "Fuel, power, and grid-adjacent stress remain above seasonal norms.",
  },
  {
    label: "AI Compute Load",
    value: "Rising",
    note: "Data-center expansion continues to pull on electricity and cooling capacity.",
  },
  {
    label: "Financial Sensitivity",
    value: "Tight",
    note: "Rates, liquidity, and risk appetite remain finely balanced.",
  },
] as const;

export const TRACK_TOPICS = [
  {
    title: "Energy",
    description:
      "Power markets, fuel flows, and the physical constraints behind reliable supply.",
  },
  {
    title: "Infrastructure",
    description:
      "Grids, transport, construction cycles, and the systems that connect economies.",
  },
  {
    title: "AI + Compute",
    description:
      "Data centers, semiconductors, cooling, and the infrastructure behind intelligence.",
  },
  {
    title: "Commodities",
    description:
      "Materials, agriculture, metals, and the inputs that shape industrial capacity.",
  },
  {
    title: "Financial Conditions",
    description:
      "Rates, credit, liquidity, and the sensitivity of markets to policy and sentiment.",
  },
  {
    title: "Geopolitics",
    description:
      "Trade, security, and friction between regions — without amplifying noise.",
  },
] as const;
