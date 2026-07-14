/**
 * AI Capability Acceleration Index — weekly data.
 * Update values and copy here each week. Page layout is fixed in ai-capability-acceleration-index-view.
 */

export type AcaiFillVariant = "cool" | "neutral" | "warm" | "hot" | "critical";

export const ACAI_UPDATED_LABEL = "Updated weekly — July 14, 2026";

export const ACAI_READING = {
  score: 84,
  status: "Power- and Grid-Bound Acceleration",
  weeklyChange: 0,
  markerPosition: 84,
  readingLabel: "Acceleration Reading",
} as const;

export const ACAI_INTRO =
  "A weekly reading of how AI capability, deployment, and physical infrastructure are moving together — across models, agents, enterprise integration, power, and grid constraints. The purpose is not to forecast AGI. It is to track an industrial buildout: where software progress meets operational friction, energy limits, and organizational adaptation lag.";

export const ACAI_SUMMARY =
  "Capability remains advanced through broad Claude Sonnet 5 deployment across consumer, enterprise, coding, and API surfaces — while frontier access stays gated and summer grid tightness continues to bound practical pace after the early-July PJM peak and a new Hot Weather Alert for July 14–17.";

export const ACAI_WEEKLY_SIGNAL =
  "No new frontier capability shock moved the reading. Claude Sonnet 5's late-June broad availability remains the last clear deployment step; partner-only frontier previews and government-coordinated release gates stay separate from that baseline. Physical constraints continue to set practical pace: PJM managed a record early-July peak without blackout, and a Hot Weather Alert covers July 14–17. Enterprise adoption and coding integration hold; governance, energized capacity, and access qualification remain co-equal limits.";

export const ACAI_METHOD_PILLS = [
  { label: "Reading Type", value: "Capability + infrastructure index" },
  { label: "Primary Drivers", value: "Power, grid, deployment" },
  { label: "Current Direction", value: "Advancing, grid-bound" },
] as const;

export const ACAI_RECENT_READINGS = [
  { week: "This Week", score: 84, state: "Accelerating" },
  { week: "Last Week", score: 84, state: "Accelerating" },
  { week: "2 Weeks Ago", score: 83, state: "Accelerating" },
  { week: "3 Weeks Ago", score: 82, state: "Accelerating" },
] as const;

export const ACAI_CAPABILITY_BENCHMARKS = [
  { name: "Chatbot Era", score: 35, note: "Text assistant phase" },
  { name: "Multimodal Era", score: 55, note: "Text, image, voice" },
  { name: "Coding Agent Era", score: 68, note: "Software acceleration" },
  { name: "Autonomous Workflow Era", score: 85, note: "Reliable task chains" },
  { name: "Labor Shock Era", score: 95, note: "Broad substitution" },
] as const;

export const ACAI_CAPABILITY_READINGS = [
  {
    name: "Frontier Models",
    weight: "22% Weight",
    score: 78,
    band: "Elevated",
    fill: "warm" as AcaiFillVariant,
    text: "Frontier capability remains meaningful but gated — partner-only previews and government-coordinated release paths separate headline movement from broad availability.",
  },
  {
    name: "Agents & Tool Use",
    weight: "20% Weight",
    score: 79,
    band: "Rising",
    fill: "warm" as AcaiFillVariant,
    text: "Claude Sonnet 5 broadened agentic and tool-use capability at a widely deployed tier — operational usefulness rising, with reliability and long-horizon consistency still uneven.",
  },
  {
    name: "Coding & Software",
    weight: "18% Weight",
    score: 82,
    band: "Accelerating",
    fill: "warm" as AcaiFillVariant,
    text: "Continued acceleration in scaffolding, migration, and review through broadly available coding surfaces — verification and deployment discipline still define practical gains.",
  },
  {
    name: "Enterprise Deployment",
    weight: "14% Weight",
    score: 75,
    band: "Cautious",
    fill: "neutral" as AcaiFillVariant,
    text: "Sonnet 5 default availability across plans advanced workflow dependence — strongest where integration paths are clear, with broader operating-model change still uneven.",
  },
  {
    name: "Infrastructure Demand",
    weight: "12% Weight",
    score: 93,
    band: "Elevated",
    fill: "warm" as AcaiFillVariant,
    text: "Summer power limits remain a binding constraint after the early-July PJM peak — the Hot Weather Alert for July 14–17 keeps deployment pace tied to grid and large-load readiness alongside model interest.",
  },
  {
    name: "Labor Substitution",
    weight: "8% Weight",
    score: 66,
    band: "Widening",
    fill: "neutral" as AcaiFillVariant,
    text: "Gradual but widening pressure in repetitive knowledge workflows — supervised, sector-specific, and rarely broad autonomous replacement at scale.",
  },
  {
    name: "Governance & Risk",
    weight: "6% Weight",
    score: 68,
    band: "Lagging",
    fill: "neutral" as AcaiFillVariant,
    text: "Government-coordinated release gates and access qualification add policy friction — operational risk frameworks still trail deployment speed in core systems.",
  },
] as const;

