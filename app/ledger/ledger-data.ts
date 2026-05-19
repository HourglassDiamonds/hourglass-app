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
      "A composite degree reading across energy, infrastructure, financial conditions, and geopolitical channels.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A weekly reading of global pressure across geopolitics, energy, commodities, financial conditions, infrastructure, supply chains, food systems, and public stability. The purpose is not to predict a crisis. It is to show when multiple systems are heating up at the same time.",
    updatedLabel: LEDGER_UPDATED,
    reading: 93,
    readingLabel: "Pressure Reading",
    status: "Critical Threshold",
    weeklyDelta: 2,
    scaleLabels: ["Cold", "Stable", "Elevated", "Hot", "Critical"],
    scaleGradient: SCALE_GRADIENT_PRESSURE,
    summary:
      "Energy markets, Gulf shipping disruption, inflation sensitivity, rate expectations, grid strain, and supply-chain rerouting are now moving together rather than separately. This is not yet a full disorder reading, but the buffer between stress and shock has narrowed again.",
    summaryLead: "The system remains in a",
    summaryEmphasis: "critical threshold environment",
    summaryCompact:
      "Pressure remains in a critical threshold environment across energy, shipping, grid strain, and financial sensitivity — with multiple systems heating up together.",
    weeklyNote:
      "The reading moved higher because energy disruption risk stayed elevated, tanker markets remained strained, and oil-linked inflation pressure became more visible in global economic data. Beneath that, the slower infrastructure story continues to matter: electricity demand, data-center load, transformer constraints, and grid bottlenecks are reducing system flexibility heading into summer.",
    weeklyNoteCompact:
      "Energy disruption risk, tanker strain, and grid-adjacent load continue to move in the same direction.",
    methodPills: [
      { label: "Reading Type", value: "Weighted editorial index" },
      { label: "Primary Drivers", value: "Energy, shipping, grid strain" },
      { label: "Current Direction", value: "Critical and rising" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 93, state: "Critical" },
      { week: "Last Week", degrees: 91, state: "Critical" },
      { week: "2 Weeks Ago", degrees: 88, state: "High Heat" },
      { week: "3 Weeks Ago", degrees: 85, state: "High Heat" },
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
        body: "Oil-route risk, tanker markets, and Gulf shipping pressure remain the most immediate accelerants.",
      },
      {
        title: "Grid & infrastructure strain",
        body: "Data-center load, transformer constraints, and summer electricity demand continue reducing system flexibility.",
      },
      {
        title: "Financial conditions",
        body: "Higher energy prices and sticky inflation can narrow the room for rate cuts and increase market sensitivity.",
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
      "A narrative layer reading on how information velocity, rhetoric, and institutional messaging shape perception and decision-making.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A weekly map of how information moves through markets, media, policy, and institutions — not to chase headlines, but to understand when narrative density begins to outrun clarity. The goal is orientation: where signal is thinning and where noise is thickening.",
    updatedLabel: LEDGER_UPDATED,
    reading: 74,
    readingLabel: "Signal Density",
    status: "Elevated Narrative Load",
    weeklyDelta: 3,
    scaleLabels: ["Quiet", "Clear", "Mixed", "Noisy", "Saturated"],
    scaleGradient: SCALE_GRADIENT_SIGNAL,
    summary:
      "Information velocity remains elevated without reaching full saturation. Policy rhetoric, market commentary, and geopolitical framing are overlapping more frequently, which makes discrete events harder to interpret in isolation. The environment favors reaction before reflection — but has not yet crossed into disorder.",
    summaryCompact:
      "Narrative density is elevated across policy, markets, and media — increasing the cost of clear interpretation without full information overload.",
    weeklyNote:
      "The map moved higher as institutional messaging around energy, rates, and security converged in the same news cycle. Social and financial channels amplified the overlap, even where underlying fundamentals changed more slowly.",
    weeklyNoteCompact:
      "Policy, market, and media channels overlapped more than usual this week — thickening the narrative layer.",
    methodPills: [
      { label: "Reading Type", value: "Editorial signal map" },
      { label: "Primary Channels", value: "Policy, markets, media" },
      { label: "Current Direction", value: "Elevated and widening" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 74, state: "Elevated" },
      { week: "Last Week", degrees: 71, state: "Elevated" },
      { week: "2 Weeks Ago", degrees: 68, state: "Mixed" },
      { week: "3 Weeks Ago", degrees: 66, state: "Mixed" },
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
        title: "Institutional messaging",
        body: "Central banks, energy ministries, and defense-adjacent statements are arriving in closer sequence. The tone is measured, but the volume is rising.",
      },
      {
        title: "Market narrative",
        body: "Equity and commodity commentary is leaning on the same macro themes — rates, energy, and AI capex — which compresses independent analysis into a narrower band.",
      },
      {
        title: "Media velocity",
        body: "Headline cadence around shipping, inflation, and technology regulation remains above the seasonal norm, without a single dominant crisis narrative.",
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
      "An analytical read on how quickly AI capability, compute capacity, and infrastructure are scaling — without hype or fear framing.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A weekly index of how artificial intelligence capability is accelerating in the real world: semiconductors, data centers, model performance, enterprise adoption, and the physical infrastructure required to sustain growth. The frame is observational — not promotional.",
    updatedLabel: LEDGER_UPDATED,
    reading: 81,
    readingLabel: "Acceleration Reading",
    status: "Sustained Acceleration",
    weeklyDelta: 4,
    scaleLabels: ["Early", "Building", "Rising", "Fast", "Surge"],
    scaleGradient: SCALE_GRADIENT_AI,
    summary:
      "Capability expansion continues at a steady, infrastructure-bound pace. Model performance improvements remain visible, but the binding constraints are increasingly physical: power, cooling, chips, and interconnection timelines. Acceleration is real — yet still governed by capital cycles and grid reality.",
    summaryCompact:
      "AI capability continues to accelerate, with infrastructure and power emerging as the primary constraints on pace.",
    weeklyNote:
      "The index rose as hyperscaler capex guidance, chip lead times, and regional grid interconnection queues all pointed in the same direction. Software capability is not the limiting factor this quarter — physical capacity is.",
    weeklyNoteCompact:
      "Capex, chip supply, and grid queues continue to define the pace of expansion.",
    methodPills: [
      { label: "Reading Type", value: "Capability + infrastructure index" },
      { label: "Primary Drivers", value: "Compute, power, semiconductors" },
      { label: "Current Direction", value: "Accelerating steadily" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 81, state: "Accelerating" },
      { week: "Last Week", degrees: 77, state: "Accelerating" },
      { week: "2 Weeks Ago", degrees: 74, state: "Rising" },
      { week: "3 Weeks Ago", degrees: 71, state: "Rising" },
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
        title: "Compute & semiconductors",
        body: "Advanced packaging and high-bandwidth memory remain allocation-sensitive. Lead times are stable but extended.",
      },
      {
        title: "Data-center buildout",
        body: "New capacity announcements continue across North America and selective international corridors, with power economics driving site selection.",
      },
      {
        title: "Grid & energy coupling",
        body: "Interconnection delays and transformer bottlenecks are now routine discussion points in infrastructure planning — not edge cases.",
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
      "A weekly reading of physical constraints beneath digital, economic, and industrial acceleration — power, grid, data centers, transformers, chips, labor, and water.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A weekly reading of the physical constraints beneath digital, economic, and industrial acceleration: power, transmission, transformers, data centers, water, skilled labor, semiconductors, and logistics.",
    updatedLabel: LEDGER_UPDATED,
    reading: 82,
    readingLabel: "Infrastructure Strain",
    status: "Elevated Strain",
    weeklyDelta: 4,
    scaleLabels: ["Low", "Rising", "Elevated", "High", "Critical"],
    scaleGradient: SCALE_GRADIENT_INFRASTRUCTURE,
    summary:
      "The physical layer of the system is under elevated strain. AI data-center expansion, grid interconnection delays, transformer shortages, cooling demand, semiconductor bottlenecks, and skilled labor constraints are reinforcing one another.",
    summaryCompact:
      "Physical infrastructure strain is elevated — data centers, grid interconnection, and transformer supply are the strongest pressure points.",
    weeklyNote:
      "Data-center power demand, transformer lead times, grid labor shortages, and cooling requirements are now appearing together in infrastructure reporting.",
    weeklyNoteCompact:
      "Data-center load, transformer lead times, and grid labor constraints are reinforcing physical bottlenecks.",
    methodPills: [
      { label: "Reading Type", value: "Physical infrastructure index" },
      { label: "Primary Focus", value: "Grid, data centers, supply" },
      { label: "Current Direction", value: "Elevated strain" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 82, state: "Elevated" },
      { week: "Last Week", degrees: 78, state: "Elevated" },
      { week: "2 Weeks Ago", degrees: 75, state: "Rising" },
      { week: "3 Weeks Ago", degrees: 72, state: "Rising" },
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
        title: "Power interconnection",
        body: "Large-load connection timelines, utility approval delays, substation availability, and queue congestion.",
      },
      {
        title: "Transformer lead times",
        body: "Whether transformer manufacturing capacity improves quickly enough to support grid, industrial, and data-center expansion.",
      },
      {
        title: "Data-center concentration",
        body: "Regional clustering of hyperscale demand in areas where water, power, and transmission capacity are already tight.",
      },
      {
        title: "Skilled labor availability",
        body: "Electricians, linemen, engineers, and industrial construction crews remain essential to translating capital plans into real capacity.",
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
