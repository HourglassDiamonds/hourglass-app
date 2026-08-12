/**
 * Hourglass Ledger — weekly index readings.
 * Update this file when publishing new weekly briefs.
 *
 * Global Pressure: public page is an interim qualitative monitor
 * (global-pressure-monitor-data.ts). Numerical category scores and weighted
 * calculation remain in global-pressure-index-data.ts for the archived meter
 * and methodology rebuild — they are not rendered publicly.
 */

import {
  GPI_CALIBRATION_NOTE,
  GPI_COMPUTED_READING,
  GPI_METHODOLOGY_SHORT,
} from "./global-pressure-index-data";

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
  | "infrastructure-strain";

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

export const LEDGER_UPDATED = "Evidence reviewed through August 12, 2026";

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
    seoTitle: "Global Pressure Monitor",
    seoDescription:
      "Hourglass Ledger Global Pressure Monitor — interim qualitative status while the numerical index methodology is rebuilt and historically tested.",
    displayTitle: "Global Pressure Monitor",
    subnavLabel: "Global Pressure",
    hubDescription:
      "Very high external pressure / Partial energy transmission — Hormuz and Red Sea shipping stress remain elevated while broader credit-system function holds.",
    kicker: "The Ledger Intelligence System",
    intro:
      "An interim qualitative monitor of external threat pressure and systemic transmission. Numerical index readings remain paused on this page while the qualitative evidence framework is standardized and historically validated.",
    // Do not claim weekly numerical updates until the revised framework is operational.
    updatedLabel: "Interim status — methodology revision in progress",
    // Archived numerical series — still derived for rebuild work; not rendered publicly.
    reading: GPI_COMPUTED_READING,
    readingLabel: "Pressure Reading",
    status: "Very high external pressure / Partial energy transmission",
    weeklyDelta: 0,
    weeklyDeltaLabel: "Numerical series paused — methodology revision",
    weeklyDeltaExplanation:
      "Earlier numerical readings are archived and should not be interpreted as directly comparable. Numerical readings will return only after the revised model has been historically tested and documented.",
    scaleLabels: ["Cold", "Stable", "Elevated", "Hot", "Critical"],
    scaleGradient: SCALE_GRADIENT_PRESSURE,
    summary:
      "Shipping through Hormuz remains far below pre-conflict norms (Reuters-cited Kpler/LSEG single-digit counts versus ~130–140 daily). Renewed maritime attacks and stalled negotiations have supported Brent around $89. Credit markets have not confirmed a systemic financial transmission event.",
    summaryLead: "Current state:",
    summaryEmphasis: "Very high external pressure / Partial energy transmission",
    summaryCompact:
      "Very high external pressure / Partial energy transmission. Brent around $89; credit transmission still contained. Numerical readings paused.",
    weeklyNote:
      "Threat pressure remains very high around Hormuz and Bab el-Mandeb. System transmission is partial into energy prices and contained in credit: Brent around $89 as reopen hopes faded, while reviewed credit spreads remain near historically tight levels.",
    weeklyNoteCompact:
      "Very high external pressure; partial energy transmission; credit still contained. Numerical series paused.",
    methodPills: [
      { label: "Monitor Type", value: "Interim qualitative status" },
      {
        label: "Primary Drivers",
        value: "Hormuz transit, shipping attacks, energy premium",
      },
      {
        label: "Current Direction",
        value: "Unstable — energy premium reasserted as reopen hopes faded",
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
      "Methodology revision in progress. Earlier numerical readings are archived and should not be interpreted as directly comparable.",
    watchingSectionTitle: "What We're Watching",
    editorialBlocks: [
      {
        title: "Hormuz reopen vs continued constraint",
        body: "Whether diplomacy restores meaningful two-way transit — distinct from contested claims of control or recovered flows that vessel-tracking still does not fully corroborate.",
      },
      {
        title: "Oil, inflation & policy path",
        body: "Whether oil remains elevated long enough to materially affect inflation, consumption, and central-bank policy — beyond a short-lived risk premium.",
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
      "High-attention / Uneven clarity — recovered-flow claims, vessel-tracking prints, and reopen diplomacy still compete without a shared operational facts base.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A qualitative map of how narratives move through markets, media, policy, and institutions — not to chase hidden truths, but to track when different information layers begin describing the same systems story. The goal is orientation: where framing converges, where it diverges, and what remains underweighted.",
    updatedLabel: "Interim status — methodology revision in progress",
    reading: 85,
    readingLabel: "Signal Clarity",
    status: "High-attention / Uneven clarity",
    weeklyDelta: 0,
    scaleLabels: ["Quiet", "Clear", "Mixed", "Noisy", "Saturated"],
    scaleGradient: SCALE_GRADIENT_SIGNAL,
    summary:
      "High-attention, uneven clarity persists — official military framing, physical shipping evidence, confirmed vessel attacks with disputed actor attribution, and a Houthi embargo declaration without demonstrated enforcement compete in the same cycle. Oil's intraday $90 test and lower settlement are told differently across outlets; GPT-5.6 general availability and Kimi K3 product/API access add a parallel capability-versus-qualification story.",
    summaryCompact:
      "High-attention / Uneven clarity — competing corridor frames, oil band ambiguity, and AI access stories without a clarity improvement.",
    weeklyNote:
      "Signal density rose around corridor enforcement without improving clarity enough to move the reading. Coverage now splits among reimposed blockade descriptions, open-corridor claims, confirmed vessel attacks near Oman, and disputed attribution of who struck which ships. Official military framing and physical shipping evidence do not always describe the same operational facts base. A Houthi maritime-embargo declaration entered the cycle as a secondary corridor headline before sustained enforcement was demonstrated. Market outlets treated Brent's brief move above $90 and its high-$80s settlement as different stories. On the AI channel, GPT-5.6 general availability across ChatGPT, Codex, and the API sits beside Kimi K3 product and API access with full downloadable weights still pending — another instance of \"available\" describing different realities. Diplomatic and ceasefire language remains an offsetting frame. Density increased; clarity did not improve enough to warrant a higher reading.",
    weeklyNoteCompact:
      "Uneven clarity — competing blockade and shipping frames, oil band ambiguity, and layered AI access claims without a score increase.",
    methodPills: [
      { label: "Reading Type", value: "Editorial signal map" },
      { label: "Primary Channels", value: "Institutional, market, event, mainstream" },
      { label: "Current Direction", value: "Noisy, uneven clarity" },
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
        title: "Qualified access claims",
        body: "GPT-5.6 is generally available across ChatGPT, Codex, and the API, while Kimi K3 is usable through Kimi products and API with full downloadable weights still pending — \"available\" still describes different access paths in the same cycle.",
      },
      {
        title: "Corridor frame conflict",
        body: "Coverage spans reimposed blockade descriptions, open-corridor claims, confirmed vessel attacks, disputed attribution, and a Houthi embargo declaration without demonstrated sustained enforcement — raising attention without settling a shared operational facts base.",
      },
      {
        title: "Institutional & market framing",
        body: "Official military framing and physical shipping evidence diverge; oil's intraday $90 test and high-$80s settlement are sequenced differently across outlets. Diplomatic and ceasefire language remains an offsetting frame beside energy-risk coverage.",
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
      "Capability pace: Accelerating — consumer GPT-5.6 access broadened in August while Work/Codex versions remain distinct; deployment stays infrastructure-bound.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A qualitative monitor of how AI capability, deployment, and physical infrastructure move together: models, agents, enterprise integration, power, grid access, and organizational adaptation. The frame is operational and observational — not promotional.",
    updatedLabel: "Interim status — methodology revision in progress",
    reading: 85,
    readingLabel: "Acceleration Reading",
    status: "Capability pace: Accelerating",
    weeklyDelta: 1,
    scaleLabels: ["Early", "Building", "Rising", "Fast", "Surge"],
    scaleGradient: SCALE_GRADIENT_AI,
    summary:
      "Acceleration continues as frontier access broadened — OpenAI's GPT-5.6 family is generally available across ChatGPT, Codex, and the API with stronger performance-per-dollar, coding, tool use, and multi-agent operation, while Kimi K3 is available through Kimi products and API at competitive cost with full downloadable weights still pending. Compute, electricity, and deployment infrastructure remain binding constraints.",
    summaryCompact:
      "Capability pace accelerating — GPT-5.6 general availability and Kimi K3 product/API access beneath continuing grid and power limits.",
    weeklyNote:
      "Frontier capability, practical access, cost compression, competitive convergence, and real demand broadened together. GPT-5.6 Sol, Terra, and Luna are generally available across ChatGPT, Codex, and the OpenAI API rather than remaining limited to partner previews — bringing improved performance per dollar, stronger coding and agentic operation, broader tool use, and multi-agent capability into wider product surfaces. Kimi K3 is available through Kimi products and the Kimi API with strong reported benchmark performance and lower deployment or usage costs relative to several closed frontier tiers; full downloadable weights remain pending or incomplete, and not all vendor benchmark claims have been independently verified. Initial demand has pressed available capacity on some access paths. Claude Sonnet 5 remains a broadly deployed baseline beside these moves. Physical constraints still set practical pace after the early-July PJM peak and mid-July hot-weather operations under a renewed DOE order window. Enterprise adoption and coding integration continue; governance, energized capacity, and infrastructure readiness remain co-equal limits.",
    weeklyNoteCompact:
      "Frontier access broadening, infrastructure-bound — GPT-5.6 GA and Kimi K3 product/API access beneath grid limits.",
    methodPills: [
      { label: "Reading Type", value: "Capability + infrastructure index" },
      { label: "Primary Drivers", value: "Access, cost, power, deployment" },
      { label: "Current Direction", value: "Broadening, grid-bound" },
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
        title: "Frontier access broadening",
        body: "GPT-5.6 is generally available across ChatGPT, Codex, and the API with stronger performance-per-dollar, coding, tool use, and multi-agent operation — a clear step beyond partner-only preview access, while some sensitive capability tiers remain more qualified.",
      },
      {
        title: "International competitive diffusion",
        body: "Kimi K3 is available through Kimi products and API with competitive cost and strong reported benchmark performance; full downloadable weights remain pending. Competitive convergence is real without implying any single lab has settled the frontier.",
      },
      {
        title: "Continuing grid constraints",
        body: "Summer power limits remain operational after the early-July PJM peak and mid-July hot-weather alerts — physical infrastructure stays a co-equal pace-setter beside software capability and broader access.",
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
      "Strategically firm / Highly segmented — gold near $4,400 with strong official-sector demand; natural vs lab-grown diamond markets remain segmented.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A qualitative monitor of the material conditions behind fine jewelry — gold, platinum, natural diamonds, and the sourcing realities that shape quality, availability, and long-term value. The purpose is not to chase commodity headlines. It is to clarify when material markets are firm, selective, or shifting beneath the surface.",
    updatedLabel: "Interim status — methodology revision in progress",
    reading: 85,
    readingLabel: "Materials Reading",
    status: "Strategically firm",
    weeklyDelta: 0,
    scaleLabels: ["Soft", "Stable", "Firm", "Tight", "Constrained"],
    scaleGradient: SCALE_GRADIENT_MATERIALS,
    summary:
      "Precious materials remain strategically firm — World Gold Council Q2 data show a strong official-sector purchase rebound, while gold trades near the $4,400 area under near-term rate and energy-frame sensitivity. Natural vs lab-grown diamond markets remain segmented; lab-grown price compression persists in commercial channels.",
    summaryLead: "Precious materials remain in a",
    summaryEmphasis: "strategically firm environment",
    summaryCompact:
      "Strategically firm — official-sector demand beneath gold near $4,400, with selective diamond segmentation and lab-grown compression.",
    weeklyNote:
      "No materials-regime change this week. Structural official-sector demand continues to support the reading, while near-term gold trading near the $4,400 area reflects rate-path and energy-frame sensitivity rather than a jewelry-market break. Natural-diamond stability narratives remain selective; commercial ranges stay price-sensitive. Lab-grown price compression persists in mid-tier channels as an embedded factor, not a newly scored shock. Short-term price action alone does not move the monitor.",
    weeklyNoteCompact:
      "Strategically firm — official-sector demand, gold near $4,400, selective diamond segmentation.",
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
        body: "World Gold Council Q2 purchases rebounded strongly. Near-term gold trading around the $4,400 area still shows rate-expectation and energy-frame sensitivity without a materials-regime break.",
      },
      {
        title: "Natural diamonds",
        body: "Natural vs lab-grown segmentation continues. Premium natural categories stay selectively firm in key sizes and cuts; commercial ranges remain price-sensitive.",
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
      "Elevated infrastructure strain — functioning systems with narrowed flexibility as PJM large-load adequacy frameworks treat AI demand as a structural reliability problem.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A qualitative monitor of physical constraints beneath digital and industrial acceleration: AI data-center load, power demand, transformers, interconnection, cooling, transmission, labor, and permitting — where systems function but flexibility narrows.",
    updatedLabel: "Interim status — methodology revision in progress",
    reading: 87,
    readingLabel: "Infrastructure Strain",
    status: "Elevated infrastructure strain",
    weeklyDelta: 0,
    scaleLabels: ["Low", "Rising", "Elevated", "High", "Critical"],
    scaleGradient: SCALE_GRADIENT_INFRASTRUCTURE,
    summary:
      "Strain remains elevated as a structural large-load and resource-adequacy problem under PJM’s Interim Resource Adequacy / large-load framework. Expired mid-July emergency-order windows are historical context only. Systems continue to function with narrowed flexibility.",
    summaryCompact:
      "Elevated strain — PJM large-load adequacy frameworks keep flexibility narrow beneath still-functioning systems.",
    weeklyNote:
      "PJM’s IRAS / bring-your-own-capacity framing treats AI data-center growth as a binding reliability and cost-allocation problem, with proposed curtailment pathways for non-firm new large loads from 2027. Interconnection, transformers, and labor remain structural limits. Systems function; strain does not fall simply because summer emergency windows expired.",
    weeklyNoteCompact:
      "Elevated strain holds — structural large-load adequacy replaces expired July emergency-order language as the live story.",
    methodPills: [
      { label: "Reading Type", value: "Physical infrastructure index" },
      { label: "Primary Focus", value: "Grid, power, large-load adequacy" },
      { label: "Current Direction", value: "Elevated, structural strain" },
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
        title: "PJM large-load adequacy",
        body: "Whether IRAS / bring-your-own-capacity proposals advance at FERC and how new data-center loads secure firm service without shifting emergency risk onto other customers.",
      },
      {
        title: "Grid & interconnection",
        body: "Transformer lead times, interconnection queues, and energized-capacity timelines remain the practical choke points beneath AI load growth.",
      },
      {
        title: "Cooling, water & labor",
        body: "Whether large-load proposals increasingly stall on cooling, water, skilled trades, or local acceptance rather than software demand alone.",
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
    value: "Hormuz Constraint",
    note: "Hormuz transit remains a fraction of pre-conflict norms and Brent sits around $89 — partial energy transmission without confirmed credit-market seizure.",
  },
  {
    label: "AI Compute Load",
    value: "Access Broadening",
    note: "August ChatGPT GPT-5.6 updates broadened consumer access while Work/Codex versions remain distinct; PJM large-load adequacy still sets practical pace.",
  },
  {
    label: "Physical Constraints",
    value: "Structural Adequacy Strain",
    note: "PJM’s IRAS / large-load framework treats AI demand as a binding reliability problem beneath still-functioning systems; expired July emergency windows are historical context only.",
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
