/**
 * Hourglass Ledger — weekly index readings.
 * Update this file when publishing new weekly briefs.
 *
 * Global Pressure Index category scores and weighted calculation live in
 * global-pressure-index-data.ts — the public reading is derived there.
 */

import {
  GPI_CALIBRATION_NOTE,
  GPI_COMPUTED_READING,
  GPI_METHODOLOGY_SHORT,
  GPI_RECALIBRATION_DATE,
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

export const LEDGER_UPDATED = "Updated weekly — July 20, 2026";

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
      "Hourglass Ledger Global Pressure Index — 84° High Heat, Concentrated Pressure. Weekly reading across geopolitics, energy, financial conditions, infrastructure, supply chains, and coordination.",
    displayTitle: "Global Pressure Index",
    subnavLabel: "Global Pressure",
    hubDescription:
      "A composite degree reading across geopolitics, energy, financial conditions, infrastructure, supply chains, and coordination — high heat, concentrated rather than fully systemic.",
    kicker: "The Ledger Intelligence System",
    intro:
      "A weekly reading of global pressure across geopolitics, energy, commodities, financial conditions, infrastructure, supply chains, and coordination channels. The purpose is not to predict collapse. It is to observe when stress is structurally elevated, when flexibility compresses, and when multiple systems respond more slowly beneath still-resilient markets. The temperature measures pressure that has already transmitted into the system; escalation potential is stated separately in direction language.",
    updatedLabel: `Updated weekly — ${GPI_RECALIBRATION_DATE}`,
    // Derived from GPI_CATEGORIES — do not hard-code independently of component scores.
    reading: GPI_COMPUTED_READING,
    readingLabel: "Pressure Reading",
    status: "High and unstable",
    // Recalibration, not a weekly cooling of conditions — do not report a −9 weekly delta.
    weeklyDelta: 0,
    weeklyDeltaLabel: "Methodology reset — no comparable weekly delta",
    weeklyDeltaExplanation:
      "The scoring methodology was recalibrated on July 27, 2026. The 93° and 84° readings should not be interpreted as a nine-degree cooling in underlying conditions.",
    scaleLabels: ["Cold", "Stable", "Elevated", "Hot", "Critical"],
    scaleGradient: SCALE_GRADIENT_PRESSURE,
    summary:
      "Global pressure remains exceptionally high, but the strain is concentrated rather than fully systemic. The geopolitical and energy channels are operating near the extreme end of the scale. Disruption around critical shipping corridors, attacks on energy infrastructure, and uncertainty surrounding major export routes have raised the risk of a broader inflationary and supply shock. That pressure has not yet transmitted into a 2008- or COVID-style system event. Financial markets remain functional, credit spreads remain comparatively contained, broader financial-stress measures remain below crisis levels, and economic activity has not entered a synchronized global contraction. The distinction matters: the world is facing unusually dangerous escalation potential, but potential failure is not the same as realized systemic failure.",
    summaryLead: "The reading sits in",
    summaryEmphasis: "High Heat, Concentrated Pressure",
    summaryCompact:
      "84° — High Heat, Concentrated Pressure. Geopolitics and energy near extremes; credit markets and expansion still offset full systemic transmission.",
    weeklyNote:
      "Primary drivers remain energy corridors, geopolitical escalation, and shipping disruption. The primary offset remains functioning credit markets and continued economic expansion. Under the recalibrated methodology, extreme corridor and energy risk no longer automatically score near-crisis levels across financial, infrastructure, and institutional channels without confirmed transmission. Direction: high and unstable — escalation potential is elevated even while the current reading stays below collapse-era benchmarks.",
    weeklyNoteCompact:
      "High and unstable — corridor and energy heat concentrated; credit markets still functioning. Methodology recalibrated July 27, 2026.",
    methodPills: [
      { label: "Reading Type", value: "Weighted editorial index" },
      {
        label: "Primary Drivers",
        value: "Energy corridors, geopolitical escalation, shipping disruption",
      },
      { label: "Current Direction", value: "High and unstable" },
      {
        label: "Primary Offset",
        value: "Functioning credit markets and continued economic expansion",
      },
    ],
    recentReadings: [
      {
        week: "This Week",
        degrees: GPI_COMPUTED_READING,
        state: "High Heat",
        annotation: "Methodology recalibrated",
      },
      // Preserved as originally published (pre-recalibration series).
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
      "The scoring methodology was recalibrated on July 27, 2026. The 93° and 84° readings should not be interpreted as a nine-degree cooling in underlying conditions. Historical readings remain as originally published; This Week's card is annotated \"Methodology recalibrated.\"",
    watchingSectionTitle: "What We're Watching",
    editorialBlocks: [
      {
        title: "Hormuz & Bab el-Mandeb corridors",
        body: "Whether disruption through Hormuz and Bab el-Mandeb persists or broadens — including vessel risk, transit volumes, insurance conditions, and competing claims over route control.",
      },
      {
        title: "Oil, inflation & policy path",
        body: "Whether oil remains elevated long enough to materially affect inflation, consumption, and central-bank policy — distinct from a short-lived energy premium that never transmits.",
      },
      {
        title: "Credit, stress & volatility confirmation",
        body: "Whether corporate-credit spreads, financial-stress measures, or volatility begin confirming the geopolitical signal. Without that transmission, financial-system scores stay below crisis bands.",
      },
      {
        title: "Supply-chain transmission",
        body: "Whether supply-chain disruption spreads beyond energy shipping into manufacturing, freight, and final-goods availability.",
      },
      {
        title: "Electricity systems under demand",
        body: "Whether electricity systems continue operating normally under record demand or increasingly require emergency measures.",
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
      "High-attention, uneven clarity persists — official military framing, physical shipping evidence, confirmed vessel attacks with disputed actor attribution, and a Houthi embargo declaration without demonstrated enforcement compete in the same cycle. Oil's intraday $90 test and lower settlement are told differently across outlets; GPT-5.6 general availability and Kimi K3 product/API access add a parallel capability-versus-qualification story.",
    summaryCompact:
      "High-attention, uneven clarity — competing corridor frames, oil band ambiguity, and AI access stories without a clarity-score increase.",
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
    reading: 85,
    readingLabel: "Acceleration Reading",
    status: "Frontier Access Broadens, Grid-Bound",
    weeklyDelta: 1,
    scaleLabels: ["Early", "Building", "Rising", "Fast", "Surge"],
    scaleGradient: SCALE_GRADIENT_AI,
    summary:
      "Acceleration rose to 85 as frontier access broadened — OpenAI's GPT-5.6 family is generally available across ChatGPT, Codex, and the API with stronger performance-per-dollar, coding, tool use, and multi-agent operation, while Kimi K3 is available through Kimi products and API at competitive cost with full downloadable weights still pending. Compute, electricity, and deployment infrastructure remain binding constraints.",
    summaryCompact:
      "Frontier access broadens to 85 — GPT-5.6 general availability and Kimi K3 product/API access beneath continuing grid and power limits.",
    weeklyNote:
      "The reading moved to 85 because frontier capability, practical access, cost compression, competitive convergence, and real demand broadened together. GPT-5.6 Sol, Terra, and Luna are generally available across ChatGPT, Codex, and the OpenAI API rather than remaining limited to partner previews — bringing improved performance per dollar, stronger coding and agentic operation, broader tool use, and multi-agent capability into wider product surfaces. Kimi K3 is available through Kimi products and the Kimi API with strong reported benchmark performance and lower deployment or usage costs relative to several closed frontier tiers; full downloadable weights remain pending or incomplete, and not all vendor benchmark claims have been independently verified. Initial demand has pressed available capacity on some access paths. Claude Sonnet 5 remains a broadly deployed baseline beside these moves. Physical constraints still set practical pace after the early-July PJM peak and mid-July hot-weather operations under a renewed DOE order window. Enterprise adoption and coding integration continue; governance, energized capacity, and infrastructure readiness remain co-equal limits.",
    weeklyNoteCompact:
      "Frontier access broadens — GPT-5.6 general availability and Kimi K3 product/API access beneath continuing grid constraints.",
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
      "Precious materials remain strategically firm — central-bank accumulation and reserve diversification support the structural read, while gold trades around the $4,000 area under near-term real-yield and rate-expectation pressure from the energy frame. Selective natural-diamond pipeline adjustments continue; lab-grown price compression persists in commercial channels.",
    summaryLead: "Precious materials remain in a",
    summaryEmphasis: "strategically firm environment",
    summaryCompact:
      "Strategically firm — structural central-bank demand beneath near-term real-yield pressure, with selective diamond-pipeline adjustments and lab-grown compression.",
    weeklyNote:
      "No materials-regime change this week. Structural central-bank and diversification demand continue to support the reading, while near-term pressure from real yields and rate expectations — reinforced by the energy and inflation frame — keeps gold trading around the $4,000 area rather than breaking the strategic posture. Selective natural-diamond pipeline adjustments, including July sight pricing alignment, remain a segmented watch rather than broad market stress. Premium natural categories held selective firmness; commercial ranges remain price-sensitive. Lab-grown price compression persisted in mid-tier channels as an embedded factor, not a newly scored shock. Short-term price action alone does not move the index.",
    weeklyNoteCompact:
      "Strategically firm — central-bank demand, gold near $4,000 under real-yield pressure, selective diamond pipeline.",
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
        title: "Gold & central-bank demand",
        body: "Structural central-bank and diversification demand continue to support the reading. Near-term gold trading around the $4,000 area still shows real-yield and rate-expectation sensitivity as the energy premium feeds the policy path.",
      },
      {
        title: "Natural diamonds",
        body: "Selective natural-diamond pipeline adjustments, including July sight pricing alignment, remain segmented rather than a broad market break. Premium natural categories stay selectively firm in key sizes and cuts.",
      },
      {
        title: "Sourcing posture",
        body: "Segmentation persists between structural precious-material demand and selective diamond-pipeline softness, with continued lab-grown compression in commercial channels. Provenance, selective inventory, and patient sourcing remain preferable to reactive buying.",
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
    weeklyDelta: 0,
    scaleLabels: ["Low", "Rising", "Elevated", "High", "Critical"],
    scaleGradient: SCALE_GRADIENT_INFRASTRUCTURE,
    summary:
      "Strain remains elevated after PJM's early-July record peak and a mid-July hot-weather window that included Maximum Generation alerts and DOE Order 202-26-35 (July 14–21). No publicly confirmed broad blackout was found in the reviewed evidence; large-load and backup-generation flexibility remains a live concern beneath functioning systems.",
    summaryCompact:
      "Elevated strain — mid-July PJM alerts and a renewed DOE order window keep summer reliability live beneath still-functioning systems.",
    weeklyNote:
      "PJM's early-July preliminary all-time peak near 168 GW remains the summer benchmark. For July 14–17, PJM issued a Hot Weather Alert and Maximum Generation / Load Management alerts around elevated forecast peaks; DOE Order 202-26-35, effective July 14 through July 21, again authorized temporary environmental-permit flexibility for specified units and large-load backup-generation direction as a last resort. Publicly reviewed evidence does not show a confirmed broad blackout during that window; whether backup generation was dispatched is not stated here as a settled negative absent primary confirmation. Structural tightness remains: interconnection, transformers, and large-load integration still limit spare capacity. Systems continue to function; strain does not fall simply because an alert window was managed without a confirmed blackout.",
    weeklyNoteCompact:
      "Elevated strain holds — mid-July hot-weather alerts and DOE Order 202-26-35 keep summer reliability live.",
    methodPills: [
      { label: "Reading Type", value: "Physical infrastructure index" },
      { label: "Primary Focus", value: "Grid, power, transit, logistics" },
      { label: "Current Direction", value: "Elevated, operational strain" },
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
        title: "PJM summer reliability",
        body: "The early-July record peak was served without widespread blackout. The mid-July Hot Weather and Maximum Generation alert window, under DOE Order 202-26-35 through July 21, kept operational readiness elevated; spare capacity remains thin.",
      },
      {
        title: "Grid & large-load integration",
        body: "FERC large-load deadlines, data-center power demand, and concern about backup-generation flexibility continue to shape siting and interconnection — structural constraints remain after successive heat windows.",
      },
      {
        title: "Event logistics & transit",
        body: "World Cup host-city load remains a secondary operational layer — localized strain that may stay contained as the tournament progresses.",
      },
      {
        title: "Summer heat & reliability",
        body: "Summer heat remains an active reliability factor after early-July and mid-July alert windows — cooling and transmission stress stay operational even without a publicly confirmed broad blackout in the reviewed evidence.",
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
    value: "Concentrated Corridor Heat",
    note: "Energy corridors and shipping disruption remain near extremes — still offset by functioning credit markets rather than confirmed systemic transmission.",
  },
  {
    label: "AI Compute Load",
    value: "Access Broadening",
    note: "GPT-5.6 general availability and Kimi K3 product/API access broadened frontier diffusion; summer grid and large-load limits still set practical pace.",
  },
  {
    label: "Physical Constraints",
    value: "Operational Strain",
    note: "Mid-July PJM alerts and DOE Order 202-26-35 kept flexibility narrow beneath still-functioning systems; no publicly confirmed broad blackout in the reviewed evidence.",
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