export const ACAI_WHAT_MOVED = [
  {
    title: "Prior Sonnet 5 baseline holds",
    body: "Claude Sonnet 5 remains generally available across consumer, enterprise, coding, and API surfaces — last week's clearest capability gain, unchanged as a new shock this week.",
  },
  {
    title: "Summer grid constraints continue",
    body: "PJM managed a record early-July peak without blackout; a Hot Weather Alert for July 14–17 keeps power and large-load limits operational beside software capability.",
  },
  {
    title: "Access remains qualified",
    body: "Frontier models stay behind partner and government-coordinated gates — broad deployment and gated previews describe different capability realities in the same cycle.",
  },
] as const;

export const ACAI_MILESTONES = [
  {
    label: "Capability Trigger",
    title: "Reliable multi-step workflows",
    body: "Agents completing multi-hour operational tasks with consistent recovery, auditability, and low rework — not demo-level tool chains.",
  },
  {
    label: "Market Trigger",
    title: "Embedded enterprise operations",
    body: "Material share of core workflows running on governed AI systems with defined SLAs, not adjunct chat or isolated pilots.",
  },
  {
    label: "Infrastructure Trigger",
    title: "Grid-visible AI load",
    body: "Documented utility planning, interconnection, or regional power allocation shifts driven by sustained data-center load growth.",
  },
] as const;

export const ACAI_FRONTIER_WATCHLIST = [
  {
    label: "System Layer",
    title: "Data centers & power",
    body: "PJM summer operations, Hot Weather Alert posture, FERC large-load rules, power contracts, grid queues, and cooling — operational pace-setters this cycle.",
  },
  {
    label: "System Layer",
    title: "Enterprise integration",
    body: "Sonnet 5 default availability, workflow dependence, review layers, and organizational adaptation — how capability converts to operational use.",
  },
  {
    label: "Frontier Lab",
    title: "OpenAI",
    body: "Partner-gated frontier previews and enterprise APIs — weighed against integration depth, reliability, and infrastructure requirements.",
  },
  {
    label: "Frontier Lab",
    title: "Anthropic",
    body: "Broad Sonnet 5 deployment, coding workflows, connectors, and release-gate dynamics under physical capacity constraints.",
  },
] as const;

export const ACAI_ABOVE_85 = [
  {
    label: "Threshold Trigger",
    title: "Governed autonomous delivery",
    body: "AI completing defined business workflows end-to-end with audit trails and acceptable error rates — not episodic demos.",
  },
  {
    label: "Threshold Trigger",
    title: "Visible operating-model shift",
    body: "Employers restructuring teams around agent workflows with budget and headcount implications — beyond tool add-ons.",
  },
  {
    label: "Threshold Trigger",
    title: "Hard infrastructure ceiling",
    body: "Power, cooling, or grid access clearly capping regional deployment timelines despite capital availability.",
  },
] as const;

export const ACAI_CALCULATION_ROWS = [
  {
    category: "Frontier Models",
    weight: "22%",
    score: "78",
    contribution: "17.2",
    reason:
      "Frontier capability meaningful but gated — partner and government-coordinated release paths separate headlines from broad availability.",
  },
  {
    category: "Agents & Tool Use",
    weight: "20%",
    score: "79",
    contribution: "15.8",
    reason:
      "Sonnet 5 broadened agentic capability at wide deployment; reliability and long-horizon consistency still uneven.",
  },
  {
    category: "Coding & Software",
    weight: "18%",
    score: "82",
    contribution: "14.8",
    reason:
      "Strong acceleration through broadly available coding surfaces; verification and deployment discipline remain limiting.",
  },
  {
    category: "Enterprise Deployment",
    weight: "14%",
    score: "75",
    contribution: "10.5",
    reason:
      "Sonnet 5 default availability advanced workflow dependence — operating-model redesign still uneven.",
  },
  {
    category: "Infrastructure Demand",
    weight: "12%",
    score: "93",
    contribution: "11.2",
    reason:
      "Summer grid and power limits remain operational after the early-July PJM peak; Hot Weather Alert for July 14–17 keeps physical pace-setting live.",
  },
  {
    category: "Labor Substitution",
    weight: "8%",
    score: "66",
    contribution: "5.3",
    reason:
      "Gradual widening in repetitive knowledge work — supervised and uneven, not economy-wide autonomous replacement.",
  },
  {
    category: "Governance & Risk",
    weight: "6%",
    score: "68",
    contribution: "4.1",
    reason:
      "Release gates and access qualification add policy friction — frameworks lag deployment in core systems.",
  },
] as const;

