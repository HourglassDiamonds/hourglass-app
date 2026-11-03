/**
 * Hourglass Ledger — weekly index readings.
 * Update this file when publishing new weekly briefs.
 *
 * Global Pressure: public page is a qualitative monitor
 * (global-pressure-monitor-data.ts). Numerical category scores and weighted
 * calculation remain in global-pressure-index-data.ts for the archived meter
 * — they are not rendered publicly. System Temperature on the hub is the
 * only composite numerical reading.
 */

import {
  GPI_CALIBRATION_NOTE,
  GPI_COMPUTED_READING,
  GPI_METHODOLOGY_SHORT,
} from "./global-pressure-index-data";
import { LEDGER_EVIDENCE_CUTOFF_LABEL } from "./ledger-monitor-framework";

export {
  GPI_CALCULATION_ROWS,
  GPI_CALCULATION_TOTAL,
  GPI_CALIBRATION_NOTE,
  GPI_CATEGORIES,
  GPI_COMPUTED_READING,
  GPI_METHODOLOGY_PRINCIPLES,
  GPI_METHODOLOGY_SHORT,
  GPI_RECALIBRATION_DATE,
  GPI_WEIGHTED_TOTAL,
  computeGpiReading,
  computeGpiWeightedTotal,
} from "./global-pressure-index-data";

export type LedgerIndexId =
  | "global-pressure"
  | "information-signal"
  | "ai-capability"
  | "precious-materials"
  | "infrastructure-strain"
  | "global-water-stress";

export type RecentReading = {
  week: string;
  degrees: number;
  state: string;
  /** Optional chart/card annotation (e.g. methodology recalibration) */
  annotation?: string;
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
  /** Override the default weekly-delta pill label (e.g. methodology reset) */
  weeklyDeltaLabel?: string;
  /** Supporting note under the delta pill when week-over-week is not comparable */
  weeklyDeltaExplanation?: string;
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
  /** Editorial methodology disclosure (GPI recalibration, etc.) */
  calibrationNote?: {
    title: string;
    body: string;
  };
  /** Short pointer into methodology section */
  methodologyReference?: string;
  /** Chart / recent-readings series note */
  seriesAnnotation?: string;
};

export const LEDGER_UPDATED = LEDGER_EVIDENCE_CUTOFF_LABEL;

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

const SCALE_GRADIENT_WATER =
  "linear-gradient(90deg, #8aa0b0 0%, #a8b4a8 30%, #c4b896 55%, #b08a6a 75%, #7a5a48 100%)";

