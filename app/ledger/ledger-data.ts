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

export const LEDGER_UPDATED = "Updated weekly — July 6, 2026";

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
    weeklyDelta: 0,
    scaleLabels: ["Cold", "Stable", "Elevated", "Hot", "Critical"],
    scaleGradient: SCALE_GRADIENT_PRESSURE,
    summary:
      "Hormuz transit is recovering but remains materially below normal — routes open but uneven, not normalized. Oil pricing eased toward pre-conflict levels; corridor governance, routing confidence, insurance, and sovereignty remain unresolved beneath functioning markets.",
    summaryLead: "The system remains in an",
    summaryEmphasis: "elevated environment with fragile corridor relief",
    summaryCompact:
      "Partial Hormuz recovery with oil near pre-conflict levels — routing, insurance, and corridor governance remain unresolved beneath rate-sensitive financial conditions and ongoing grid constraints.",
    weeklyNote:
      "Hormuz traffic continued a partial recovery after the June ceasefire, but transit volumes remain well below pre-war norms. Oil prices eased toward pre-conflict levels without implying normalized corridor confidence — routing, insurance, sovereignty, and fee disputes stay active. Iran renewed route-control warnings as Doha talks produced cautious progress. The read confirms the prior assessment rather than marking a new pressure regime. Russia sanctions pressure remains an active channel, with the EU moving to freeze the G7 oil price cap. Financial conditions stay rate-sensitive under the Fed's inflation focus. Markets remained functional; pressure stayed elevated.",
    weeklyNoteCompact:
      "Fragile corridor relief confirmed — partial transit recovery and calmer oil beneath unresolved routing, insurance, and governance questions.",
    methodPills: [
      { label: "Reading Type", value: "Weighted editorial index" },
      { label: "Primary Drivers", value: "Corridor confidence, shipping, rates" },
      { label: "Current Direction", value: "Elevated, fragile relief" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 91, state: "Elevated" },
      { week: "Last Week", degrees: 91, state: "Elevated" },
      { week: "2 Weeks Ago", degrees: 90, state: "Elevated" },
      { week: "3 Weeks Ago", degrees: 91, state: "Elevated" },
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
        body: "Transit volumes are recovering but remain materially below normal — routes are open but uneven, not normalized. Oil pricing eased toward pre-conflict levels; the binding constraint is corridor confidence, governance, and insurance — not outright closure.",
      },
      {
        title: "Russia sanctions & energy flows",
        body: "The EU is moving to freeze the G7 oil price cap at current levels, keeping sanctions pressure active as corridor conditions partially normalize. Whether enforcement tightens shadow-fleet flows remains a watch item beneath functioning markets.",
      },
      {
        title: "Markets & physical constraints",
        body: "Rate sensitivity and inflation persistence keep financial conditions narrow. Markets remain functional, but grid emergencies and AI power demand increasingly show how physical constraints set the pace beneath calm headline pricing.",
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
    weeklyDelta: 0,
    scaleLabels: ["Quiet", "Clear", "Mixed", "Noisy", "Saturated"],
    scaleGradient: SCALE_GRADIENT_SIGNAL,
    summary:
      "High-attention, uneven clarity persists — access claims increasingly require qualification as \"released,\" \"available,\" and \"deployed\" describe different realities by geography, approval status, and account tier. World Cup fraud risk, Hormuz frame conflict, and Fed communication divergence continue beneath partial normalization in frontier-model access.",
    summaryCompact:
      "High-attention, uneven clarity — qualified access claims alongside event fraud risk, geopolitical frame conflict, and institutional-market divergence.",
    weeklyNote:
      "The information environment refined rather than escalated. Access claims for AI models increasingly require qualification — broad deployment, partner-only previews, and government-coordinated releases describe different realities. Claude Fable 5 restoration is a partial normalization signal; earlier June export controls and pre-update GPT-5.6 announcements are background, not new shocks. World Cup fraud and deepfake risk remain embedded from the prior week. Hormuz framing still splits between corridor-functioning and corridor-risk narratives. Fed communication under Warsh adds institutional-market divergence without justifying a higher clarity score.",
    weeklyNoteCompact:
      "Uneven clarity — qualified access claims, embedded event fraud risk, and persistent frame conflict without a score increase.",
    methodPills: [
      { label: "Reading Type", value: "Editorial signal map" },
      { label: "Primary Channels", value: "Institutional, market, event, mainstream" },
      { label: "Current Direction", value: "Noisy, uneven clarity" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 85, state: "Mixed" },
      { week: "Last Week", degrees: 85, state: "Mixed" },
      { week: "2 Weeks Ago", degrees: 84, state: "Mixed" },
      { week: "3 Weeks Ago", degrees: 81, state: "Clear" },
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
        title: "Qualified access claims",
        body: "\"Released,\" \"available,\" and \"deployed\" increasingly describe different realities — geography, government approval, account tier, and partner access matter. The policy-gated model-release cycle is structural; Fable 5 restoration is partial normalization, not full clarity.",
      },
      {
        title: "Event-driven noise",
        body: "World Cup knockout-stage coverage sustains a high-attention environment — fraud, fake streams, and AI-generated content remain embedded from the prior assessment, not a newly accelerating shock.",
      },
      {
        title: "Geopolitical & institutional framing",
        body: "Hormuz corridor-functioning and corridor-risk narratives still appear in the same cycle. Fed communication under Warsh adds institutional-market divergence alongside ongoing convergence on grid and infrastructure themes.",
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
    reading: 84,
    readingLabel: "Acceleration Reading",
    status: "Power- and Grid-Bound Acceleration",
    weeklyDelta: 1,
    scaleLabels: ["Early", "Building", "Rising", "Fast", "Surge"],
    scaleGradient: SCALE_GRADIENT_AI,
    summary:
      "Capability advanced through broad Claude Sonnet 5 deployment across consumer, enterprise, coding, and API surfaces — while frontier access remains gated and grid constraints turned operational during the PJM heat event. Deployment friction and physical limits still set practical pace.",
    summaryCompact:
      "Power- and grid-bound acceleration — broad Sonnet 5 deployment beneath gated frontier access and operational grid constraints.",
    weeklyNote:
      "Claude Sonnet 5 launched June 30 with broad availability across plans, Claude Code, and the API — the week's clearest capability gain, with stronger agentic and tool-use behavior at a widely deployed tier. Partner-only frontier previews and government-coordinated release gates remain separate from broad deployment. PJM heat emergencies made grid and power constraints operational, not theoretical. Enterprise adoption and coding integration advanced; governance, energized capacity, and access qualification remain co-equal limits.",
    weeklyNoteCompact:
      "Broad deployment gains beneath gated frontier access and operational grid constraints.",
    methodPills: [
      { label: "Reading Type", value: "Capability + infrastructure index" },
      { label: "Primary Drivers", value: "Power, grid, deployment" },
      { label: "Current Direction", value: "Advancing, grid-bound" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 84, state: "Accelerating" },
      { week: "Last Week", degrees: 83, state: "Accelerating" },
      { week: "2 Weeks Ago", degrees: 82, state: "Accelerating" },
      { week: "3 Weeks Ago", degrees: 79, state: "Accelerating" },
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
        title: "Broad deployment gains",
        body: "Claude Sonnet 5 reached general availability across consumer, enterprise, coding, and API surfaces — meaningful agentic and tool-use capability at a widely deployed tier, distinct from partner-only frontier previews.",
      },
      {
        title: "Gated frontier access",
        body: "Frontier models remain behind government-coordinated previews and partner gates — capability signals exist, but \"released\" and \"available\" describe different realities depending on access path and approval status.",
      },
      {
        title: "Operational grid constraints",
        body: "PJM heat emergencies made power and grid limits operational — backup-generation authority for large loads and systemwide demand response set practical pace alongside software capability.",
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
      "Precious materials remain strategically firm — central-bank accumulation and reserve diversification support the structural read, while gold shows near-term real-yield sensitivity. De Beers is aligning July sight pricing closer to market conditions; premium natural categories stay selective.",
    summaryLead: "Precious materials remain in a",
    summaryEmphasis: "strategically firm environment",
    summaryCompact:
      "Strategically firm — central-bank gold demand and supply discipline, with selective diamond-pipeline softness and embedded lab-grown compression.",
    weeklyNote:
      "Central banks continued net gold accumulation in May, with Poland, China, and other reserve managers adding to holdings — structural support beneath near-term real-yield sensitivity. De Beers signaled July sight pricing alignment closer to market conditions amid a leaner sightholder roster, reflecting selective pipeline adjustment rather than broad market stress. Premium natural categories held selective firmness; commercial ranges remain price-sensitive. Lab-grown compression persisted in mid-tier channels as an embedded factor, not a new shock.",
    weeklyNoteCompact:
      "Strategically firm — central-bank demand, selective De Beers pricing alignment, premium natural selectively resilient.",
    methodPills: [
      { label: "Reading Type", value: "Materials + sourcing index" },
      { label: "Primary Focus", value: "Gold, platinum, diamonds" },
      { label: "Current Direction", value: "Firm, structurally elevated" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 85, state: "Firm" },
      { week: "Last Week", degrees: 85, state: "Firm" },
      { week: "2 Weeks Ago", degrees: 85, state: "Firm" },
      { week: "3 Weeks Ago", degrees: 83, state: "Firm" },
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
        body: "Central-bank net buying continued — reserve diversification and crisis-hedge demand support the structural read, with near-term gold movement still showing real-yield sensitivity beneath it.",
      },
      {
        title: "Natural diamonds",
        body: "De Beers is aligning July sight rough pricing closer to market conditions while maintaining a leaner sightholder base — selective pipeline adjustment, not broad market loosening. Premium natural categories remain selectively firm in key sizes and cuts.",
      },
      {
        title: "Sourcing posture",
        body: "Segmentation persists between structural precious-material demand and selective diamond-pipeline softness. Provenance, selective inventory, and patient sourcing remain preferable to reactive buying.",
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
    reading: 87,
    readingLabel: "Infrastructure Strain",
    status: "Elevated Strain",
    weeklyDelta: 1,
    scaleLabels: ["Low", "Rising", "Elevated", "High", "Critical"],
    scaleGradient: SCALE_GRADIENT_INFRASTRUCTURE,
    summary:
      "Strain rose as PJM activated emergency demand-response measures during the heat event — the Department of Energy authorized backup generation at data centers and other large-load facilities while the system moved from forecast risk into operational intervention. No widespread blackout occurred; flexibility narrowed.",
    summaryCompact:
      "Elevated strain — PJM emergency operations during heat, with data-center load and grid demand interacting beneath functioning systems.",
    weeklyNote:
      "PJM forecast near-record demand amid a prolonged heat dome and activated systemwide emergency demand response. The Department of Energy authorized PJM to call on backup generation at data centers and other large-load facilities — operational intervention, not theoretical strain. Heat, grid demand, and data-center load interacted in the same event. FERC large-load deadlines continue approaching. World Cup logistics and Hormuz routing friction remain secondary layers. Systems functioned without widespread blackout; spare capacity narrowed.",
    weeklyNoteCompact:
      "Operational grid strain — PJM emergency measures during heat, with large-load backup-generation authority activated.",
    methodPills: [
      { label: "Reading Type", value: "Physical infrastructure index" },
      { label: "Primary Focus", value: "Grid, power, transit, logistics" },
      { label: "Current Direction", value: "Elevated, operational strain" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 87, state: "Elevated" },
      { week: "Last Week", degrees: 86, state: "Elevated" },
      { week: "2 Weeks Ago", degrees: 85, state: "Elevated" },
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
        title: "PJM heat emergency",
        body: "PJM activated systemwide emergency demand response as a heat dome pushed demand toward record levels. The Department of Energy authorized backup generation at data centers and other large-load facilities — strain turned operational without widespread blackout.",
      },
      {
        title: "Grid & large-load integration",
        body: "FERC large-load deadlines continue approaching as data-center power demand shapes siting and interconnection — policy-visible constraints now reinforced by live grid stress.",
      },
      {
        title: "Event logistics & transit",
        body: "World Cup knockout-stage host cities sustain operational load across transportation and security — localized strain that may stay contained as the tournament progresses.",
      },
      {
        title: "Summer heat & reliability",
        body: "Early-summer heat moved from forecast watch to active reliability management — cooling and transmission stress are now operational factors, not just seasonal risk.",
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
    note: "Partial Hormuz recovery with oil near pre-conflict levels — routing, insurance, and corridor governance remain unresolved.",
  },
  {
    label: "AI Compute Load",
    value: "Grid-Bound",
    note: "Broad Sonnet 5 deployment advances capability; PJM heat emergencies made grid and power limits operational, not theoretical.",
  },
  {
    label: "Physical Constraints",
    value: "Operational Strain",
    note: "PJM emergency demand response and large-load backup-generation authority during heat — flexibility narrowing beneath functioning systems.",
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
