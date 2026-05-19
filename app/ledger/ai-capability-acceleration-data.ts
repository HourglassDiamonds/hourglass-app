/**
 * AI Capability Acceleration Index — weekly data.
 * Update values and copy here each week. Page layout is fixed in ai-capability-acceleration-index-view.
 */

export type AcaiFillVariant = "cool" | "neutral" | "warm" | "hot" | "critical";

export const ACAI_UPDATED_LABEL = "Updated weekly — May 19, 2026";

export const ACAI_READING = {
  score: 82,
  status: "Accelerating",
  weeklyChange: 3,
  markerPosition: 82,
  readingLabel: "Acceleration Reading",
} as const;

export const ACAI_INTRO =
  "A weekly reading of how quickly frontier AI capability is advancing across reasoning, agents, deployment, and the infrastructure required to sustain it. The purpose is not to predict a singularity. It is to show when capability, adoption, and physical constraints begin moving together.";

export const ACAI_SUMMARY =
  "Capability remains in an accelerating band, near the upper end of pre-disruptive territory. Agentic software, coding systems, enterprise integration, and infrastructure demand are the clearest signals. Broad autonomous replacement is not yet the base case, but deployment and compute pressure are reinforcing each other.";

export const ACAI_WEEKLY_SIGNAL =
  "The reading moved higher as infrastructure pressure became more visible alongside continued agent and coding adoption. Power, grid labor, cooling, and chip access are shifting from background issues to practical limits on deployment pace.";

export const ACAI_METHOD_PILLS = [
  { label: "Reading Type", value: "Weighted capability index" },
  { label: "Primary Drivers", value: "Agents, coding, power demand" },
  { label: "Current Direction", value: "Accelerating, near threshold" },
] as const;

export const ACAI_RECENT_READINGS = [
  { week: "This Week", score: 82, state: "Accelerating" },
  { week: "Last Week", score: 79, state: "Accelerating" },
  { week: "2 Weeks Ago", score: 74, state: "Fast" },
  { week: "3 Weeks Ago", score: 70, state: "Fast" },
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
    score: 85,
    band: "Hot",
    fill: "hot" as AcaiFillVariant,
    text: "Frontier models remain strong across reasoning, coding, research, and enterprise availability.",
  },
  {
    name: "Agents & Tool Use",
    weight: "20% Weight",
    score: 84,
    band: "Hot",
    fill: "hot" as AcaiFillVariant,
    text: "Agents are entering workflows through connectors, managed agents, tool use, and domain-specific deployment.",
  },
  {
    name: "Coding & Software",
    weight: "18% Weight",
    score: 87,
    band: "Hot",
    fill: "hot" as AcaiFillVariant,
    text: "Coding remains a clear acceleration zone — useful for debugging, migration, scaffolding, and codebase work.",
  },
  {
    name: "Enterprise Deployment",
    weight: "14% Weight",
    score: 78,
    band: "Accelerating",
    fill: "warm" as AcaiFillVariant,
    text: "Enterprise adoption is moving from pilots toward workflow design, especially where AI tools can operate inside existing systems.",
  },
  {
    name: "Infrastructure Demand",
    weight: "12% Weight",
    score: 92,
    band: "Critical",
    fill: "critical" as AcaiFillVariant,
    text: "Compute, data centers, chips, power, cooling, and grid labor are now central constraints on AI growth.",
  },
  {
    name: "Labor Substitution",
    weight: "8% Weight",
    score: 62,
    band: "Firm",
    fill: "neutral" as AcaiFillVariant,
    text: "Replacement pressure is visible in specific workflows, but broad labor displacement remains uneven, supervised, and sector-specific.",
  },
  {
    name: "Governance & Risk",
    weight: "6% Weight",
    score: 69,
    band: "Rising",
    fill: "neutral" as AcaiFillVariant,
    text: "Safety, cyber, model access, misuse, privacy, and national security concerns are rising alongside deployment.",
  },
] as const;

export const ACAI_WHAT_MOVED = [
  {
    title: "Infrastructure became louder",
    body: "Data-center expansion, power contracts, grid labor, and cooling moved from background issue to active bottleneck.",
  },
  {
    title: "Agents kept entering workflows",
    body: "Connectors, managed agents, and domain workflows continue moving AI beyond chat into operational systems.",
  },
  {
    title: "Coding stayed hot",
    body: "Coding remains a fast adoption zone because output can be tested, reviewed, and deployed quickly.",
  },
] as const;

export const ACAI_MILESTONES = [
  {
    label: "Capability Trigger",
    title: "Reliable long-horizon agents",
    body: "Systems that can complete multi-hour or multi-day tasks with low supervision, tool use, memory, and consistent recovery from errors.",
  },
  {
    label: "Market Trigger",
    title: "Enterprise dependency",
    body: "Companies moving from pilots into AI-native operating models where teams are designed around agent workflows.",
  },
  {
    label: "Infrastructure Trigger",
    title: "Grid-scale AI demand",
    body: "Clear evidence that data center power demand is changing utility planning, energy contracts, regional grid priorities, or consumer cost structures.",
  },
] as const;

