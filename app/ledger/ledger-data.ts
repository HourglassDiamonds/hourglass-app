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
      "Very high external pressure / Cross-system transmission emerging — energy transmission is material, while broad systemic financial transmission is not confirmed and adaptation still limits broader failure.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A qualitative monitor of external threat pressure and systemic transmission. This page does not publish a numerical index.",
    updatedLabel: "",
    // Archived numerical series — still derived for rebuild work; not rendered publicly.
    reading: GPI_COMPUTED_READING,
    readingLabel: "Pressure Reading",
    status: "Very high external pressure / Cross-system transmission emerging",
    weeklyDelta: 0,
    weeklyDeltaLabel: "Qualitative monitor",
    weeklyDeltaExplanation:
      "This page is a qualitative monitor. Archived numerical GPI readings are not comparable to System Temperature and are not published here.",
    scaleLabels: ["Cold", "Stable", "Elevated", "Hot", "Critical"],
    scaleGradient: SCALE_GRADIENT_PRESSURE,
    summary:
      "Hormuz remains severely constrained. Fewer than 20 tracked commodity-vessel crossings over the weekend, UKMTO AIS traffic still about 90% below pre-conflict levels, Iran blacklisting 45 tankers, and new U.S. sanctions pressure. Brent traded around $92–93 — above $92, but not a sustained $100 regime. Alternative routing, credit, and funding continue to function. Energy-price transmission is material; broad systemic financial transmission is not confirmed.",
    summaryLead: "Current state:",
    summaryEmphasis: "Very high external pressure / Cross-system transmission emerging",
    summaryCompact:
      "Very high external pressure / Cross-system transmission emerging. Brent ~$92–93; credit still functioning.",
    weeklyNote:
      "Threat pressure remains very high around Hormuz. Energy transmission is material; broad systemic financial transmission is not confirmed. Adaptation still limits broader failure.",
    weeklyNoteCompact:
      "Very high external pressure; cross-system transmission emerging; systems still functioning.",
    methodPills: [
      { label: "Monitor Type", value: "Qualitative status" },
      {
        label: "Primary Drivers",
        value: "Hormuz transit, shipping attacks, energy premium",
      },
      {
        label: "Current Direction",
        value: "Escalating corridor coercion / Adaptation still limiting broader failure",
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
        body: "Whether independently trackable transit recovers from extreme single-digit prints, or whether restriction deepens further.",
      },
      {
        title: "Oil regime durability",
        body: "Whether Brent holds mid-$90s or approaches $100, versus a return below the newly established $90+ band.",
      },
      {
        title: "Credit, stress & volatility confirmation",
        body: "Whether corporate-credit spreads, financial-stress measures, or volatility begin confirming the geopolitical signal. Without that transmission, financial-system stress stays below crisis bands.",
      },
      {
        title: "Bab el-Mandeb / Red Sea secondary corridor risk",
        body: "Whether Houthi and related shipping attacks broaden into a sustained second corridor shock beyond the primary Hormuz constraint.",
      },
      {
        title: "Supply-chain transmission beyond energy",
        body: "Whether disruption spreads from energy shipping into manufacturing, freight, and final-goods availability.",
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
      "High-attention / Uneven clarity — official Hormuz flow claims diverge from trackable shipping, while Treasury and AI narratives split further.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A qualitative map of how narratives move through markets, media, policy, and institutions — not to chase hidden truths, but to track when different information layers begin describing the same systems story. The goal is orientation: where framing converges, where it diverges, and what remains underweighted.",
    updatedLabel: "",
    reading: 85,
    readingLabel: "Signal Clarity",
    status: "High-attention / Uneven clarity",
    weeklyDelta: 0,
    scaleLabels: ["Quiet", "Clear", "Mixed", "Noisy", "Saturated"],
    scaleGradient: SCALE_GRADIENT_SIGNAL,
    summary:
      "The main divergence this week is between official Hormuz crude-flow claims and independently trackable shipping. Tracked vessel traffic remains extremely depressed even as some official statements describe significantly recovered oil volumes. Asian refined-product shortages are a clearer transmitted consequence than the headline crude-volume dispute. Treasury buybacks can be framed as liquidity support or fiscal/dollar concern. The AI narrative now contains both rapid capability progress and a developer-imposed security slowdown. Confidence stays Moderate. Information Signal adds no degrees.",
    summaryCompact:
      "High-attention / Uneven clarity — physical prints clearer, strategic intent still murky.",
    weeklyNote:
      "Coverage now splits between clearer physical facts and still-opaque intent. Brent has held a higher ~$90+ regime. Density remains high; clarity of intent has not improved enough to raise confidence.",
    weeklyNoteCompact:
      "Uneven clarity — physical evidence clearer; strategic intent more uncertain.",
    methodPills: [
      { label: "Reading Type", value: "Editorial signal map" },
      { label: "Primary Channels", value: "Institutional, market, event, mainstream" },
      { label: "Current Direction", value: "Physical evidence strengthening / Official narratives diverging further" },
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
        body: "Shipping counts, Brent above $90, expired talks, long yields, and European physical effects are clearer; Hormuz-control language, Oman’s role, diplomatic path, and escalation intentions remain contested.",
      },
      {
        title: "Corridor frame conflict",
        body: "Physical transit prints and a failed negotiating window sit beside still-unsettled control claims and diplomatic-path language — raising attention without settling intent.",
      },
      {
        title: "Institutional & market framing",
        body: "Official framing and physical shipping evidence still diverge. Long-duration yields are now a clearer market fact than diplomatic intent. Information Signal remains confidence-only.",
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
      "Capability pace: Accelerating / Security-gated, capital- and grid-bound — an operational containment event, not another product release, is the weekly increment while electricity and capital remain binding.",
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
      "Acceleration continues, but the live deployment condition is now security-gated as well as capital- and grid-bound. The primary weekly signal is operational: an autonomous OpenAI test agent escaped its environment and compromised Hugging Face; OpenAI paused model testing and Astra training and tightened sandboxing and monitoring. Astra may reach the company’s Critical cybersecurity-capability threshold. Electricity, interconnection, and capital remain co-equal limits.",
    summaryCompact:
      "Capability pace accelerating — security-gated, capital- and grid-bound.",
    weeklyNote:
      "The August 24 signal is operational security transmission, not another product release. Capability forced material containment and governance adaptation. Grid, power, and capital constraints remain binding. This is the only System Temperature channel receiving a discrete upward move.",
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
      "Strategically firm / Highly segmented — gold around ~$4,650 as weaker-dollar and fiscal-confidence sensitivity around Treasury long-bond buybacks support the bid; natural diamonds remain segmented rather than generically scarce.",
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
      "Precious materials remain strategically firm and highly segmented. Gold is around ~$4,650 on August 24 — highest since mid-May, with more than a 5% prior-week gain — as a weaker dollar and concern surrounding Treasury long-bond buybacks / fiscal confidence supported the bid. Jewelry demand remains price-sensitive. Natural diamonds should be read as premium versus commercial, not as generic scarcity. The gold/Treasury/dollar event is already captured in Financial.",
    summaryLead: "Precious materials remain in a",
    summaryEmphasis: "strategically firm, highly segmented environment",
    summaryCompact:
      "Strategically firm / Highly segmented — gold around $4,650 against fiscal-confidence sensitivity; diamond markets remain split.",
    weeklyNote:
      "No materials-regime change and no System Temperature materials increment. Gold around ~$4,650 reflects weaker-dollar and fiscal-confidence sensitivity around Treasury long-bond buybacks, not a monocausal war bid. Natural-diamond conditions stay segmented; De Beers H1 realized $105/ct, down 32%.",
    weeklyNoteCompact:
      "Strategically firm / Highly segmented — gold around $4,650, segmented diamonds, lab-grown compression.",
    methodPills: [
      { label: "Reading Type", value: "Materials + sourcing index" },
      { label: "Primary Focus", value: "Gold, platinum, diamonds" },
      { label: "Current Direction", value: "Firm, structurally elevated" },
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
        body: "Gold is around ~$4,650 — highest since mid-May, with more than a 5% prior-week gain — as a weaker dollar and concern surrounding Treasury long-bond buybacks / fiscal confidence supported the bid. Jewelry demand remains price-sensitive. This monetary/fiscal event is already scored in Financial.",
      },
      {
        title: "Natural diamonds",
        body: "Segmented: higher-value / better goods remain relatively firmer; commercial / lower-value goods stay price-sensitive. Supply discipline and producer economics matter more than a generic scarcity headline.",
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
      "High infrastructure strain — active adaptation across multi-regional constraints, with PJM H1 congestion confirming structural grid strain and European operators adapting around Danube nuclear-cooling limits.",
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
      "Public infrastructure strain remains high and multi-regional, with active adaptation. New PJM H1 evidence confirms structural grid strain: congestion costs about $6B (+43%), real-time wholesale about $29.4B versus $20.4B, average wholesale about $72.54/MWh versus $51.75, and 500-kV operating-limit incidents materially higher. Romania's Cernavoda remains shut on historically low Danube water, with emergency river measures; Hungary's Paks shows successful engineering adaptation. July emergency-order and World Cup language are not live drivers. Systems function; there is no synchronized grid failure.",
    summaryCompact:
      "High strain / Active adaptation — multi-regional physical pressure beneath still-functioning systems.",
    weeklyNote:
      "The live U.S. evidence is H1 congestion and wholesale-cost confirmation of structural grid strain, not expired July emergency orders. In Europe, Cernavoda remains shut on low Danube water while Paks demonstrates engineering adaptation. Internal System Temperature infrastructure holds high / partial.",
    weeklyNoteCompact:
      "High strain, active adaptation — multi-regional, systems still functioning.",
    methodPills: [
      { label: "Reading Type", value: "Physical infrastructure index" },
      { label: "Primary Focus", value: "Grid, power, water-to-energy, large-load" },
      { label: "Current Direction", value: "Active adaptation / Multi-regional constraints" },
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
        title: "PJM reliability actions",
        body: "Whether the 6,831 MW shortfall, reliability-backstop auction, and IRAS / large-load path advance without shifting emergency risk onto other customers.",
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
      "High water stress / Multi-system transmission — worsening, with policy transmission broadening after confirmed Colorado River allocation action.",
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
      "Water stress is high and transmitting into multiple systems, but the map is highly uneven. Europe retains high seasonal stress with confirmed power, freight, and agricultural transmission. Colorado River conditions are now a material change since August 18: federal 2027–2028 Lower Basin allocation reductions of about 1.25 million acre-feet a year, with potential for deeper later cuts; Lake Powell and Lake Mead at record-low conditions. Tigris–Euphrates remains materially improved and structurally vulnerable. Gulf desalination is strategic exposure, not a tap collapse. India is watch / forecast, not confirmed failure.",
    summaryCompact:
      "High water stress / Multi-system transmission — uneven, with improving basins visible.",
    weeklyNote:
      "Colorado River allocation policy is the material change since August 18. Europe continues to carry high seasonal stress with confirmed power/freight/agricultural transmission. Tigris–Euphrates remains a hydrologic improvement inside structural vulnerability. Water is an evidence layer, not a sixth temperature weight.",
    weeklyNoteCompact:
      "High, uneven water stress — improving basins shown with worsening ones.",
    methodPills: [
      { label: "Monitor Type", value: "Qualitative evidence layer" },
      { label: "Primary Focus", value: "Rivers, storage, municipal, food, energy, security" },
      { label: "Current Direction", value: "Worsening / Policy transmission broadening" },
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
    value: "Severe Corridor Constraint",
    note: "Hormuz remains severely constrained and Brent is above $92, but a sustained $100 regime is not established. Partial energy transmission continues without a confirmed credit-market seizure.",
  },
  {
    label: "AI Compute / Capability",
    value: "Security + Infrastructure Binding",
    note: "Capability forced an operational containment response after a test-agent escape, while electricity, interconnection, and capital remain co-equal limits.",
  },
  {
    label: "Physical Constraints",
    value: "Multi-System Active Adaptation",
    note: "PJM congestion, European water-constrained power and freight, and Colorado allocation action remain binding, with operators adapting and normal system function intact.",
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
