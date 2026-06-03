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

export const LEDGER_UPDATED = "Updated weekly — June 2, 2026";

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
    reading: 91,
    readingLabel: "Pressure Reading",
    status: "Persistent Elevated Pressure",
    weeklyDelta: 1,
    scaleLabels: ["Cold", "Stable", "Elevated", "Hot", "Critical"],
    scaleGradient: SCALE_GRADIENT_PRESSURE,
    summary:
      "Pressure remains elevated across energy, shipping, inflation sensitivity, bond markets, infrastructure, and AI-related capital deployment — but markets continue to adapt. The emphasis is shifting toward persistent elevated pressure with growing physical constraints beneath resilient markets: power availability, transmission, cooling, and deployment capacity increasingly define how quickly expansion can proceed.",
    summaryLead: "The system remains in a",
    summaryEmphasis: "persistent elevated pressure environment",
    summaryCompact:
      "Persistent elevated pressure — resilient markets above, with growing physical constraints in power, transmission, cooling, and deployment setting practical pace.",
    weeklyNote:
      "Energy sensitivity, shipping-route friction, and bond-market brittleness remained visible, while infrastructure-adjacent load — transformers, grid interconnection, data-center power, and electrical labor — gained weight in the read. Markets held resilient and adaptation continued; conditions stayed elevated rather than disorder-level. The signal is narrowing flexibility through physical capacity limits, not imminent dislocation.",
    weeklyNoteCompact:
      "Elevated pressure persists beneath resilient markets — physical constraints in power, grid, transmission, and deployment increasingly define pace.",
    methodPills: [
      { label: "Reading Type", value: "Weighted editorial index" },
      { label: "Primary Drivers", value: "Energy, infrastructure, deployment" },
      { label: "Current Direction", value: "Elevated, capacity-bound" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 91, state: "Elevated" },
      { week: "Last Week", degrees: 90, state: "Elevated" },
      { week: "2 Weeks Ago", degrees: 89, state: "Elevated" },
      { week: "3 Weeks Ago", degrees: 87, state: "Elevated" },
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
        body: "Energy sensitivity and shipping-route friction remain active transmission channels. Coordination strain persists without implying breakdown — adaptation continues beneath elevated conditions.",
      },
      {
        title: "Power, grid & transmission",
        body: "Electricity demand, data-center load, transformer constraints, interconnection delays, and transmission limits are increasingly the bottleneck layer — compressing flexibility while systems continue to function.",
      },
      {
        title: "Markets & deployment capacity",
        body: "Bond-market sensitivity and inflation persistence keep policy room narrow. Market resilience and AI capital expenditure continue, but deployment, permitting, and physical buildout increasingly set how quickly expansion converts to capacity.",
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
    reading: 81,
    readingLabel: "Signal Clarity",
    status: "Converging Narratives",
    weeklyDelta: 2,
    scaleLabels: ["Quiet", "Clear", "Mixed", "Noisy", "Saturated"],
    scaleGradient: SCALE_GRADIENT_SIGNAL,
    summary:
      "Narrative convergence increased: AI infrastructure, power demand, grid limitations, transmission, cooling, and industrial capacity are increasingly discussed together across institutional, market, and infrastructure sources. Disagreement focuses on tempo and sequencing — not whether physical constraints exist beneath resilient markets.",
    summaryCompact:
      "Rising signal clarity as channels converge on AI infrastructure, power demand, grid limits, transmission, cooling, and industrial capacity beneath market resilience.",
    weeklyNote:
      "Institutional, market, infrastructure, and mainstream coverage linked AI scaling more explicitly to power, cooling, transmission, and deployment timelines. Industrial capacity and labor availability appeared more often beside inflation and earnings-resilience commentary. Convergence is observational — shared vocabulary across layers, not hidden-truth framing.",
    weeklyNoteCompact:
      "Narratives converging on physical capacity — AI infrastructure, power, grid, transmission, and cooling discussed together more often.",
    methodPills: [
      { label: "Reading Type", value: "Editorial signal map" },
      { label: "Primary Channels", value: "Institutional, market, infrastructure, mainstream" },
      { label: "Current Direction", value: "Converging, capacity-focused" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 81, state: "Clear" },
      { week: "Last Week", degrees: 79, state: "Clear" },
      { week: "2 Weeks Ago", degrees: 77, state: "Mixed" },
      { week: "3 Weeks Ago", degrees: 75, state: "Mixed" },
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
        body: "Infrastructure investment, energy security, grid modernization, and deployment timelines align across policy channels — measured language emphasizing capacity buildout over alarm.",
      },
      {
        title: "Market framing",
        body: "AI capex, power demand, transmission constraints, and earnings resilience dominate financial narrative — with growing linkage between compute expansion and physical infrastructure limits.",
      },
      {
        title: "Infrastructure framing",
        body: "Grid strain, transmission delays, transformer shortages, cooling requirements, and industrial capacity appear more frequently as co-equal themes in specialist and mainstream coverage.",
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
    reading: 79,
    readingLabel: "Acceleration Reading",
    status: "Industrial Deployment Under Constraint",
    weeklyDelta: 2,
    scaleLabels: ["Early", "Building", "Rising", "Fast", "Surge"],
    scaleGradient: SCALE_GRADIENT_AI,
    summary:
      "No singular breakthrough occurred. Acceleration continues through deployment, integration, enterprise adoption, workflow dependence, coding systems, and infrastructure investment. The story continues shifting from capability toward implementation — industrial deployment under infrastructure constraint.",
    summaryCompact:
      "Industrial deployment under infrastructure constraint — capability advances through integration and adoption, with power, grid, and cooling setting practical pace.",
    weeklyNote:
      "Enterprise adoption, coding-system integration, and workflow dependence advanced without frontier-model surprise. Power contracts, grid access, cooling, transformer lead times, and organizational adaptation remain co-equal limits on deployment — discussed alongside capability, not beneath it.",
    weeklyNoteCompact:
      "Deployment and integration advance under infrastructure constraint — power, grid, and organizational adoption setting pace alongside capability.",
    methodPills: [
      { label: "Reading Type", value: "Capability + infrastructure index" },
      { label: "Primary Drivers", value: "Deployment, integration, infrastructure" },
      { label: "Current Direction", value: "Advancing, capacity-bound" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 79, state: "Accelerating" },
      { week: "Last Week", degrees: 77, state: "Accelerating" },
      { week: "2 Weeks Ago", degrees: 78, state: "Accelerating" },
      { week: "3 Weeks Ago", degrees: 80, state: "Fast" },
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
        title: "Infrastructure requirements",
        body: "Data-center expansion, power contracts, cooling, transformer lead times, and grid interconnection are central deployment variables — co-equal with software capability in expansion planning.",
      },
      {
        title: "Enterprise adoption",
        body: "Workflow dependence and internal tooling expand cautiously — integration, review layers, and organizational adaptation increasingly define practical gains over frontier releases.",
      },
      {
        title: "Deployment & integration",
        body: "Coding systems and selective agent workflows advance in production environments, but verification, governance, and physical capacity limits temper headline acceleration.",
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
    reading: 83,
    readingLabel: "Materials Reading",
    status: "Elevated but Segmented",
    weeklyDelta: -3,
    scaleLabels: ["Soft", "Stable", "Firm", "Tight", "Constrained"],
    scaleGradient: SCALE_GRADIENT_MATERIALS,
    summary:
      "Material conditions remain elevated but orderly and segmented — premium natural resilience in key categories, commercial softness in mid-tier ranges, continued lab-grown compression, and bifurcated luxury demand. Gold holds structural support without dramatic volatility; sourcing discipline matters more than broad accumulation.",
    summaryLead: "Precious materials remain in an",
    summaryEmphasis: "elevated but segmented environment",
    summaryCompact:
      "Elevated but segmented — premium natural holds firm, commercial ranges stay selective, with sourcing discipline over broad stress.",
    weeklyNote:
      "The reading eased as nothing this week supported broad market stress. Premium natural categories remained resilient in well-cut, desirable sizes; commercial ranges stayed price-sensitive; lab-grown compression continued in mid-tier channels. Infrastructure and electrification metals demand adds industrial context without elevating jewelry-market alarm.",
    weeklyNoteCompact:
      "Elevated but segmented — premium natural resilient, commercial selective, lab-grown compression ongoing.",
    methodPills: [
      { label: "Reading Type", value: "Materials + sourcing index" },
      { label: "Primary Focus", value: "Gold, platinum, diamonds" },
      { label: "Current Direction", value: "Elevated, segmented" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 83, state: "Firm" },
      { week: "Last Week", degrees: 86, state: "Firm" },
      { week: "2 Weeks Ago", degrees: 87, state: "Firm" },
      { week: "3 Weeks Ago", degrees: 86, state: "Firm" },
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
        body: "Gold holds elevated but orderly support — macro uncertainty without dramatic volatility. Platinum remains steady, with jewelry demand and industrial electrification undertones in balance.",
      },
      {
        title: "Natural diamonds",
        body: "Premium natural categories remain resilient in key sizes and cuts. Commercial ranges stay price-sensitive — luxury demand segmentation is the defining feature, not broad market stress.",
      },
      {
        title: "Sourcing posture",
        body: "Provenance, selective inventory, and patient sourcing remain preferable to reactive buying — particularly for engagement and heirloom-grade work where commercial softness does not translate to premium weakness.",
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
    reading: 82,
    readingLabel: "Infrastructure Strain",
    status: "Elevated Strain",
    weeklyDelta: 2,
    scaleLabels: ["Low", "Rising", "Elevated", "High", "Critical"],
    scaleGradient: SCALE_GRADIENT_INFRASTRUCTURE,
    summary:
      "Strain remains elevated but orderly — a capacity expansion race, not a failure scenario. Transformer constraints, utility bottlenecks, grid interconnection delays, electrical labor shortages, cooling requirements, transmission expansion, and data-center power demand continue accumulating. The system functions; spare capacity and flexibility narrow.",
    summaryCompact:
      "Elevated strain in a capacity expansion race — power availability, transformers, transmission, and labor setting buildout pace beneath functioning systems.",
    weeklyNote:
      "Power availability, transformer manufacturing lead times, utility responsiveness, transmission capacity, and electrical labor availability gained emphasis in the read. Data-center load growth and cooling requirements remain active, but capital continues deploying — physical coordination increasingly defines how quickly expansion converts to energized capacity.",
    weeklyNoteCompact:
      "Capacity expansion race — power, transformers, transmission, and labor increasingly define pace beneath rapid capex.",
    methodPills: [
      { label: "Reading Type", value: "Physical infrastructure index" },
      { label: "Primary Focus", value: "Power, grid, transmission, labor" },
      { label: "Current Direction", value: "Elevated, expansion-bound" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 82, state: "Elevated" },
      { week: "Last Week", degrees: 80, state: "Elevated" },
      { week: "2 Weeks Ago", degrees: 79, state: "Elevated" },
      { week: "3 Weeks Ago", degrees: 81, state: "Elevated" },
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
        title: "Power availability",
        body: "Data-center load growth and large-load interconnection requests make power access a strategic constraint — utility responsiveness and regional availability shaping siting and timelines.",
      },
      {
        title: "Transformers & transmission",
        body: "Manufacturing lead times and transmission expansion lag remain core strain points — utilities and hyperscalers competing for large-unit capacity and grid upgrade paths.",
      },
      {
        title: "Labor & utility coordination",
        body: "Electrical trade availability and utility processing timelines translate capital plans into energized capacity — the practical limit on how fast buildout proceeds.",
      },
      {
        title: "Cooling & water",
        body: "Cooling requirements and regional water pressure increasingly factor in site selection — uneven by geography, but rising in importance as power density grows.",
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
    note: "Fuel, power, and grid-adjacent conditions remain above seasonal norms — with deployment capacity increasingly defining pace.",
  },
  {
    label: "AI Compute Load",
    value: "Rising",
    note: "Data-center expansion continues to pull on electricity, cooling, and transmission capacity.",
  },
  {
    label: "Physical Constraints",
    value: "Narrowing",
    note: "Transformers, labor, permitting, and utility timelines increasingly limit how quickly expansion converts to capacity.",
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