export const ACAI_CALCULATION_TOTAL = {
  contribution: "80.9 → 84",
  reason:
    "Power- and grid-bound acceleration: broad Sonnet 5 deployment beneath gated frontier access and operational grid constraints.",
} as const;

export const ACAI_CAPABILITY_BANDS = [
  {
    band: "0–39",
    condition: "Slow",
    meaning: "Incremental capability movement.",
    examples: "Chatbot improvements, isolated demos, limited business adoption.",
  },
  {
    band: "40–59",
    condition: "Steady",
    meaning: "Clear improvement, but mostly tool-level rather than workflow-level.",
    examples:
      "Better assistants, stronger multimodal features, modest enterprise integration.",
  },
  {
    band: "60–74",
    condition: "Fast",
    meaning: "Capability improving across several domains with uneven deployment.",
    examples:
      "Coding agents, workflow tools, pilot-scale enterprise use, early infrastructure strain.",
  },
  {
    band: "75–84",
    condition: "Accelerating",
    meaning: "Deployment, infrastructure, and capability interact — progress is real but friction-bound.",
    examples:
      "Scaled internal tooling, data-center and power constraints, integration and review layers.",
  },
  {
    band: "85–100",
    condition: "Disruptive",
    meaning: "Measurable structural change in work, infrastructure allocation, or market design.",
    examples:
      "Governed autonomous workflows at scale, major labor redesign, grid-visible AI load, rapid institutional adaptation.",
  },
] as const;

export const ACAI_SOURCES = [
  {
    name: "Infrastructure Reporting",
    body: "PJM emergency operations, DOE orders, FERC large-load rules, data-center expansion, power, cooling, and regional siting economics.",
  },
  {
    name: "Enterprise & Deployment Signals",
    body: "Sonnet 5 availability, adoption pace, workflow dependence, integration timelines, and organizational adaptation by sector.",
  },
  {
    name: "OpenAI — Research & Product Releases",
    body: "Partner-gated frontier previews, enterprise APIs, and deployment cost — interpreted alongside integration depth and reliability.",
  },
  {
    name: "Anthropic — Claude Updates & Safety Materials",
    body: "Sonnet 5 broad deployment, coding workflows, connectors, and release-gate dynamics under physical capacity limits.",
  },
  {
    name: "Labor & Workforce Signals",
    body: "Workflow redesign, hiring mix, and substitution pressure by sector — supervised and uneven.",
  },
] as const;

export const ACAI_FOOTER_NOTE =
  "The AI Capability Acceleration Index is a weekly editorial framework. It compresses public signals into a directional reading — whether progress is steady, deployment-bound, or beginning to affect work, infrastructure, and markets — without techno-prophecy or acceleration theater.";

export const ACAI_SCALE_LABELS = [
  "Slow",
  "Steady",
  "Fast",
  "Accelerating",
  "Disruptive",
] as const;

export const ACAI_SECTION_SUBTITLES = {
  whatMoved:
    "Broad Sonnet 5 deployment and operational grid constraints shaped the reading — gated frontier access and physical limits over headline cadence.",
  milestones:
    "Developments that would justify a material change in the acceleration reading — grounded in operations, not hype.",
  frontierWatchlist:
    "System layers and integration paths worth tracking each week — capability and physical capacity together.",
  above85:
    "The reading is advancing but below disruptive territory. These developments would justify a higher score.",
  calculated:
    "A weighted editorial model constrained by deployment pace, integration depth, infrastructure demand, and operational reliability.",
  capabilityBands:
    "Bands keep the reading from drifting into hype — reserved for measurable capability, deployment, and system effects.",
  sources:
    "The reading is based on public model releases, company documentation, product updates, deployment signals, infrastructure reporting, and observed operational thresholds. It is an interpretive framework, not a forecast.",
} as const;