export const ACAI_FRONTIER_WATCHLIST = [
  {
    label: "Frontier Lab",
    title: "OpenAI",
    body: "Model releases, Codex, managed agents, enterprise deployment, and integration depth.",
  },
  {
    label: "Frontier Lab",
    title: "Anthropic",
    body: "Claude Code, connectors, enterprise services, safety posture, and compute partnerships.",
  },
  {
    label: "Frontier Lab",
    title: "xAI / Grok",
    body: "Model cadence, API access, agent tooling, and enterprise availability.",
  },
  {
    label: "System Layer",
    title: "Data centers & power",
    body: "Power contracts, grid delays, chip supply, cooling, and labor around AI load.",
  },
] as const;

export const ACAI_ABOVE_85 = [
  {
    label: "Threshold Trigger",
    title: "Autonomous delivery",
    body: "AI completing meaningful business workflows from start to finish without constant human correction.",
  },
  {
    label: "Threshold Trigger",
    title: "Visible job redesign",
    body: "Major employers restructuring teams around AI agents rather than simply adding AI tools to existing jobs.",
  },
  {
    label: "Threshold Trigger",
    title: "Infrastructure bottleneck",
    body: "Power availability, chips, cooling, or skilled grid labor becoming the limiting factor in AI deployment timelines.",
  },
] as const;

export const ACAI_CALCULATION_ROWS = [
  {
    category: "Frontier Models",
    weight: "22%",
    score: "85",
    contribution: "18.7",
    reason:
      "Frontier model capability remains high across reasoning, coding, research, multimodal interaction, and enterprise access.",
  },
  {
    category: "Agents & Tool Use",
    weight: "20%",
    score: "84",
    contribution: "16.8",
    reason:
      "Agent tooling moved higher as managed agents, connectors, MCP-style apps, and domain workflows became more practical.",
  },
  {
    category: "Coding & Software",
    weight: "18%",
    score: "87",
    contribution: "15.7",
    reason:
      "Software remains one of the fastest-moving commercial capability zones, especially for codebase-aware and terminal-native workflows.",
  },
  {
    category: "Enterprise Deployment",
    weight: "14%",
    score: "78",
    contribution: "10.9",
    reason:
      "Adoption is moving from pilots toward embedded systems, but many workflows still require supervision and human review.",
  },
  {
    category: "Infrastructure Demand",
    weight: "12%",
    score: "92",
    contribution: "11.0",
    reason:
      "Compute, power, chips, cooling, data center capacity, and grid labor constraints are now direct limits on AI expansion.",
  },
  {
    category: "Labor Substitution",
    weight: "8%",
    score: "62",
    contribution: "5.0",
    reason:
      "Visible pressure exists, but broad substitution remains uneven and concentrated in specific workflows.",
  },
  {
    category: "Governance & Risk",
    weight: "6%",
    score: "69",
    contribution: "4.1",
    reason:
      "Security, access control, misuse, cyber, privacy, and national-security concerns are rising with capability and deployment.",
  },
] as const;

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
    meaning: "Capability is improving quickly across several domains.",
    examples:
      "Coding agents, multimodal workflow tools, stronger reasoning, broader API adoption.",
  },
  {
    band: "75–84",
    condition: "Accelerating",
    meaning: "Models, agents, infrastructure, and deployment begin reinforcing each other.",
    examples:
      "Reliable task execution, enterprise workflow redesign, rising data center constraints.",
  },
  {
    band: "85–100",
    condition: "Disruptive",
    meaning: "Capability is creating visible structural change.",
    examples:
      "Reliable autonomous workflows, major labor redesign, infrastructure bottlenecks, rapid institutional response.",
  },
] as const;

export const ACAI_SOURCES = [
  {
    name: "OpenAI — Research & Product Releases",
    body: "Frontier release cadence, Codex, managed agents, and enterprise deployment.",
  },
  {
    name: "Anthropic — Claude Updates & Safety Materials",
    body: "Claude capability, Claude Code, connectors, enterprise deployment, and safety posture.",
  },
  {
    name: "xAI — Grok Model Documentation",
    body: "Model availability, API capability, cadence, and agent tooling.",
  },
  {
    name: "Infrastructure Reporting",
    body: "Data-center expansion, grid pressure, chips, cooling, and labor signals.",
  },
  {
    name: "Labor & Enterprise Signals",
    body: "Adoption, workflow redesign, hiring shifts, and substitution pressure.",
  },
] as const;

export const ACAI_FOOTER_NOTE =
  "The AI Capability Acceleration Index is a weekly editorial framework. It compresses public signals into a directional reading — whether progress is steady, accelerating, or beginning to affect work, infrastructure, and markets.";

export const ACAI_SCALE_LABELS = [
  "Slow",
  "Steady",
  "Fast",
  "Accelerating",
  "Disruptive",
] as const;