export const LEDGER_INDEXES: readonly LedgerIndexDefinition[] = [
  {
    id: "global-pressure",
    slug: "global-pressure-index",
    seoTitle: "Global Pressure Monitor",
    seoDescription:
      "Hourglass Ledger Global Pressure Monitor — qualitative status of external threat pressure and systemic transmission.",
    displayTitle: "Global Pressure Monitor",
    subnavLabel: "Global Pressure",
    hubDescription:
      "Very high external pressure / Broad energy transmission — Gulf and bypass flows recovered, but above-$100 oil and thin product buffers persist while credit, funding, and labor function.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A qualitative monitor of external threat pressure and systemic transmission. This page does not publish a numerical index.",
    updatedLabel: "",
    // Archived numerical series — still derived for rebuild work; not rendered publicly.
    reading: GPI_COMPUTED_READING,
    readingLabel: "Pressure Reading",
    status: "Very high external pressure / Broad energy transmission",
    weeklyDelta: 0,
    weeklyDeltaLabel: "Qualitative monitor",
    weeklyDeltaExplanation:
      "This page is a qualitative monitor. Archived numerical GPI readings are not comparable to System Temperature and are not published here.",
    scaleLabels: ["Cold", "Stable", "Elevated", "Hot", "Critical"],
    scaleGradient: SCALE_GRADIENT_PRESSURE,
    summary:
      "IEA measured substantial September recovery in Hormuz and East-West flows, but refined-product supply remained strained and Brent stayed above $100 on November 3. The Fed held and the 10-year measured 4.91%; contained credit spreads, orderly funding, and functional labor prevent a crisis reading.",
    summaryLead: "Current state:",
    summaryEmphasis: "Very high external pressure / Broad energy transmission",
    summaryCompact:
      "Very high external pressure / Broad energy transmission. Oil constrained; workarounds and credit still functioning.",
    weeklyNote:
      "Recovered flows are real cooling evidence. Thin product buffers, renewed security risk, and unresolved talks keep energy transmission broad; contained financial stress limits wider failure.",
    weeklyNoteCompact:
      "Very high external pressure; broader energy transmission; systems still functioning.",
    methodPills: [
      { label: "Monitor Type", value: "Qualitative status" },
      {
        label: "Primary Drivers",
        value: "Hormuz transit, East-West Pipeline / Yanbu, energy premium",
      },
      {
        label: "Current Direction",
        value: "Persistent constraint / Physical workarounds improving",
      },
      {
        label: "Primary Offset",
        value: "Functioning credit markets; no confirmed systemic financial event",
      },
    ],
    // Preserved for archived numerical meter — not rendered on the public monitor.
    recentReadings: [
      {
        week: "This Week",
        degrees: GPI_COMPUTED_READING,
        state: "High Heat",
        annotation: "Methodology recalibrated",
      },
      { week: "Last Week", degrees: 93, state: "Elevated" },
      { week: "2 Weeks Ago", degrees: 91, state: "Elevated" },
      { week: "3 Weeks Ago", degrees: 91, state: "Elevated" },
    ],
    benchmarks: [
      { name: "Stable Expansion", score: 50, note: "Low pressure", tier: "quiet" },
      { name: "Eurozone Debt Crisis", score: 70, note: "2011–12", tier: "mid" },
      { name: "Cold War Peaks", score: 82, note: "Proxy heat", tier: "mid" },
      { name: "Covid Shock", score: 91, note: "2020", tier: "high" },
      { name: "2008 Collapse", score: 96, note: "Credit seizure", tier: "high" },
    ],
    calibrationNote: GPI_CALIBRATION_NOTE,
    methodologyReference: GPI_METHODOLOGY_SHORT,
    seriesAnnotation:
      "Earlier numerical GPI readings are archived and should not be interpreted as comparable to System Temperature. This page publishes qualitative status only.",
    watchingSectionTitle: "What We're Watching",
    editorialBlocks: [
      {
        title: "Hormuz transit vs continued restriction",
        body: "Whether independently trackable transit recovers from the four-vessel Monday print, or whether restriction deepens further.",
      },
      {
        title: "East-West Pipeline / Yanbu restoration",
        body: "Whether the principal East-West Pipeline / Yanbu route resumes on a days-to-weeks timeline. Analyst $120/$130 oil paths are scenarios, not forecasts.",
      },
      {
        title: "Credit, stress & volatility confirmation",
        body: "Whether corporate-credit spreads, financial-stress measures, or volatility begin confirming the geopolitical signal. Without that transmission, financial-system stress stays below crisis bands.",
      },
      {
        title: "Diesel and refining durability",
        body: "Whether Russian diesel-refinery outages and U.S. diesel-price spikes fade, or whether a broader middle-distillate shortage transmits further.",
      },
      {
        title: "Supply-chain transmission beyond energy",
        body: "Whether disruption spreads from energy shipping and refining into manufacturing, freight, and final-goods availability.",
      },
    ],
  },
  {
    id: "information-signal",
    slug: "information-signal-map",
    seoTitle: "Information Signal Map",
    seoDescription:
      "Hourglass Ledger Information Signal Map — qualitative narrative density, institutional messaging, and information velocity across markets and policy.",
    displayTitle: "Information Signal Map",
    subnavLabel: "Information Map",
    hubDescription:
      "High-attention / Physical evidence converging — measured flow recovery and a Fed hold are clear, while security, transit durability, and policy direction remain unsettled.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A qualitative map of how narratives move through markets, media, policy, and institutions — not to chase hidden truths, but to track when different information layers begin describing the same systems story. The goal is orientation: where framing converges, where it diverges, and what remains underweighted.",
    updatedLabel: "",
    reading: 85,
    readingLabel: "Signal Clarity",
    status: "High-attention / Physical evidence converging",
    weeklyDelta: 0,
    scaleLabels: ["Quiet", "Clear", "Mixed", "Noisy", "Saturated"],
    scaleGradient: SCALE_GRADIENT_SIGNAL,
    summary:
      "Measured recovery and unresolved trajectory coexist. September flow data, the Fed hold, Treasury curve, and contained credit are verified; November 3 military and diplomatic outcomes remain provisional. Confidence stays Moderate. Information Signal adds no degrees.",
    summaryCompact:
      "High-attention / Better-separated signals — persistent pressure with clearer counterevidence.",
    weeklyNote:
      "Publication date and measurement date are separated. Physical evidence converges, but same-day direction and transit durability remain uncertain.",
    weeklyNoteCompact:
      "Physical evidence converging; duration and policy path still uncertain.",
    methodPills: [
      { label: "Reading Type", value: "Editorial signal map" },
      { label: "Primary Channels", value: "Institutional, market, event, mainstream" },
      { label: "Current Direction", value: "Persistent pressure / More explicit counterevidence" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 85, state: "Mixed" },
      { week: "Last Week", degrees: 85, state: "Mixed" },
      { week: "2 Weeks Ago", degrees: 85, state: "Mixed" },
      { week: "3 Weeks Ago", degrees: 85, state: "Mixed" },
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
        title: "Physical versus intent",
        body: "Shipping counts, $100+ oil, disruption of the principal Hormuz-bypass route, the 10-year’s September 15 print above 5%, and resilient equities are clearer; pipeline duration, Hormuz talks, and the September Fed outcome remain contested.",
      },
      {
        title: "Corridor frame conflict",
        body: "Physical transit prints and the Yanbu/pipeline outage sit beside still-unsettled repair timelines and diplomatic-path language — raising attention without settling duration.",
      },
      {
        title: "Institutional & market framing",
        body: "Official framing and physical shipping evidence still diverge on duration. The 10-year’s September 15 print above 5% is a clearer market fact than diplomatic intent. Information Signal remains confidence-only.",
      },
    ],
  },
  {
    id: "ai-capability",
    slug: "ai-capability-acceleration-index",
    seoTitle: "AI Capability Monitor",
    seoDescription:
      "Hourglass Ledger AI Capability Monitor — qualitative tracking of compute expansion, model capability, and infrastructure scaling.",
    displayTitle: "AI Capability Monitor",
    subnavLabel: "AI Acceleration",
    hubDescription:
      "Capability pace: Accelerating / Security-gated, capital- and grid-bound — October disclosures confirm containment risk and adaptation without verified economy-wide dysfunction.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A qualitative monitor of how AI capability, deployment, and physical infrastructure move together: models, agents, enterprise integration, power, grid access, and organizational adaptation. The frame is operational and observational — not promotional.",
    updatedLabel: "",
    reading: 85,
    readingLabel: "Acceleration Reading",
    status: "Capability pace: Accelerating",
    weeklyDelta: 1,
    scaleLabels: ["Early", "Building", "Rising", "Fast", "Surge"],
    scaleGradient: SCALE_GRADIENT_AI,
    summary:
      "Frontier capability and deployment continue to broaden. OpenAI and Anthropic disclosed concrete unintended-action and containment evidence alongside isolation hardening, human review, usage controls, and EU enforcement. Power, capital, cooling, and security remain co-equal limits.",
    summaryCompact:
      "Capability pace accelerating — security-gated, capital- and grid-bound.",
    weeklyNote:
      "Containment evidence became more concrete, but so did governance adaptation. No verified external-transmission step changes Technology / AI from High / Partial.",
    weeklyNoteCompact:
      "Accelerating capability; industrialization capital- and grid-bound.",
    methodPills: [
      { label: "Reading Type", value: "Capability + infrastructure index" },
      { label: "Primary Drivers", value: "Capability, capital, power, deployment" },
      { label: "Current Direction", value: "Security-gated, capital- and grid-bound" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 85, state: "Accelerating" },
      { week: "Last Week", degrees: 84, state: "Accelerating" },
      { week: "2 Weeks Ago", degrees: 84, state: "Accelerating" },
      { week: "3 Weeks Ago", degrees: 83, state: "Accelerating" },
    ],
    benchmarks: [
      { name: "Pre-Transformer", score: 38, note: "2017 era" },
      { name: "ChatGPT Launch", score: 62, note: "Late 2022" },
      { name: "Enterprise Wave", score: 71, note: "2024" },
      { name: "Capex Peak Cycle", score: 85, note: "Current" },
      { name: "Theoretical Max", score: 95, note: "Hypothetical" },
    ],
    editorialBlocks: [
      {
        title: "Model capability",
        body: "GPT-6 broadened ChatGPT access and Gemini 4 Argon expanded frontier reasoning, coding, task execution, and application integrations. Provider evaluations keep important capability boundaries explicit.",
      },
      {
        title: "Deployment",
        body: "Enterprise usage, agent workflows, automation, and consumer access keep widening. “Available” still describes different surfaces and integration depths.",
      },
      {
        title: "Industrial constraints",
        body: "Electricity, interconnection, data-center capacity, long-duration capital, cooling, and physical buildout now co-equal the software layer.",
      },
    ],
  },
  {
    id: "precious-materials",
    slug: "precious-materials-index",
    seoTitle: "Precious Materials Monitor",
    seoDescription:
      "Hourglass Ledger Precious Materials Monitor — qualitative intelligence on gold, platinum, diamonds, and the materials that shape fine jewelry markets.",
    displayTitle: "Precious Materials Monitor",
    subnavLabel: "Precious Materials",
    hubDescription:
      "Strategically firm / Highly segmented — gold remains elevated below its September peak; De Beers volume improved beside lower realized prices, and polished gains remain uneven.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A qualitative monitor of the material conditions behind fine jewelry — gold, platinum, natural diamonds, and the sourcing realities that shape quality, availability, and long-term value. The purpose is not to chase commodity headlines. It is to clarify when material markets are firm, selective, or shifting beneath the surface.",
    updatedLabel: "",
    reading: 85,
    readingLabel: "Materials Reading",
    status: "Strategically firm / Highly segmented",
    weeklyDelta: 0,
    scaleLabels: ["Soft", "Stable", "Firm", "Tight", "Constrained"],
    scaleGradient: SCALE_GRADIENT_MATERIALS,
    summary:
      "Gold closed near $3,975 on November 2 and platinum remained firm. De Beers reported much higher Q3 sales volume beside a 45% lower average realized price. Rapaport's October review showed mixed polished gains; lab-grown listings remain structurally cheaper and highly dispersed.",
    summaryLead: "Precious materials remain in a",
    summaryEmphasis: "strategically firm, highly segmented environment",
    summaryCompact:
      "Strategically firm / Highly segmented — gold cooled further; diamond gains broadened unevenly.",
    weeklyNote:
      "No materials-regime change and no extra System Temperature increment. Metals remain rate-sensitive; natural diamonds are segmented; listed lab-grown prices remain compressed and dispersed.",
    weeklyNoteCompact:
      "Strategically firm / Highly segmented — gold cooling, segmented diamonds, lab-grown compression.",
    methodPills: [
      { label: "Reading Type", value: "Materials + sourcing index" },
      { label: "Primary Focus", value: "Gold, platinum, diamonds" },
      { label: "Current Direction", value: "Gold cooling / Diamond recovery broadening unevenly" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 85, state: "Firm" },
      { week: "Last Week", degrees: 85, state: "Firm" },
      { week: "2 Weeks Ago", degrees: 85, state: "Firm" },
      { week: "3 Weeks Ago", degrees: 85, state: "Firm" },
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
        title: "Gold & official-sector demand",
        body: "Gold eased to around $4,266–$4,297 — near the lowest since early August — as yields, the dollar, and hike odds overpowered some safe-haven demand. Jewelry demand remains price-sensitive. This rates/dollar event is already scored in Financial.",
      },
      {
        title: "Natural diamonds",
        body: "Segmented: August RAPI rose 0.5% for 1-carat goods, the first monthly increase in 15 months, with stronger smalls as supply cuts bite. Higher-value goods remain relatively firmer; this is not generic scarcity.",
      },
      {
        title: "Sourcing posture",
        body: "Segmentation persists between structural precious-material demand and selective diamond-market softness, with continued lab-grown compression in commercial channels. Provenance, selective inventory, and patient sourcing remain preferable to reactive buying.",
      },
    ],
  },
  {
    id: "infrastructure-strain",
    slug: "infrastructure-strain-index",
    seoTitle: "Infrastructure Strain Monitor",
    seoDescription:
      "Hourglass Ledger Infrastructure Strain Monitor — qualitative reading of power, transmission, data centers, transformers, semiconductors, labor, and logistics constraints.",
    displayTitle: "Infrastructure Strain Monitor",
    subnavLabel: "Infrastructure",
    hubDescription:
      "High infrastructure strain — forecast commercial-load growth, a bounded PJM emergency order, and Colorado low-elevation protection operations confirm strain plus adaptation.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A qualitative monitor of physical constraints beneath digital and industrial acceleration: AI data-center load, power demand, transformers, interconnection, cooling, transmission, labor, and permitting — where systems function but flexibility narrows.",
    updatedLabel: "",
    reading: 87,
    readingLabel: "Infrastructure Strain",
    status: "High infrastructure strain",
    weeklyDelta: 0,
    scaleLabels: ["Low", "Rising", "Elevated", "High", "Critical"],
    scaleGradient: SCALE_GRADIENT_INFRASTRUCTURE,
    summary:
      "EIA projects continued commercial-load growth and higher wholesale prices. DOE supplied PJM emergency tools during an October outage window, while Reclamation linked Colorado operations directly to infrastructure protection. The grid, labor, and logistics systems continue to function.",
    summaryCompact:
      "High strain / Active adaptation — multi-regional physical pressure beneath still-functioning systems.",
    weeklyNote:
      "Power-water constraints required active intervention without establishing national grid failure. Physical Infrastructure remains High / Partial.",
    weeklyNoteCompact:
      "High strain, active adaptation — multi-regional, systems still functioning.",
    methodPills: [
      { label: "Reading Type", value: "Physical infrastructure index" },
      { label: "Primary Focus", value: "Grid, power, water-to-energy, large-load" },
      { label: "Current Direction", value: "Active adaptation / Large-load operating pressure confirmed" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 87, state: "Elevated" },
      { week: "Last Week", degrees: 87, state: "Elevated" },
      { week: "2 Weeks Ago", degrees: 87, state: "Elevated" },
      { week: "3 Weeks Ago", degrees: 86, state: "Elevated" },
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
        title: "Texas power/water gating",
        body: "Whether the data-center interconnection pause and water-reporting enforcement remain adaptation gates, or whether load is re-admitted faster than supply and water plans can absorb.",
      },
      {
        title: "European water-to-power and freight",
        body: "Whether Danube and Rhine constraints, nuclear cooling, hydro output, and freight ease seasonally or deepen — systems remaining in adaptation rather than failure.",
      },
      {
        title: "Cooling, water & labor",
        body: "Whether large-load proposals increasingly stall on cooling, water, skilled trades, or local acceptance rather than software demand alone.",
      },
    ],
    watchingSectionTitle: "What We're Watching",
  },
  {
    id: "global-water-stress",
    slug: "global-water-stress",
    seoTitle: "Global Water Stress Monitor",
    seoDescription:
      "Hourglass Ledger Global Water Stress Monitor — qualitative reading of rivers, reservoirs, municipal supply, agriculture, energy transmission, and policy/security, including both worsening and improving regions.",
    displayTitle: "Global Water Stress Monitor",
    subnavLabel: "Water",
    hubDescription:
      "High water stress / Multi-system transmission — Colorado protection operations are explicit, agricultural drought is regional, and global cereal output remains large.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A qualitative monitor of water as a physical evidence layer. Downstream effects appear in power, freight, and security where they are independently visible.",
    updatedLabel: "",
    reading: 0,
    readingLabel: "Qualitative monitor",
    status: "High water stress / Multi-system transmission",
    weeklyDelta: 0,
    scaleLabels: ["Low", "Watch", "Elevated", "High", "Severe"],
    scaleGradient: SCALE_GRADIENT_WATER,
    summary:
      "Reclamation recorded preliminary water-year inflow to Powell at 39% of average and placed 2027 operations in a low-elevation protection range. FAO documented regional drought exposure while forecasting the second-largest global cereal harvest on record. Water remains an evidence layer, not a sixth temperature weight.",
    summaryCompact:
      "High water stress / Multi-system transmission — uneven, with improving basins visible.",
    weeklyNote:
      "Colorado protection operations confirm structural stress; regional drought is real, while global cereal output and localized moisture are material offsets.",
    weeklyNoteCompact:
      "High, uneven water stress — improving basins shown with worsening ones.",
    methodPills: [
      { label: "Monitor Type", value: "Qualitative evidence layer" },
      { label: "Primary Focus", value: "Rivers, storage, municipal, food, energy, security" },
      { label: "Current Direction", value: "Colorado protection operations / Uneven agricultural stress" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 0, state: "High / uneven" },
    ],
    editorialBlocks: [
      {
        title: "Europe",
        body: "High, worsening seasonally — transmission into power, freight, agriculture, and municipal restrictions, with operators adapting.",
      },
      {
        title: "Tigris / Euphrates",
        body: "Materially improved hydrology inside continued structural vulnerability. Not a 2026 drying-crisis story.",
      },
      {
        title: "No separate degree",
        body: "Water does not publish a temperature reading. Physical effects on power and freight appear on the Infrastructure monitor.",
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
export const GPI_UPDATED_LABEL = getLedgerIndex("global-pressure").updatedLabel;
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
    value: "Persistent Broad Transmission",
    note: "EIA still sees constrained fourth-quarter oil flows and a $105 Brent path, while lower shut-ins and export workarounds limit further escalation.",
  },
  {
    label: "AI Compute / Capability",
    value: "Security + Infrastructure Binding",
    note: "GPT-6 and Gemini 4 Argon broaden deployment while explicit capability limits, containment, electricity, interconnection, and capital remain co-equal constraints.",
  },
  {
    label: "Physical Constraints",
    value: "Multi-System Active Adaptation",
    note: "October PJM alerts, large-load planning, and Colorado structural shortage remain binding, with successful grid operations and Powell's seasonal rise showing adaptation.",
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
