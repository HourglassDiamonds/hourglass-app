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
      "Very high external pressure / Broader energy transmission — partial flow recovery has not rebuilt depleted inventories or refined-product slack; financial transmission remains contained.",
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
      "Energy buffers remain low despite partial production and routing recovery. Inventory draws, weak distillate stocks, elevated oil prices, and constrained routing keep transmission broad. Long yields remain elevated and labor reserve is thinning, while contained credit and low claims prevent escalation.",
    summaryLead: "Current state:",
    summaryEmphasis: "Very high external pressure / Broader energy transmission",
    summaryCompact:
      "Very high external pressure / Broader energy transmission. Energy slack Low; financial system functioning.",
    weeklyNote:
      "Threat pressure remains very high. Partial flow recovery cools outage risk, but depleted buffers keep energy transmission broad. Contained financial stress limits broader failure.",
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
        value: "Partial flow recovery / Low buffers and elevated prices keep transmission broad",
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
        title: "Hormuz and bypass durability",
        body: "Whether September's partial increase in shipments persists long enough to rebuild inventories, or reverses under renewed disruption.",
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
      "High-attention / Physical evidence converging — official October releases sharpen the evidence while cross-system framing remains uneven.",
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
      "Official energy, labor, market, grid, food, and AI releases sharpen the distinction between pressure and failure. Partial oil-flow recovery, weaker payroll momentum, contained credit, higher food prices, active grid adaptation, and broader AI access are kept in their own evidence lanes. Confidence stays Moderate; Information Signal adds no degrees.",
    summaryCompact:
      "High-attention / Physical evidence converging — restoration and policy outcome clearer; reserve durability uncertain.",
    weeklyNote:
      "The evidence stack is more precise, but pressure is not uniformly cooler and reserve durability remains uncertain. Confidence stays Moderate.",
    weeklyNoteCompact:
      "Physical evidence converging; duration and policy path still uncertain.",
    methodPills: [
      { label: "Reading Type", value: "Editorial signal map" },
      { label: "Primary Channels", value: "Institutional, market, event, mainstream" },
      { label: "Current Direction", value: "Official evidence sharper / Cross-system framing still uneven" },
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
        body: "Partial oil-flow recovery and weaker payroll momentum are observed; depleted energy buffers and elevated long yields persist; contained spreads, low claims, and stable unemployment and hours are the principal disconfirmations.",
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
      "Capability pace: Accelerating — GPT-6 broadened frontier access while safety controls and physical deployment constraints remain binding.",
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
      "GPT-6 and Claude Haiku 5.5 broaden capability and deployment, while new first-party safety work shows that verification and containment remain operational gates. Electricity, interconnection, capital, cooling, and organizational adaptation remain co-equal limits. Technology / AI holds High / Partial.",
    summaryCompact:
      "Capability pace accelerating — security-gated, capital- and grid-bound.",
    weeklyNote:
      "The October 7 releases materially update the narrative but stay inside the existing High / Partial channel: capability and access broadened alongside tighter safety evidence and persistent physical constraints.",
    weeklyNoteCompact:
      "Accelerating capability; industrialization capital- and grid-bound.",
    methodPills: [
      { label: "Reading Type", value: "Capability + infrastructure index" },
      { label: "Primary Drivers", value: "Capability, capital, power, deployment" },
      { label: "Current Direction", value: "Broadening at frontier scale / Security-, capital-, and grid-bound" },
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
        body: "GPT-6 became the broadly deployed OpenAI baseline on October 7, while Claude Haiku 5.5 expanded the fast, lower-cost frontier. Agents, coding, search, and adaptive interfaces continue to broaden.",
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
      "Strategically firm / Highly segmented — gold remains rate-sensitive while September natural-diamond gains broadened selectively.",
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
      "Precious materials remain strategically firm and highly segmented. September gold weakened under yields and the dollar despite ETF inflows. Silver, platinum, and palladium show no independent regime break. Natural-diamond gains broadened across key sizes, but lower-quality commercial goods remain pressured.",
    summaryLead: "Precious materials remain in a",
    summaryEmphasis: "strategically firm, highly segmented environment",
    summaryCompact:
      "Strategically firm / Highly segmented — gold cooling on rates; diamond markets remain split.",
    weeklyNote:
      "No materials-regime change and no System Temperature increment. Gold stays rate-sensitive; natural-diamond recovery broadened selectively rather than becoming generic scarcity.",
    weeklyNoteCompact:
      "Strategically firm / Highly segmented — gold cooling, segmented diamonds, lab-grown compression.",
    methodPills: [
      { label: "Reading Type", value: "Materials + sourcing index" },
      { label: "Primary Focus", value: "Gold, platinum, diamonds" },
      { label: "Current Direction", value: "Gold rate-sensitive / Natural-diamond recovery broadening selectively" },
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
        body: "September gold weakened as yields, the dollar, and futures positioning outweighed continuing ETF inflows. Jewelry demand remains price-sensitive; the rates/dollar event is already scored in Financial.",
      },
      {
        title: "Natural diamonds",
        body: "Segmented: September RAPI gains broadened across 0.30-, 0.50-, 1-, and 3-carat benchmarks, while lower-quality small goods remained under lab-grown pressure. This is not generic scarcity.",
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
      "High infrastructure strain — strong electricity demand and large computational loads keep reliability pressure structural, while standards and planning show active adaptation.",
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
      "Public infrastructure strain remains high. Strong third-quarter electricity use and NERC's large-load focus confirm a structural planning and operations challenge. Standards development and enhanced fuel-assurance analysis show active adaptation without national grid failure.",
    summaryCompact:
      "High strain / Active adaptation — multi-regional physical pressure beneath still-functioning systems.",
    weeklyNote:
      "Large-load reliability pressure is structural, not merely episodic weather stress. Active standards and planning work prevent escalation beyond High / Partial.",
    weeklyNoteCompact:
      "High strain, active adaptation — multi-regional, systems still functioning.",
    methodPills: [
      { label: "Reading Type", value: "Physical infrastructure index" },
      { label: "Primary Focus", value: "Grid, power, water-to-energy, large-load" },
      { label: "Current Direction", value: "Large-load reliability pressure / Active standards and planning adaptation" },
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
      "How much capacity remains to absorb additional pressure. Energy is Low; households, labor, food, and grid are Thinning; the financial system is Healthy.",
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
      "October 10 evidence moves Labor from Healthy to Thinning; all other reserve states hold. Buffer Health remains independent from the 74° System Temperature reading.",
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
      "High water stress / Multi-system transmission — U.S. drought improved while food-price transmission rose, without a verified physical shortage.",
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
      "Water stress remains high and uneven. U.S. drought coverage improved and Lake Powell edged higher, while September food prices rose on weather and transport disruption. A still-large forecast crop prevents a shortage call. Water is an evidence layer, not a sixth temperature weight.",
    summaryCompact:
      "High water stress / Multi-system transmission — uneven, with improving basins visible.",
    weeklyNote:
      "U.S. drought improved while food-price transmission rose. The divergence changes the current narrative without creating a separate temperature degree.",
    weeklyNoteCompact:
      "High, uneven water stress — improving basins shown with worsening ones.",
    methodPills: [
      { label: "Monitor Type", value: "Qualitative evidence layer" },
      { label: "Primary Focus", value: "Rivers, storage, municipal, food, energy, security" },
      { label: "Current Direction", value: "Uneven — U.S. drought improves while food-price transmission rises" },
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
    note: "Partial East-West Pipeline and Hormuz-flow recovery has not rebuilt depleted inventories or weak distillate stocks. Broad energy transmission continues without a confirmed credit-market seizure.",
  },
  {
    label: "AI Compute / Capability",
    value: "Security + Infrastructure Binding",
    note: "GPT-6 and Claude Haiku 5.5 broaden access while published safeguards and unintended-action research keep security, electricity, interconnection, and capital as co-equal limits.",
  },
  {
    label: "Physical Constraints",
    value: "Multi-System Active Adaptation",
    note: "Strong electricity demand, computational-load standards, Texas power/water gating, and Colorado structural shortage remain binding, with operators adapting and normal system function intact.",
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
