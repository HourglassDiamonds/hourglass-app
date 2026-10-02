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

import { LEDGER_EVIDENCE_CUTOFF_LABEL } from "./ledger-monitor-framework";

export type LedgerIndexId =
  | "global-pressure"
  | "information-signal"
  | "ai-capability"
  | "precious-materials"
  | "infrastructure-strain"
  | "buffer-health"
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

const SCALE_GRADIENT_BUFFER =
  "linear-gradient(90deg, #d9d2c8 0%, #b8b1a7 45%, #7d8f8a 100%)";

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
      "Very high external pressure / Broader energy transmission — energy buffers remain low despite restored East-West Pipeline and Yanbu flows, while credit, funding, and labor continue to function.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A qualitative monitor of external threat pressure and systemic transmission. This page does not publish a numerical index.",
    updatedLabel: "",
    // Compatibility-only fields for the legacy index shape. Archived numerical
    // GPI data lives only in global-pressure-index-data.ts and archived views.
    reading: 0,
    readingLabel: "No public numerical reading",
    status: "Very high external pressure / Broader energy transmission",
    weeklyDelta: 0,
    weeklyDeltaLabel: "Qualitative monitor",
    weeklyDeltaExplanation:
      "This page is a qualitative monitor. Archived numerical GPI readings are not comparable to System Temperature and are not published here.",
    scaleLabels: ["Cold", "Stable", "Elevated", "Hot", "Critical"],
    scaleGradient: SCALE_GRADIENT_PRESSURE,
    summary:
      "Energy buffers remain low after large inventory draws, limited effective spare production, weak refined-product inventories, and constrained routing. East-West Pipeline operations and Yanbu loadings resumed, restoring part of the bypass. The Fed hike and elevated 10-year preserve pressure, while contained spreads, below-normal lagged stress, orderly funding, and functional labor prevent escalation.",
    summaryLead: "Current state:",
    summaryEmphasis: "Very high external pressure / Broader energy transmission",
    summaryCompact:
      "Very high external pressure / Broader energy transmission. Energy slack Low; financial system functioning.",
    weeklyNote:
      "Threat pressure remains very high. Restored Yanbu flows cool the outage-specific risk, but depleted buffers keep energy transmission broad. Contained financial stress and functional labor limit broader failure.",
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
        value: "Energy buffers low / Restored bypass and contained financial stress limit escalation",
      },
      {
        label: "Primary Offset",
        value: "Functioning credit markets; no confirmed systemic financial event",
      },
    ],
    recentReadings: [],
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
        body: "Whether observed East-West Pipeline / Yanbu restoration persists and rebuilds routing slack. Analyst price paths are scenarios, not forecasts.",
      },
      {
        title: "Credit, stress & volatility confirmation",
        body: "Whether observed corporate-credit spreads, lagged financial-stress measures, or funding markets begin confirming the geopolitical signal. Without that transmission, financial-system stress stays below crisis bands.",
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
      "High-attention / Physical evidence converging — Yanbu restoration and the Fed hike are observed, while low energy slack and elevated long yields coexist with contained financial stress.",
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
      "Observed Yanbu / East-West restoration and the realized Fed hike resolve two September uncertainties. Estimated energy depletion, provisional inventories, forecast grid and food balances, lagged stress, and observed market and labor evidence remain explicitly separated. Confidence stays Moderate. Information Signal adds no degrees.",
    summaryCompact:
      "High-attention / Physical evidence converging — restoration and policy outcome clearer; reserve durability uncertain.",
    weeklyNote:
      "Coverage now separates observed restoration and policy outcomes from estimated, provisional, lagged, and forecast evidence. Density remains high; reserve durability is not clear enough to raise confidence.",
    weeklyNoteCompact:
      "Physical evidence converging; duration and policy path still uncertain.",
    methodPills: [
      { label: "Reading Type", value: "Editorial signal map" },
      { label: "Primary Channels", value: "Institutional, market, event, mainstream" },
      { label: "Current Direction", value: "Observed restoration and policy outcome clearer / Reserve durability uncertain" },
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
        body: "Yanbu restoration and the Fed hike are observed; depleted energy buffers and elevated long yields persist; contained spreads, below-normal lagged stress, and functional labor are the principal disconfirmations.",
      },
      {
        title: "Corridor frame conflict",
        body: "Observed bypass restoration sits beside still-constrained routing and depleted inventories — cooling the outage narrative without establishing normal reserve capacity.",
      },
      {
        title: "Institutional & market framing",
        body: "Observed, provisional, lagged, and forecast inputs are kept explicit. The Information Signal remains confidence-only and does not add temperature degrees.",
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
      "Capability pace: Accelerating / Security-gated, capital- and grid-bound — no new October escalation; forecast load and episodic grid stress keep physical constraints binding while labor remains functional.",
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
      "Acceleration continues, but the live deployment condition remains security-gated, capital-bound, and grid-bound. The October pass establishes no new capability or containment escalation. Forecast record demand and observed episodic grid intervention confirm physical constraints; provisional labor evidence remains functional. Technology / AI holds High / Partial.",
    summaryCompact:
      "Capability pace accelerating — security-gated, capital- and grid-bound.",
    weeklyNote:
      "No new capability, containment, labor-substitution, or external-transmission step was established. Grid, power, and capital constraints remain binding. Technology / AI System Temperature holds High / Partial.",
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
        body: "GPT-5.6 remains the deployed baseline; Gemini 3.7 Flash (August 13) adds another frontier-access surface. Agents, coding, and workflow automation continue to broaden.",
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
      "Strategically firm / Highly segmented — the Fed hike and elevated yields remain Financial-channel evidence; precious materials stay contained and natural diamonds remain segmented.",
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
      "Precious materials remain strategically firm and highly segmented. The realized Fed hike and elevated 10-year are already captured in Financial; contained spreads and below-normal lagged stress do not create a separate materials increment. The latest approved natural-diamond evidence remains segmented rather than generically scarce.",
    summaryLead: "Precious materials remain in a",
    summaryEmphasis: "strategically firm, highly segmented environment",
    summaryCompact:
      "Strategically firm / Highly segmented — gold cooling on rates; diamond markets remain split.",
    weeklyNote:
      "No materials-regime change and no System Temperature materials increment. Rates remain a Financial-channel event; natural-diamond conditions stay segmented.",
    weeklyNoteCompact:
      "Strategically firm / Highly segmented — gold cooling, segmented diamonds, lab-grown compression.",
    methodPills: [
      { label: "Reading Type", value: "Materials + sourcing index" },
      { label: "Primary Focus", value: "Gold, platinum, diamonds" },
      { label: "Current Direction", value: "Rate-sensitive / Diamonds still segmented" },
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
      "High infrastructure strain — repeated Carolinas interventions show episodic grid stress, while expired orders and forecast planning adequacy confirm active adaptation without national grid failure.",
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
      "Public infrastructure strain remains high, with active adaptation and thinning grid reserve. Repeated September Carolinas interventions and record regional loads show episodic stress. The observed orders expired without national grid failure, forecast planning adequacy remains intact across much of the system, and provisional labor evidence remains functional.",
    summaryCompact:
      "High strain / Active adaptation — multi-regional physical pressure beneath still-functioning systems.",
    weeklyNote:
      "Observed Carolinas interventions confirm episodic extreme-weather strain; their expiration and forecast planning adequacy argue against a failing national grid. Physical Infrastructure holds High / Partial.",
    weeklyNoteCompact:
      "High strain, active adaptation — multi-regional, systems still functioning.",
    methodPills: [
      { label: "Reading Type", value: "Physical infrastructure index" },
      { label: "Primary Focus", value: "Grid, power, water-to-energy, large-load" },
      { label: "Current Direction", value: "Episodic grid stress / Active adaptation" },
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
    id: "buffer-health",
    slug: "buffer-health",
    seoTitle: "Buffer Health / Remaining Slack",
    seoDescription:
      "Hourglass Ledger Buffer Health — qualitative remaining slack across households, labor, food, energy, grid, and the financial system.",
    displayTitle: "Buffer Health / Remaining Slack",
    subnavLabel: "Buffer Health",
    hubDescription:
      "How much capacity remains to absorb additional pressure. Energy is Low; households, food, and grid are Thinning; labor and the financial system are Healthy.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A qualitative framework for remaining system slack. It can inform a future functioning review but cannot add System Temperature degrees.",
    updatedLabel: "",
    // Compatibility-only fields for the legacy index shape. Public Buffer Health
    // surfaces never render or convert these values into a numerical reading.
    reading: 0,
    readingLabel: "No numerical reading",
    status: "Uneven and thinning; energy buffers low",
    weeklyDelta: 0,
    scaleLabels: ["Critical", "Low", "Thinning", "Healthy", "Full"],
    scaleGradient: SCALE_GRADIENT_BUFFER,
    summary:
      "Systems remain functional, but reserve capacity is uneven and thinning; energy buffers are low.",
    summaryCompact: "Uneven and thinning reserve capacity; energy buffers Low.",
    weeklyNote:
      "October 1 evidence establishes six qualitative domain states. Buffer Health remains independent from the 74° System Temperature reading.",
    weeklyNoteCompact: "Six sourced reserve states; no temperature-degree effect.",
    methodPills: [
      { label: "Monitor Type", value: "Qualitative remaining-slack framework" },
      { label: "Temperature Weight", value: "None" },
      { label: "Current Direction", value: "Uneven and thinning" },
    ],
    recentReadings: [],
    editorialBlocks: [
      {
        title: "Functioning review only",
        body: "Buffer evidence may inform a future editorial review of Systems Functioning; it does not mechanically change degrees.",
      },
    ],
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
      "High water stress / Multi-system transmission — the hydrologic map remains uneven while food buffers are mixed and thinning and fertilizer/corridor pressure has not produced shortage.",
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
      "Water stress remains high and uneven. The October pass refreshes the food layer: observed corn stocks rebuilt while wheat weakened; rice and global cereal balances remain forecasts; observed fertilizer and Gulf-corridor pressure adds risk without proving physical shortage. Water is an evidence layer, not a sixth temperature weight.",
    summaryCompact:
      "High water stress / Multi-system transmission — uneven, with improving basins visible.",
    weeklyNote:
      "Food buffers are mixed and thinning, with explicit observed and forecast evidence. Fertilizer and corridor pressure has not produced verified shortage. Water remains an evidence layer, not a sixth temperature weight.",
    weeklyNoteCompact:
      "High, uneven water stress — improving basins shown with worsening ones.",
    methodPills: [
      { label: "Monitor Type", value: "Qualitative evidence layer" },
      { label: "Primary Focus", value: "Rivers, storage, municipal, food, energy, security" },
      { label: "Current Direction", value: "Uneven — structural water stress / Food buffers mixed and thinning" },
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

export const QUIET_METRICS = [
  {
    label: "Energy Pressure",
    value: "Broader Supply Transmission",
    note: "Saudi Arabia’s principal Hormuz-bypass route is disrupted and Brent is in a $100+ regime. Partial-to-broader energy transmission continues without a confirmed credit-market seizure. Physical oil continues clearing.",
  },
  {
    label: "AI Compute / Capability",
    value: "Security + Infrastructure Binding",
    note: "Lab safety-coordination and Microsoft’s human-control draft are adaptation around already-scored containment, while electricity, interconnection, and capital remain co-equal limits.",
  },
  {
    label: "Physical Constraints",
    value: "Multi-System Active Adaptation",
    note: "EIA record electricity demand, Texas power/water gating of data centers, and Colorado emergency releases remain binding, with operators adapting and normal system function intact.",
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
