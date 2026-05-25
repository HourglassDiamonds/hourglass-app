/**
 * AI Capability Acceleration Index — weekly data.
 * Update values and copy here each week. Page layout is fixed in ai-capability-acceleration-index-view.
 */

export type AcaiFillVariant = "cool" | "neutral" | "warm" | "hot" | "critical";

export const ACAI_UPDATED_LABEL = "Updated weekly — May 19, 2026";

export const ACAI_READING = {
  score: 77,
  status: "Deployment-Bound Buildout",
  weeklyChange: -1,
  markerPosition: 77,
  readingLabel: "Acceleration Reading",
} as const;

export const ACAI_INTRO =
  "A weekly reading of how AI capability, deployment, and physical infrastructure are moving together — across models, agents, enterprise integration, power, and grid constraints. The purpose is not to forecast AGI. It is to track an industrial buildout: where software progress meets operational friction, energy limits, and organizational adaptation lag.";

export const ACAI_SUMMARY =
  "The composite reading sits in a deployment-bound industrial cycle. Massive infrastructure investment and accelerating rollout continue, but uneven enterprise adoption, integration timelines, and energy-and-grid constraints increasingly set the pace. Model capability remains elevated; diminishing visible surprise at the frontier is offset by scaling friction in power, cooling, transformers, and workflow reliability.";

export const ACAI_WEEKLY_SIGNAL =
  "Infrastructure demand, enterprise caution, and implementation friction weighed on the headline score even as coding and agent tooling advanced in selective lanes. Power contracts, grid access, cooling, and transmission delays are now routine limits on deployment — discussed alongside model releases, not beneath them.";

export const ACAI_METHOD_PILLS = [
  { label: "Reading Type", value: "Weighted capability index" },
  { label: "Primary Drivers", value: "Deployment, power, integration" },
  { label: "Current Direction", value: "Advancing, constraint-bound" },
] as const;

export const ACAI_RECENT_READINGS = [
  { week: "This Week", score: 77, state: "Accelerating" },
  { week: "Last Week", score: 78, state: "Accelerating" },
  { week: "2 Weeks Ago", score: 80, state: "Fast" },
  { week: "3 Weeks Ago", score: 82, state: "Fast" },
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
    text: "Frontier capability remains strong, but visible surprise at the margin is diminishing relative to deployment scale — releases matter less than integration, cost, and throughput in production.",
  },
  {
    name: "Agents & Tool Use",
    weight: "20% Weight",
    score: 76,
    band: "Rising",
    fill: "warm" as AcaiFillVariant,
    text: "Operational usefulness is increasing through connectors and managed workflows, but reliability, handoffs, and long-horizon task completion remain inconsistent in live environments.",
  },
  {
    name: "Coding & Software",
    weight: "18% Weight",
    score: 80,
    band: "Accelerating",
    fill: "warm" as AcaiFillVariant,
    text: "Meaningful acceleration in scaffolding, migration, and review — with integration, verification, and production guardrails still the limiting layers for many teams.",
  },
  {
    name: "Enterprise Deployment",
    weight: "14% Weight",
    score: 72,
    band: "Cautious",
    fill: "neutral" as AcaiFillVariant,
    text: "Adoption is accelerating cautiously — strongest in workflow augmentation and internal tooling, with broader operating-model change still uneven and supervision-heavy.",
  },
  {
    name: "Infrastructure Demand",
    weight: "12% Weight",
    score: 88,
    band: "Elevated",
    fill: "warm" as AcaiFillVariant,
    text: "A central pressure: data-center expansion, power, cooling, transformers, and grid access increasingly define deployment timelines alongside chip supply.",
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
    title: "Infrastructure moved to center",
    body: "Power, cooling, transformers, and grid interconnection are now discussed as co-equal constraints with model capability — not background capex footnotes.",
  },
  {
    title: "Enterprise friction visible",
    body: "Pilot-to-production gaps, review workflows, and organizational adaptation lag are tempering headline adoption even as internal tooling expands.",
  },
  {
    title: "Coding integration limits",
    body: "Software acceleration remains real, but verification, ownership, and deployment discipline increasingly define practical gains.",
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
    label: "Frontier Lab",
    title: "OpenAI",
    body: "Release cadence, enterprise APIs, agent products — weighed against deployment cost, reliability, and customer integration depth.",
  },
  {
    label: "Frontier Lab",
    title: "Anthropic",
    body: "Claude capability, coding workflows, connectors, safety posture, and compute partnerships under physical capacity limits.",
  },
  {
    label: "Frontier Lab",
    title: "xAI / Grok",
    body: "Model availability, API access, and enterprise fit — tracked alongside infrastructure and governance constraints.",
  },
  {
    label: "System Layer",
    title: "Data centers & power",
    body: "Power contracts, grid queues, transformer lead times, cooling, siting, and labor around AI load — primary pace-setters this cycle.",
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
      "Capability remains elevated, with less marginal surprise versus deployment and integration scale in production environments.",
  },
  {
    category: "Agents & Tool Use",
    weight: "20%",
    score: "76",
    contribution: "15.2",
    reason:
      "Usefulness rising in connectors and managed workflows; reliability and long-horizon consistency still uneven.",
  },
  {
    category: "Coding & Software",
    weight: "18%",
    score: "80",
    contribution: "14.4",
    reason:
      "Strong acceleration in development workflows; verification, integration, and deployment discipline remain limiting.",
  },
  {
    category: "Enterprise Deployment",
    weight: "14%",
    score: "72",
    contribution: "10.1",
    reason:
      "Cautious acceleration — workflow augmentation and internal tooling ahead of broad operating-model redesign.",
  },
  {
    category: "Infrastructure Demand",
    weight: "12%",
    score: "88",
    contribution: "10.6",
    reason:
      "Power, cooling, transformers, and grid access are central constraints on expansion — co-equal with software progress.",
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
  contribution: "76.8 → 77",
  reason:
    "Deployment-bound buildout: capability and infrastructure investment advance together, with energy, integration, and organizational friction setting practical pace.",
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
    name: "OpenAI — Research & Product Releases",
    body: "Frontier releases, enterprise APIs, agents — interpreted alongside deployment cost and reliability.",
  },
  {
    name: "Anthropic — Claude Updates & Safety Materials",
    body: "Capability, coding workflows, connectors, safety posture, and infrastructure partnerships.",
  },
  {
    name: "xAI — Grok Model Documentation",
    body: "Model availability, API access, and enterprise fit under the same physical and governance constraints.",
  },
  {
    name: "Infrastructure Reporting",
    body: "Data-center expansion, power, cooling, transformers, grid queues, and regional siting economics.",
  },
  {
    name: "Labor & Enterprise Signals",
    body: "Adoption pace, workflow redesign, hiring mix, integration timelines, and substitution pressure by sector.",
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
    "Deployment, infrastructure constraints, and integration friction shaped the reading this week.",
  milestones:
    "Developments that would justify a material change in the acceleration reading — grounded in operations, not hype.",
  frontierWatchlist:
    "Major labs and system layers worth tracking each week — capability and physical capacity together.",
  above85:
    "The reading is advancing but below disruptive territory. These developments would justify a higher score.",
  calculated:
    "A weighted editorial model constrained by releases, deployment pace, infrastructure demand, and operational reliability.",
  capabilityBands:
    "Bands keep the reading from drifting into hype — reserved for measurable capability, deployment, and system effects.",
  sources:
    "The reading is based on public model releases, company documentation, product updates, deployment signals, infrastructure reporting, and observed operational thresholds. It is an interpretive framework, not a forecast.",
} as const;
