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

export const LEDGER_UPDATED = "Updated weekly — June 28, 2026";

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
    status: "Elevated With Fragile Relief",
    weeklyDelta: 1,
    scaleLabels: ["Cold", "Stable", "Elevated", "Hot", "Critical"],
    scaleGradient: SCALE_GRADIENT_PRESSURE,
    summary:
      "Gulf-route confidence thinned as routing, insurance, and transit friction persisted — open but uneven, not closed. Oil pricing remained comparatively calm and eased from earlier highs; markets stayed functional beneath structurally elevated conditions.",
    summaryLead: "The system remains in an",
    summaryEmphasis: "elevated environment with fragile corridor relief",
    summaryCompact:
      "Corridor confidence thinned around Hormuz and Gulf routes while oil pricing stayed comparatively calm. Routing, insurance, and transit friction persist beneath functioning markets, rate-sensitive financial conditions, and ongoing physical constraints in power and grid.",
    weeklyNote:
      "Energy-route confidence weakened after shipping incidents and thinner transit volumes, even as limited traffic continued and oil pricing remained comparatively calm. The U.S.–Iran framework stayed active but visibly strained — routing, permit, insurance, and security questions unresolved. Russia sanctions pressure remains an active channel. Financial conditions grew more rate-sensitive after the Fed's revised inflation outlook. Markets remained functional; pressure stayed elevated rather than disorder-level.",
    weeklyNoteCompact:
      "Fragile corridor relief — routing and insurance friction beneath functioning markets and comparatively calm oil pricing.",
    methodPills: [
      { label: "Reading Type", value: "Weighted editorial index" },
      { label: "Primary Drivers", value: "Corridor confidence, shipping, rates" },
      { label: "Current Direction", value: "Elevated, fragile relief" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 91, state: "Elevated" },
      { week: "Last Week", degrees: 90, state: "Elevated" },
      { week: "2 Weeks Ago", degrees: 91, state: "Elevated" },
      { week: "3 Weeks Ago", degrees: 90, state: "Elevated" },
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
        body: "Corridor confidence thinned as transit volumes fell and routing, permit, insurance, and security questions persisted — routes remain open but uneven, not normalized. Oil pricing stayed comparatively calm; the binding constraint is confidence, not outright closure.",
      },
      {
        title: "Russia sanctions & energy flows",
        body: "G7 pressure on Russia's war economy remains an active transmission channel. Whether sanctions tighten oil and gas flows as corridor relief trades fade is a watch item beneath functioning markets.",
      },
      {
        title: "Markets & physical constraints",
        body: "Rate sensitivity and inflation persistence keep financial conditions narrow. Markets remain functional, but AI power demand and grid constraints increasingly set how quickly expansion converts to capacity.",
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
    reading: 85,
    readingLabel: "Signal Clarity",
    status: "High-Attention, Uneven Clarity",
    weeklyDelta: 1,
    scaleLabels: ["Quiet", "Clear", "Mixed", "Noisy", "Saturated"],
    scaleGradient: SCALE_GRADIENT_SIGNAL,
    summary:
      "Information integrity strain rose as World Cup scams, deepfakes, and AI-generated content spread at scale. Geopolitical frame conflict on Hormuz and institutional-market communication divergence under Warsh's Fed added noise — high-attention, uneven clarity across channels.",
    summaryCompact:
      "High-attention, uneven clarity — World Cup fraud and deepfakes alongside geopolitical frame conflict, Fed communication shift, and overlapping infrastructure narratives.",
    weeklyNote:
      "World Cup coverage amplified fraud, fake streams, and AI-generated content — trust and verification strain in a high-attention environment. Hormuz framing split between corridor-functioning and corridor-risk narratives in the same cycle. Fed communication shifted under new leadership, adding institutional-market divergence. Convergence on physical-capacity themes continues — observational, not hidden-truth framing.",
    weeklyNoteCompact:
      "Information integrity under pressure — World Cup scams and deepfakes, geopolitical frame conflict, and institutional-market divergence.",
    methodPills: [
      { label: "Reading Type", value: "Editorial signal map" },
      { label: "Primary Channels", value: "Institutional, market, event, mainstream" },
      { label: "Current Direction", value: "Noisy, uneven clarity" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 85, state: "Mixed" },
      { week: "Last Week", degrees: 84, state: "Mixed" },
      { week: "2 Weeks Ago", degrees: 81, state: "Clear" },
      { week: "3 Weeks Ago", degrees: 79, state: "Clear" },
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
        body: "World Cup mid-tournament coverage sustains a high-attention environment — fraud, fake streams, and AI-generated deepfakes spread alongside transportation and security reporting, with trust and verification strain rising.",
      },
      {
        title: "Geopolitical framing",
        body: "Hormuz corridor-functioning and corridor-risk narratives appear in the same coverage cycle — institutional language emphasizing coordination, with uneven agreement on whether routes are open, safe, or selectively usable.",
      },
      {
        title: "Institutional communication",
        body: "Fed communication shifted under new leadership — shorter statements, revised inflation outlook, and market repricing add frame divergence alongside ongoing convergence on grid and infrastructure themes.",
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
    reading: 83,
    readingLabel: "Acceleration Reading",
    status: "Power- and Grid-Bound Acceleration",
    weeklyDelta: 1,
    scaleLabels: ["Early", "Building", "Rising", "Fast", "Surge"],
    scaleGradient: SCALE_GRADIENT_AI,
    summary:
      "Capability advances under physical limits — frontier movement remains meaningful but gated, while power, grid access, and large-load integration increasingly set practical pace. Deployment friction matters more than headline release cadence.",
    summaryCompact:
      "Power- and grid-bound acceleration — capability advances under physical limits, with FERC large-load rules reinforcing grid and power as pace-setters.",
    weeklyNote:
      "Large-load grid integration moved into the regulatory foreground as FERC directed regional operators to revise data-center connection rules. A limited frontier preview added marginal capability signal without broad availability. Enterprise adoption and coding integration advanced; governance and energized capacity remain co-equal limits on deployment.",
    weeklyNoteCompact:
      "Grid-bound acceleration — policy-visible power constraints and gated frontier movement setting pace alongside capability.",
    methodPills: [
      { label: "Reading Type", value: "Capability + infrastructure index" },
      { label: "Primary Drivers", value: "Power, grid, deployment" },
      { label: "Current Direction", value: "Advancing, grid-bound" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 83, state: "Accelerating" },
      { week: "Last Week", degrees: 82, state: "Accelerating" },
      { week: "2 Weeks Ago", degrees: 79, state: "Accelerating" },
      { week: "3 Weeks Ago", degrees: 77, state: "Accelerating" },
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
        body: "FERC's large-load order made grid integration policy-visible — data-center connection costs, interconnection timelines, and utility responsiveness increasingly define deployment pace alongside software capability.",
      },
      {
        title: "Frontier movement",
        body: "Limited frontier previews add marginal capability signal without broad availability — meaningful but gated, with deployment friction outweighing headline release cadence in practical planning.",
      },
      {
        title: "Enterprise adoption",
        body: "Workflow dependence and internal tooling expand cautiously — integration, review layers, and governance increasingly define practical gains over frontier releases.",
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
    weeklyDelta: 0,
    scaleLabels: ["Soft", "Stable", "Firm", "Tight", "Constrained"],
    scaleGradient: SCALE_GRADIENT_MATERIALS,
    summary:
      "Precious materials remain strategically firm — central-bank reserve behavior and supply discipline support the structural read, while near-term gold shows real-yield sensitivity. Premium natural categories stay selective; commercial ranges remain price-sensitive.",
    summaryLead: "Precious materials remain in a",
    summaryEmphasis: "strategically firm environment",
    summaryCompact:
      "Strategically firm — structural support from central-bank demand and supply discipline, with gold showing real-yield sensitivity and premium natural selectively resilient.",
    weeklyNote:
      "Gold remained structurally supported by central-bank reserve behavior but showed near-term sensitivity to rates and real yields — firm without dramatic volatility. De Beers-led supply discipline continued; premium natural diamonds held selective firmness in key sizes and cuts. Lab-grown compression persisted in mid-tier channels without broad market alarm.",
    weeklyNoteCompact:
      "Strategically firm — real-yield sensitivity on gold, supply discipline, premium natural selectively resilient.",
    methodPills: [
      { label: "Reading Type", value: "Materials + sourcing index" },
      { label: "Primary Focus", value: "Gold, platinum, diamonds" },
      { label: "Current Direction", value: "Firm, structurally elevated" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 85, state: "Firm" },
      { week: "Last Week", degrees: 85, state: "Firm" },
      { week: "2 Weeks Ago", degrees: 83, state: "Firm" },
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
        title: "Gold & central-bank demand",
        body: "Gold holds structurally elevated support from central-bank reserve behavior — but near-term movement shows real-yield sensitivity beneath the strategic read, without dramatic volatility.",
      },
      {
        title: "Natural diamonds",
        body: "Supply discipline from major producers continues; premium natural categories remain selectively firm in key sizes and cuts. Commercial ranges stay price-sensitive — structural tightening, not broad market stress.",
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
    reading: 86,
    readingLabel: "Infrastructure Strain",
    status: "Elevated Strain",
    weeklyDelta: 1,
    scaleLabels: ["Low", "Rising", "Elevated", "High", "Critical"],
    scaleGradient: SCALE_GRADIENT_INFRASTRUCTURE,
    summary:
      "Strain rose modestly as large-load grid integration became policy-visible through FERC action, while shipping friction, summer heat risk, and sustained World Cup logistics load continue beneath functioning systems — flexibility narrows.",
    summaryCompact:
      "Elevated strain — policy-visible grid constraints, Hormuz routing friction, event logistics, and early-summer heat risk beneath functioning systems.",
    weeklyNote:
      "FERC directed regional grid operators to revise large-load integration rules — data-center power demand became more policy-visible. Hormuz routing friction added shipping-layer strain. World Cup host cities sustained operational load across transit and security. Early-summer heat assessments flag elevated reliability watch items — systems function, but spare capacity narrows.",
    weeklyNoteCompact:
      "Policy-visible grid strain, shipping friction, and sustained event logistics — flexibility narrowing beneath functioning systems.",
    methodPills: [
      { label: "Reading Type", value: "Physical infrastructure index" },
      { label: "Primary Focus", value: "Grid, power, transit, logistics" },
      { label: "Current Direction", value: "Elevated, policy-visible" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 86, state: "Elevated" },
      { week: "Last Week", degrees: 85, state: "Elevated" },
      { week: "2 Weeks Ago", degrees: 82, state: "Elevated" },
      { week: "3 Weeks Ago", degrees: 80, state: "Elevated" },
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
        title: "Grid & large-load integration",
        body: "FERC's large-load order made data-center grid integration policy-visible — connection costs, interconnection timelines, and utility responsiveness increasingly shape siting and expansion beneath narrowing flexibility.",
      },
      {
        title: "Shipping & routing friction",
        body: "Hormuz routing, permit, insurance, and security questions add friction to energy and goods corridors — open but uneven, with corridor confidence thinner than pricing suggests.",
      },
      {
        title: "Event logistics & transit",
        body: "World Cup host cities sustain operational load across transportation, security, and crowd management — strain that may stay localized or broaden as the tournament progresses.",
      },
      {
        title: "Summer heat & reliability",
        body: "Early-summer assessments flag elevated heat risk on transmission and cooling — reliability watch items entering active season, not yet acute outage conditions.",
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
    value: "Fragile Relief",
    note: "Corridor confidence thinned around Hormuz and Gulf routes — routing and insurance friction persist while oil pricing remained comparatively calm.",
  },
  {
    label: "AI Compute Load",
    value: "Grid-Bound",
    note: "Large-load grid integration became policy-visible; power and utility responsiveness set deployment pace alongside gated frontier movement.",
  },
  {
    label: "Physical Constraints",
    value: "Policy-Visible",
    note: "FERC grid rules, Hormuz routing friction, World Cup logistics, and early-summer heat risk test infrastructure beneath functioning systems.",
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
