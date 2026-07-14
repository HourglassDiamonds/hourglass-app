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

export const LEDGER_UPDATED = "Updated weekly — July 14, 2026";

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
    reading: 93,
    readingLabel: "Pressure Reading",
    status: "Elevated, Corridor Relief Retraced",
    weeklyDelta: 2,
    scaleLabels: ["Cold", "Stable", "Elevated", "Hot", "Critical"],
    scaleGradient: SCALE_GRADIENT_PRESSURE,
    summary:
      "Hormuz corridor relief has retraced — transit volumes fell again after renewed vessel attacks and the fraying of the June ceasefire framework. Oil's risk premium returned toward the mid-to-high $80s on Brent; corridor governance, insurance, and enforcement claims remain unresolved beneath still-functioning markets.",
    summaryLead: "The system remains in an",
    summaryEmphasis: "elevated environment with corridor relief retraced",
    summaryCompact:
      "Corridor relief retraced — Hormuz traffic relapsed and oil's risk premium returned beneath rate-sensitive financial conditions and ongoing summer grid tightness.",
    weeklyNote:
      "The fragile corridor relief read of early July did not hold. After the June ceasefire framework frayed, vessel attacks and renewed U.S.–Iran exchanges pulled Hormuz traffic back toward multi-week lows, while oil reversed from near-pre-conflict levels toward the mid-to-high $80s on Brent. The U.S. announced plans for a proposed 20% fee on Hormuz cargo and scheduled the reimposition of a naval blockade against Iranian shipping — attributed as announced, proposed, or scheduled for enforcement measures, not settled control of the strait. Official June CPI showed meaningful temporary disinflation — headline −0.4% month over month and 3.5% year over year, with core CPI flat at 0.0% month over month and 2.6% year over year — largely through energy; that print precedes the renewed oil escalation and does not yet capture it. Forward inflation and rate risk have nonetheless re-entered the frame as yields responded to the energy shock. Markets remained functional. Russia sanctions pressure and the EU's July 15 oil-price-cap decision remain secondary watch items, not the week's primary driver. Summer grid reliability stayed elevated after PJM's early-July peak and a new Hot Weather Alert for July 14–17. This week confirms a retracing of corridor relief inside an already elevated regime — not a prediction of immediate crisis.",
    weeklyNoteCompact:
      "Corridor relief retraced — Hormuz traffic relapsed, oil's risk premium returned, and forward inflation risk re-entered beneath still-functioning markets.",
    methodPills: [
      { label: "Reading Type", value: "Weighted editorial index" },
      { label: "Primary Drivers", value: "Corridor confidence, energy premium, rates" },
      { label: "Current Direction", value: "Elevated, relief retraced" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 93, state: "Elevated" },
      { week: "Last Week", degrees: 91, state: "Elevated" },
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
        body: "Transit confidence slipped again after vessel attacks and the fraying of the June framework. Traffic remained depressed relative to the late-June recovery window; AIS darkening and ship-to-ship workarounds show improvisation under risk, not normalized passage. Competing claims over route control matter more than any single declaration that the strait is open or closed.",
      },
      {
        title: "Energy, prices & financial conditions",
        body: "Oil's risk premium returned as corridor confidence thinned. June CPI captured temporary energy-led disinflation that predates this week's escalation; the renewed oil move reintroduces forward inflation and rate sensitivity beneath still-functioning markets.",
      },
      {
        title: "Secondary watch: sanctions & physical constraints",
        body: "The EU's July 15 oil-price-cap decision and Russia sanctions enforcement remain active channels, but secondary to the corridor reverse. PJM's early-July peak was managed without blackout; a new Hot Weather Alert for July 14–17 keeps summer reliability live.",
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
      "High-attention, uneven clarity persists — Hormuz framing now splits among corridor-open, corridor-risk, fee, and blockade narratives in the same cycle. June CPI's temporary disinflation and the renewed oil escalation are being told as sequential rather than simultaneous stories. Qualified AI access claims and embedded event-fraud risk remain background.",
    summaryCompact:
      "High-attention, uneven clarity — competing Hormuz control claims alongside sequenced CPI and oil narratives, with qualified AI access still unresolved.",
    weeklyNote:
      "The information environment intensified around corridor governance without justifying a clarity-score change. Competing claims — Iran asserting route control or closure, the U.S. asserting openness while announcing a proposed Hormuz cargo fee and scheduling blockade reimposition against Iranian shipping — appear in the same news cycle without a shared operational facts base. Market coverage shifted from oil near pre-conflict levels to a restored risk premium; institutional coverage reopened ceasefire-framework failure. In July 14 semiannual Monetary Policy Report testimony, Chairman Warsh pledged resolute commitment to restoring price stability and held the funds-rate range at 3½–3¾ percent from the June meeting, while offering limited forward guidance — leaving market energy-risk repricing less anchored by explicit policy signals. Official June CPI offered a temporary disinflation frame that does not yet include this week's oil move. Access-qualification friction in AI coverage and World Cup fraud risk remain embedded. Signal density rose; clarity did not improve enough to warrant a higher reading.",
    weeklyNoteCompact:
      "Uneven clarity — competing Hormuz frames and sequenced CPI-versus-oil stories without a clarity-score increase.",
    methodPills: [
      { label: "Reading Type", value: "Editorial signal map" },
      { label: "Primary Channels", value: "Institutional, market, event, mainstream" },
      { label: "Current Direction", value: "Noisy, uneven clarity" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 85, state: "Mixed" },
      { week: "Last Week", degrees: 85, state: "Mixed" },
      { week: "2 Weeks Ago", degrees: 85, state: "Mixed" },
      { week: "3 Weeks Ago", degrees: 84, state: "Mixed" },
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
        body: "\"Released,\" \"available,\" and \"deployed\" increasingly describe different realities — geography, government approval, account tier, and partner access matter. The policy-gated model-release cycle remains structural background.",
      },
      {
        title: "Corridor frame conflict",
        body: "Hormuz coverage now spans open-corridor claims, closed-corridor claims, proposed fees, and scheduled blockade reimposition in the same cycle — raising attention without settling an operational facts base.",
      },
      {
        title: "Institutional & market framing",
        body: "Chairman Warsh's July 14 Monetary Policy Report testimony emphasized price-stability commitment with limited forward guidance, while markets repriced energy and rate risk after the oil reverse. June CPI and the renewed escalation remain sequential stories in coverage.",
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
    weeklyDelta: 0,
    scaleLabels: ["Early", "Building", "Rising", "Fast", "Surge"],
    scaleGradient: SCALE_GRADIENT_AI,
    summary:
      "Capability remains advanced through broad Claude Sonnet 5 deployment across consumer, enterprise, coding, and API surfaces — while frontier access stays gated and summer grid tightness continues to bound practical pace after the early-July PJM peak and a new Hot Weather Alert for July 14–17.",
    summaryCompact:
      "Power- and grid-bound acceleration — broad Sonnet 5 deployment beneath gated frontier access and continuing summer grid tightness.",
    weeklyNote:
      "No new frontier capability shock moved the reading. Claude Sonnet 5's late-June broad availability remains the last clear deployment step; partner-only frontier previews and government-coordinated release gates stay separate from that baseline. Physical constraints continue to set practical pace: PJM managed a record early-July peak without blackout, and a Hot Weather Alert covers July 14–17. Enterprise adoption and coding integration hold; governance, energized capacity, and access qualification remain co-equal limits.",
    weeklyNoteCompact:
      "Grid-bound acceleration holds — prior Sonnet 5 gains beneath continuing summer power constraints.",
    methodPills: [
      { label: "Reading Type", value: "Capability + infrastructure index" },
      { label: "Primary Drivers", value: "Power, grid, deployment" },
      { label: "Current Direction", value: "Advancing, grid-bound" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 84, state: "Accelerating" },
      { week: "Last Week", degrees: 84, state: "Accelerating" },
      { week: "2 Weeks Ago", degrees: 83, state: "Accelerating" },
      { week: "3 Weeks Ago", degrees: 82, state: "Accelerating" },
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
        title: "Broad deployment baseline",
        body: "Claude Sonnet 5 remains generally available across consumer, enterprise, coding, and API surfaces — meaningful agentic and tool-use capability at a widely deployed tier, distinct from partner-only frontier previews.",
      },
      {
        title: "Gated frontier access",
        body: "Frontier models remain behind government-coordinated previews and partner gates — capability signals exist, but \"released\" and \"available\" describe different realities depending on access path and approval status.",
      },
      {
        title: "Continuing grid constraints",
        body: "Summer power limits remain operational after the early-July PJM peak — a Hot Weather Alert for July 14–17 keeps physical infrastructure as a co-equal pace-setter beside software capability.",
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
      "Precious materials remain strategically firm — central-bank accumulation and reserve diversification support the structural read, while gold shows near-term real-yield sensitivity under a restored energy and rate-risk frame. Selective natural diamond categories stay firm; commercial ranges remain price-sensitive.",
    summaryLead: "Precious materials remain in a",
    summaryEmphasis: "strategically firm environment",
    summaryCompact:
      "Strategically firm — central-bank gold demand and supply discipline, with selective diamond-pipeline softness and embedded lab-grown compression.",
    weeklyNote:
      "No materials-regime change this week. Central-bank gold demand remains a structural support beneath near-term real-yield sensitivity as the renewed oil and rate frame firms yields. De Beers' July sight pricing alignment stays a selective pipeline watch rather than broad market stress. Premium natural categories held selective firmness; commercial ranges remain price-sensitive. Lab-grown compression persisted in mid-tier channels as an embedded factor, not a new shock.",
    weeklyNoteCompact:
      "Strategically firm — central-bank demand, selective diamond pipeline, gold still real-yield sensitive.",
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
        body: "Central-bank net buying continues to support the structural read. Near-term gold movement still shows real-yield sensitivity as the restored energy premium feeds rate-path uncertainty.",
      },
      {
        title: "Natural diamonds",
        body: "De Beers' July sight rough-price alignment remains selective rather than a broad loosening. Premium natural categories stay selectively firm in key sizes and cuts.",
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
    weeklyDelta: 0,
    scaleLabels: ["Low", "Rising", "Elevated", "High", "Critical"],
    scaleGradient: SCALE_GRADIENT_INFRASTRUCTURE,
    summary:
      "Strain remains elevated after PJM served a record early-July peak through emergency demand response without widespread blackout. Flexibility stayed narrow: a new Hot Weather Alert covers July 14–17 as summer reliability remains an active constraint beneath functioning systems.",
    summaryCompact:
      "Elevated strain — early-July PJM peak managed, with a new Hot Weather Alert for July 14–17 keeping summer reliability live.",
    weeklyNote:
      "PJM confirmed a preliminary all-time peak near 168 GW on July 2, managed with emergency demand response and temporary DOE 202(c) authority; the large-load backup-generation action was warned but not issued. Orders covering that window have since expired. Structural tightness remains: interconnection, transformers, and large-load integration still limit spare capacity. PJM issued a Hot Weather Alert for July 14–17 with elevated forecast peaks. Systems continue to function; strain does not fall simply because the prior emergency was successfully managed.",
    weeklyNoteCompact:
      "Elevated strain holds — early-July peak managed; Hot Weather Alert for July 14–17 keeps summer reliability live.",
    methodPills: [
      { label: "Reading Type", value: "Physical infrastructure index" },
      { label: "Primary Focus", value: "Grid, power, transit, logistics" },
      { label: "Current Direction", value: "Elevated, operational strain" },
    ],
    recentReadings: [
      { week: "This Week", degrees: 87, state: "Elevated" },
      { week: "Last Week", degrees: 87, state: "Elevated" },
      { week: "2 Weeks Ago", degrees: 86, state: "Elevated" },
      { week: "3 Weeks Ago", degrees: 85, state: "Elevated" },
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
        body: "The early-July record peak was served without widespread blackout, proving extreme load can clear under emergency procedures. A new Hot Weather Alert for July 14–17 keeps operational readiness elevated; spare capacity remains thin.",
      },
      {
        title: "Grid & large-load integration",
        body: "FERC large-load deadlines and data-center power demand continue to shape siting and interconnection — structural constraints remain after the acute heat peak.",
      },
      {
        title: "Event logistics & transit",
        body: "World Cup host-city load remains a secondary operational layer — localized strain that may stay contained as the tournament progresses.",
      },
      {
        title: "Summer heat & reliability",
        body: "Summer heat remains an active reliability factor after the early-July emergency window — cooling and transmission stress stay operational even without a new blackout event.",
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
    value: "Relief Retraced",
    note: "Hormuz traffic relapsed and oil's risk premium returned — routing, insurance, and corridor governance remain unresolved.",
  },
  {
    label: "AI Compute Load",
    value: "Grid-Bound",
    note: "Capability gains remain real; summer grid alerts and large-load integration still set practical pace.",
  },
  {
    label: "Physical Constraints",
    value: "Operational Strain",
    note: "Early-July PJM peak was managed; a new Hot Weather Alert for July 14–17 keeps flexibility narrow beneath functioning systems.",
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
