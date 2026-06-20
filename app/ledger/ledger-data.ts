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

export const LEDGER_UPDATED = "Updated weekly — June 20, 2026";

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
    status: "Elevated With Surface Relief",
    weeklyDelta: -1,
    scaleLabels: ["Cold", "Stable", "Elevated", "Hot", "Critical"],
    scaleGradient: SCALE_GRADIENT_PRESSURE,
    summary:
      "Acute energy shock cooled after ceasefire progress around Hormuz, but structural pressure remains high. Shipping normalization is uneven, Russia energy-sanctions pressure is returning, and physical constraints in power, grid, and deployment continue beneath still-resilient markets.",
    summaryLead: "The system remains in an",
    summaryEmphasis: "elevated but unevenly easing environment",
    summaryCompact:
      "Markets and energy routes cooled after ceasefire progress, but the underlying system remains tense. Shipping normalization is uneven, sanctions pressure is shifting back toward Russia, World Cup logistics are testing local infrastructure, and AI demand continues moving from software acceleration into power and grid constraints.",
    weeklyNote:
      "G7 leaders backed renewed pressure on Russia's war economy while supporting the U.S.-Iran framework around Hormuz. Energy pressure eased, but Hormuz traffic remains uneven — subject to routing, permit, insurance, and security questions. Russia sanctions pressure is shifting back into focus after the Middle East relief trade. Markets held resilient; conditions stayed elevated rather than disorder-level.",
    weeklyNoteCompact:
      "Surface relief after Hormuz ceasefire progress — uneven shipping normalization, returning Russia sanctions pressure, and persistent physical constraints beneath resilient markets.",
    methodPills: [
      { label: "Reading Type", value: "Weighted editorial index" },
      { label: "Primary Drivers", value: "Energy, shipping, sanctions" },
      { label: "Current Direction", value: "Elevated, uneven relief" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 90, state: "Elevated" },
      { week: "Last Week", degrees: 91, state: "Elevated" },
      { week: "2 Weeks Ago", degrees: 90, state: "Elevated" },
      { week: "3 Weeks Ago", degrees: 89, state: "Elevated" },
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
        title: "Hormuz & shipping corridors",
        body: "Energy pressure eased after ceasefire progress, but Hormuz traffic remains uneven — subject to routing, permit, insurance, and security questions. Normalization is incomplete; adaptation continues beneath elevated conditions.",
      },
      {
        title: "Russia sanctions & energy flows",
        body: "G7 leaders backed renewed pressure on Russia's war economy. Whether sanctions tighten oil and gas flows again after the Middle East relief trade is an active transmission channel.",
      },
      {
        title: "Markets & physical constraints",
        body: "Bond-market sensitivity and inflation persistence keep policy room narrow. Market resilience continues, but AI power demand and grid constraints increasingly set how quickly expansion converts to capacity.",
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
    reading: 84,
    readingLabel: "Signal Clarity",
    status: "High-Attention Environment",
    weeklyDelta: 3,
    scaleLabels: ["Quiet", "Clear", "Mixed", "Noisy", "Saturated"],
    scaleGradient: SCALE_GRADIENT_SIGNAL,
    summary:
      "The World Cup created a high-attention environment for fraud, misinformation, and scams — amplified by AI-generated content and social engineering. Institutional, market, and infrastructure channels continue converging on physical-capacity themes, but information integrity strain rose alongside event logistics and geopolitical relief narratives.",
    summaryCompact:
      "High-attention information environment — World Cup fraud and misinformation risk alongside converging narratives on energy relief, sanctions, and infrastructure strain.",
    weeklyNote:
      "World Cup coverage shifted from sports into transportation, security, weather response, and information integrity — creating fertile ground for scams and AI-generated content. Institutional and market channels linked Hormuz relief, Russia sanctions, and AI power demand in the same coverage cycle. Convergence is observational — shared vocabulary across layers, not hidden-truth framing.",
    weeklyNoteCompact:
      "World Cup elevated fraud and misinformation risk — geopolitical relief and infrastructure strain discussed together across channels.",
    methodPills: [
      { label: "Reading Type", value: "Editorial signal map" },
      { label: "Primary Channels", value: "Institutional, market, event, mainstream" },
      { label: "Current Direction", value: "Noisy, high-attention" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 84, state: "Mixed" },
      { week: "Last Week", degrees: 81, state: "Clear" },
      { week: "2 Weeks Ago", degrees: 79, state: "Clear" },
      { week: "3 Weeks Ago", degrees: 77, state: "Mixed" },
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
        title: "Event-driven noise",
        body: "World Cup logistics created a high-attention environment — transportation, security, weather response, and information integrity tested simultaneously, with fraud and scam activity amplified by AI-generated content.",
      },
      {
        title: "Geopolitical framing",
        body: "Hormuz ceasefire relief and renewed Russia sanctions pressure appeared in the same coverage cycle — institutional language emphasizing coordination over alarm, with uneven agreement on tempo.",
      },
      {
        title: "Infrastructure framing",
        body: "AI power demand, grid constraints, and data-center siting pressure continue gaining weight in specialist and mainstream coverage — linked more often to deployment limits than software capability alone.",
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
    reading: 82,
    readingLabel: "Acceleration Reading",
    status: "Power- and Grid-Bound Acceleration",
    weeklyDelta: 3,
    scaleLabels: ["Early", "Building", "Rising", "Fast", "Surge"],
    scaleGradient: SCALE_GRADIENT_AI,
    summary:
      "AI acceleration is increasingly limited by power, grid access, and compute infrastructure rather than model interest alone. Capability and deployment continue advancing, but site selection, utility responsiveness, and energized capacity increasingly set practical pace.",
    summaryCompact:
      "Power- and grid-bound acceleration — capability advances through integration and adoption, with utility, grid, and site-selection constraints setting practical pace.",
    weeklyNote:
      "AI infrastructure pressure moved from abstract compute demand into concrete power, grid, and site-selection constraints. Enterprise adoption and coding-system integration advanced without frontier-model surprise. Power contracts, grid access, cooling, and transformer lead times remain co-equal limits on deployment — discussed alongside capability, not beneath it.",
    weeklyNoteCompact:
      "Acceleration increasingly grid-bound — power, utility responsiveness, and site selection setting pace alongside capability.",
    methodPills: [
      { label: "Reading Type", value: "Capability + infrastructure index" },
      { label: "Primary Drivers", value: "Power, grid, deployment" },
      { label: "Current Direction", value: "Advancing, grid-bound" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 82, state: "Accelerating" },
      { week: "Last Week", degrees: 79, state: "Accelerating" },
      { week: "2 Weeks Ago", degrees: 77, state: "Accelerating" },
      { week: "3 Weeks Ago", degrees: 78, state: "Accelerating" },
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
        title: "Power & grid constraints",
        body: "Data-center expansion, power contracts, utility responsiveness, and grid interconnection are increasingly the pace-setting layer — co-equal with software capability in expansion planning.",
      },
      {
        title: "Enterprise adoption",
        body: "Workflow dependence and internal tooling expand cautiously — integration, review layers, and organizational adaptation increasingly define practical gains over frontier releases.",
      },
      {
        title: "Site selection & deployment",
        body: "Cooling, transformer lead times, and regional power availability shape siting decisions — capital deploys, but energized capacity converts more slowly than software timelines suggest.",
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
    reading: 85,
    readingLabel: "Materials Reading",
    status: "Strategically Firm",
    weeklyDelta: 2,
    scaleLabels: ["Soft", "Stable", "Firm", "Tight", "Constrained"],
    scaleGradient: SCALE_GRADIENT_MATERIALS,
    summary:
      "Precious materials remain strategically elevated — gold supported by central-bank reserve behavior, precious metals hold firm, and diamonds enter a supply-structure reset. Premium natural categories remain resilient; commercial ranges stay selective.",
    summaryLead: "Precious materials remain in a",
    summaryEmphasis: "strategically firm environment",
    summaryCompact:
      "Strategically firm — gold supported by central-bank demand, diamonds in supply-structure reset, premium natural resilient with commercial ranges selective.",
    weeklyNote:
      "Gold remained supported by central-bank reserve behavior; precious metals held elevated without dramatic volatility. Natural diamonds entered a supply-structure reset — premium categories resilient in well-cut, desirable sizes; commercial ranges stayed price-sensitive. Lab-grown compression continued in mid-tier channels without elevating broad market alarm.",
    weeklyNoteCompact:
      "Strategically firm — central-bank gold support, diamond supply-structure reset, premium natural resilient.",
    methodPills: [
      { label: "Reading Type", value: "Materials + sourcing index" },
      { label: "Primary Focus", value: "Gold, platinum, diamonds" },
      { label: "Current Direction", value: "Firm, strategically elevated" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 85, state: "Firm" },
      { week: "Last Week", degrees: 83, state: "Firm" },
      { week: "2 Weeks Ago", degrees: 86, state: "Firm" },
      { week: "3 Weeks Ago", degrees: 87, state: "Firm" },
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
        title: "Gold & central-bank demand",
        body: "Gold holds strategically elevated support — central-bank reserve behavior and macro uncertainty without dramatic volatility. Scarcity and reserve-asset behavior matter more than luxury cyclicality.",
      },
      {
        title: "Natural diamonds",
        body: "Diamonds enter a supply-structure reset — premium natural categories remain resilient in key sizes and cuts. Commercial ranges stay price-sensitive; the defining feature is structural tightening, not broad market stress.",
      },
      {
        title: "Sourcing posture",
        body: "Provenance, selective inventory, and patient sourcing remain preferable to reactive buying — particularly for engagement and heirloom-grade work where high-quality natural stones behave as scarcity assets.",
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
    reading: 85,
    readingLabel: "Infrastructure Strain",
    status: "Elevated Strain",
    weeklyDelta: 3,
    scaleLabels: ["Low", "Rising", "Elevated", "High", "Critical"],
    scaleGradient: SCALE_GRADIENT_INFRASTRUCTURE,
    summary:
      "Strain rose as World Cup logistics, Hormuz routing friction, and AI data-center power demand tested physical systems simultaneously. Transformer constraints, grid interconnection delays, and electrical labor shortages continue accumulating — the system functions, but spare capacity and flexibility narrow.",
    summaryCompact:
      "Elevated strain — World Cup transit and security, Hormuz routing friction, and AI grid demand testing infrastructure beneath functioning systems.",
    weeklyNote:
      "World Cup host cities became a live test of transportation, security, weather response, and information integrity. Hormuz routing friction added shipping-layer strain alongside uneven normalization. AI data-center power demand continued raising utility, grid, and siting pressure — physical coordination increasingly defines how quickly expansion converts to energized capacity.",
    weeklyNoteCompact:
      "World Cup logistics, Hormuz routing, and AI grid demand — strain rising beneath still-functioning systems.",
    methodPills: [
      { label: "Reading Type", value: "Physical infrastructure index" },
      { label: "Primary Focus", value: "Transit, grid, power, logistics" },
      { label: "Current Direction", value: "Elevated, multi-source" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 85, state: "Elevated" },
      { week: "Last Week", degrees: 82, state: "Elevated" },
      { week: "2 Weeks Ago", degrees: 80, state: "Elevated" },
      { week: "3 Weeks Ago", degrees: 79, state: "Elevated" },
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
        title: "Event logistics & transit",
        body: "World Cup host cities test transportation, security, weather response, and crowd-management capacity — strain that may stay localized or broaden into a wider infrastructure narrative.",
      },
      {
        title: "Shipping & routing friction",
        body: "Hormuz normalization remains uneven — routing, permit, insurance, and security questions add friction to energy and goods corridors alongside ceasefire relief.",
      },
      {
        title: "AI power & grid demand",
        body: "Data-center load growth and large-load interconnection requests make power access a strategic constraint — utility responsiveness and regional availability shaping siting and timelines.",
      },
      {
        title: "Transformers & transmission",
        body: "Manufacturing lead times and transmission expansion lag remain core strain points — utilities and hyperscalers competing for large-unit capacity and grid upgrade paths.",
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
    value: "Uneven Relief",
    note: "Hormuz ceasefire cooled acute energy pressure, but shipping normalization remains incomplete and Russia sanctions pressure is returning.",
  },
  {
    label: "AI Compute Load",
    value: "Grid-Bound",
    note: "AI demand continues shifting from software acceleration into power, utility, and data-center siting constraints.",
  },
  {
    label: "Physical Constraints",
    value: "Multi-Source",
    note: "World Cup logistics, Hormuz routing friction, and grid interconnection delays test infrastructure simultaneously.",
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
