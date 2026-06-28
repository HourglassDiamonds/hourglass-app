/**
 * AI Capability Acceleration Index — weekly data.
 * Update values and copy here each week. Page layout is fixed in ai-capability-acceleration-index-view.
 */

export type AcaiFillVariant = "cool" | "neutral" | "warm" | "hot" | "critical";

export const ACAI_UPDATED_LABEL = "Updated weekly — June 28, 2026";

export const ACAI_READING = {
  score: 83,
  status: "Power- and Grid-Bound Acceleration",
  weeklyChange: 1,
  markerPosition: 83,
  readingLabel: "Acceleration Reading",
} as const;

export const ACAI_INTRO =
  "A weekly reading of how AI capability, deployment, and physical infrastructure are moving together — across models, agents, enterprise integration, power, and grid constraints. The purpose is not to forecast AGI. It is to track an industrial buildout: where software progress meets operational friction, energy limits, and organizational adaptation lag.";

export const ACAI_SUMMARY =
  "Capability advances under physical limits — frontier movement remains meaningful but gated, while power, grid access, and large-load integration increasingly set practical pace. Deployment friction matters more than headline release cadence.";

export const ACAI_WEEKLY_SIGNAL =
  "Large-load grid integration moved into the regulatory foreground as FERC directed regional operators to revise data-center connection rules. A limited frontier preview added marginal capability signal without broad availability. Enterprise adoption and coding integration advanced; governance and energized capacity remain co-equal limits on deployment.";

export const ACAI_METHOD_PILLS = [
  { label: "Reading Type", value: "Weighted capability index" },
  { label: "Primary Drivers", value: "Power, grid, deployment" },
  { label: "Current Direction", value: "Advancing, grid-bound" },
] as const;

export const ACAI_RECENT_READINGS = [
  { week: "This Week", score: 83, state: "Accelerating" },
  { week: "Last Week", score: 82, state: "Accelerating" },
  { week: "2 Weeks Ago", score: 79, state: "Accelerating" },
  { week: "3 Weeks Ago", score: 77, state: "Accelerating" },
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
    text: "Limited frontier previews add marginal capability signal — meaningful but gated, with deployment friction and integration depth mattering more than release cadence in production environments.",
  },
  {
    name: "Agents & Tool Use",
    weight: "20% Weight",
    score: 77,
    band: "Rising",
    fill: "warm" as AcaiFillVariant,
    text: "Operational usefulness increases through connectors and managed workflows, but reliability, handoffs, and long-horizon task completion remain inconsistent in live environments.",
  },
  {
    name: "Coding & Software",
    weight: "18% Weight",
    score: 81,
    band: "Accelerating",
    fill: "warm" as AcaiFillVariant,
    text: "Continued acceleration in scaffolding, migration, and review — with verification, ownership, and deployment discipline defining practical gains for many teams.",
  },
  {
    name: "Enterprise Deployment",
    weight: "14% Weight",
    score: 74,
    band: "Cautious",
    fill: "neutral" as AcaiFillVariant,
    text: "Adoption advances through workflow dependence and internal tooling — strongest where integration paths are clear, with broader operating-model change still uneven.",
  },
  {
    name: "Infrastructure Demand",
    weight: "12% Weight",
    score: 92,
    band: "Elevated",
    fill: "warm" as AcaiFillVariant,
    text: "Policy-visible pace-setter: FERC large-load rules, grid interconnection, power contracts, and site selection define deployment timelines — increasingly limiting acceleration more than model interest alone.",
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
    score: 67,
    band: "Lagging",
    fill: "neutral" as AcaiFillVariant,
    text: "Policy, access control, and operational risk frameworks still trail deployment speed — especially where agents touch customer data and core systems.",
  },
] as const;

export const ACAI_WHAT_MOVED = [
  {
    title: "Grid integration became policy-visible",
    body: "FERC directed regional operators to revise large-load connection rules — power and grid access increasingly define deployment pace in regulatory as well as operational terms.",
  },
  {
    title: "Frontier movement remained gated",
    body: "Limited frontier previews add marginal capability signal without broad availability — deployment friction and governance outweigh headline release cadence in practical planning.",
  },
  {
    title: "Integration advanced under physical limits",
    body: "Enterprise adoption and coding-system integration progressed; energized capacity, utility responsiveness, and site selection remain co-equal constraints on expansion.",
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
    body: "FERC large-load rules, power contracts, grid queues, transformer lead times, cooling, siting, and labor around AI load — primary pace-setters this cycle.",
  },
  {
    label: "System Layer",
    title: "Enterprise integration",
    body: "Workflow dependence, internal tooling adoption, review layers, and organizational adaptation — how capability converts to operational use.",
  },
  {
    label: "Frontier Lab",
    title: "OpenAI",
    body: "Limited frontier previews, enterprise APIs, and deployment cost — weighed against integration depth, reliability, and infrastructure requirements.",
  },
  {
    label: "Frontier Lab",
    title: "Anthropic",
    body: "Coding workflows, connectors, safety posture, and compute partnerships under physical capacity and governance constraints.",
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
      "Limited frontier previews add marginal signal — meaningful but gated, with deployment scale mattering more than release cadence.",
  },
  {
    category: "Agents & Tool Use",
    weight: "20%",
    score: "77",
    contribution: "15.4",
    reason:
      "Usefulness rising in connectors and managed workflows; reliability and long-horizon consistency still uneven.",
  },
  {
    category: "Coding & Software",
    weight: "18%",
    score: "81",
    contribution: "14.6",
    reason:
      "Strong acceleration in development workflows; verification, integration, and deployment discipline remain limiting.",
  },
  {
    category: "Enterprise Deployment",
    weight: "14%",
    score: "74",
    contribution: "10.4",
    reason:
      "Cautious acceleration — workflow dependence and internal tooling ahead of broad operating-model redesign.",
  },
  {
    category: "Infrastructure Demand",
    weight: "12%",
    score: "92",
    contribution: "11.0",
    reason:
      "FERC large-load rules made grid integration policy-visible — power, utility responsiveness, and site selection increasingly the pace-setting layer.",
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
    score: "67",
    contribution: "4.0",
    reason:
      "Policy and operational risk frameworks lag deployment — especially for agent access to core systems and data.",
  },
] as const;

export const ACAI_CALCULATION_TOTAL = {
  contribution: "80.4 → 83",
  reason:
    "Power- and grid-bound acceleration: capability advances under physical limits, with policy-visible grid constraints and gated frontier movement setting practical pace.",
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
    body: "FERC large-load rules, data-center expansion, power, cooling, transformers, grid queues, and regional siting economics — primary pace-setters this cycle.",
  },
  {
    name: "Enterprise & Deployment Signals",
    body: "Adoption pace, workflow dependence, integration timelines, review layers, and organizational adaptation by sector.",
  },
  {
    name: "OpenAI — Research & Product Releases",
    body: "Limited frontier previews, enterprise APIs, and deployment cost — interpreted alongside integration depth and reliability.",
  },
  {
    name: "Anthropic — Claude Updates & Safety Materials",
    body: "Coding workflows, connectors, safety posture, and infrastructure partnerships under physical capacity limits.",
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
    "Policy-visible grid constraints and gated frontier movement shaped the reading this week — deployment friction over headline cadence.",
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
