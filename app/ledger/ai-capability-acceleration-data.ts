/**
 * AI Capability Acceleration — weekly data.
 * ARCHIVED NUMERICAL SERIES — public page is a qualitative AI Capability Monitor.
 * Scores, recent readings, benchmarks, calculation rows, and bands remain for rebuild.
 */

import {
  LEDGER_EVIDENCE_CUTOFF,
  LEDGER_METHODOLOGY_VERSION,
  latestSnapshot,
  type LedgerMonitorSeries,
} from "./ledger-monitor-framework";

export type AcaiFillVariant = "cool" | "neutral" | "warm" | "hot" | "critical";

export const ACAI_UPDATED_LABEL =
  "Interim status — methodology revision in progress";

export const ACAI_READING = {
  score: 85,
  status: "Frontier Access Broadens, Grid-Bound",
  weeklyChange: 1,
  markerPosition: 85,
  readingLabel: "Acceleration Reading",
} as const;

export const ACAI_INTRO =
  "A weekly reading of how AI capability, deployment, and physical infrastructure are moving together — across models, agents, enterprise integration, power, and grid constraints. The purpose is not to forecast AGI. It is to track an industrial buildout: where software progress meets operational friction, energy limits, and organizational adaptation lag.";

export const ACAI_SUMMARY =
  "Frontier access continues to broaden. OpenAI’s August 6 ChatGPT updates improved GPT-5.6 Sol for Plus/Pro users and expanded GPT-5.6 Luna access for Free users, while explicitly leaving Work and Codex on the previously released July model versions. Capability pace remains accelerating beneath grid and large-load constraints — deployment is still infrastructure-bound.";

export const ACAI_WEEKLY_SIGNAL =
  "OpenAI published August 6 ChatGPT updates for GPT-5.6 Sol and Luna, expanding consumer access while stating that Codex and ChatGPT Work remain on the July GPT-5.6 versions. Kimi K3 product/API access from mid-July remains part of the competitive landscape. PJM’s large-load / Interim Resource Adequacy framework keeps physical power and curtailment pathways as co-equal pace-setters beside software access.";

export const ACAI_ASSESSMENT =
  "Consumer access broadened without collapsing the distinction between ChatGPT chat surfaces and Work/Codex deployments. Vendor capability claims still require careful qualification. Enterprise adoption continues unevenly. Energized capacity, interconnection, and large-load adequacy remain binding limits on real-world deployment pace.";

export const ACAI_METHOD_PILLS = [
  { label: "Reading Type", value: "Capability + infrastructure index" },
  { label: "Primary Drivers", value: "Access, cost, power, deployment" },
  { label: "Current Direction", value: "Broadening, grid-bound" },
] as const;

export const ACAI_RECENT_READINGS = [
  { week: "This Week", score: 85, state: "Accelerating" },
  { week: "Last Week", score: 84, state: "Accelerating" },
  { week: "2 Weeks Ago", score: 84, state: "Accelerating" },
  { week: "3 Weeks Ago", score: 83, state: "Accelerating" },
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
    score: 83,
    band: "Elevated",
    fill: "warm" as AcaiFillVariant,
    text: "OpenAI reported GPT-5.6 general availability across ChatGPT, Codex, and the API; Kimi reported competitive product and API access for K3. Capability signals are no longer limited to partner previews.",
  },
  {
    name: "Agents & Tool Use",
    weight: "20% Weight",
    score: 82,
    band: "Rising",
    fill: "warm" as AcaiFillVariant,
    text: "GPT-5.6 strengthened agentic operation, tool use, and multi-agent coordination at widely available surfaces. Long-horizon reliability remains uneven.",
  },
  {
    name: "Coding & Software",
    weight: "18% Weight",
    score: 84,
    band: "Accelerating",
    fill: "warm" as AcaiFillVariant,
    text: "Coding acceleration continued through GPT-5.6, Claude Sonnet 5, and Kimi coding surfaces. Verification and deployment discipline still define practical gains.",
  },
  {
    name: "Enterprise Deployment",
    weight: "14% Weight",
    score: 77,
    band: "Cautious",
    fill: "neutral" as AcaiFillVariant,
    text: "Wider access advanced workflow dependence where integration paths are clear. Broader operating-model change remains uneven and infrastructure-gated.",
  },
  {
    name: "Infrastructure Demand",
    weight: "12% Weight",
    score: 93,
    band: "Elevated",
    fill: "warm" as AcaiFillVariant,
    text: "PJM summer operations and a renewed DOE order window kept power and large-load limits operational beside rising model access.",
  },
  {
    name: "Labor Substitution",
    weight: "8% Weight",
    score: 66,
    band: "Widening",
    fill: "neutral" as AcaiFillVariant,
    text: "Gradual but widening pressure in repetitive knowledge workflows — supervised, sector-specific, and rarely broad autonomous replacement.",
  },
  {
    name: "Governance & Risk",
    weight: "6% Weight",
    score: 70,
    band: "Lagging",
    fill: "neutral" as AcaiFillVariant,
    text: "Broader availability reduced some access friction, while trusted-access gates and risk frameworks still trail deployment speed.",
  },
] as const;

export const ACAI_WHAT_MOVED = [
  {
    title: "August ChatGPT access updates",
    body: "OpenAI’s August 6 updates improved GPT-5.6 Sol for Plus/Pro ChatGPT users and expanded GPT-5.6 Luna for Free users, while stating that Work and Codex remain on the July model versions.",
  },
  {
    title: "Qualified access still matters",
    body: "“Updated” does not mean identical capability across ChatGPT chat, Work, and Codex. Competitive product/API paths such as Kimi K3 remain part of the landscape; deployment still requires qualification.",
  },
  {
    title: "Grid and large-load constraints still bind",
    body: "PJM’s large-load / Interim Resource Adequacy framing keeps physical power and curtailment pathways as co-equal pace-setters — acceleration continues without removing infrastructure limits.",
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
    body: "PJM summer operations, DOE order windows, FERC large-load rules, power contracts, grid queues, and cooling — operational pace-setters this cycle.",
  },
  {
    label: "System Layer",
    title: "Enterprise integration",
    body: "GPT-5.6 and Sonnet 5 workflow dependence, review layers, and organizational adaptation — how broader access converts to operational use.",
  },
  {
    label: "Frontier Lab",
    title: "OpenAI",
    body: "GPT-5.6 Sol, Terra, and Luna general availability across ChatGPT, Codex, and the API — weighed against integration depth, reliability, and infrastructure requirements.",
  },
  {
    label: "Frontier Lab",
    title: "Anthropic",
    body: "Broad Sonnet 5 deployment, coding workflows, connectors, and release-gate dynamics under physical capacity constraints.",
  },
  {
    label: "Frontier Lab",
    title: "Moonshot / Kimi",
    body: "Kimi K3 product and API availability, competitive cost, capacity pressure, and the still-pending full downloadable-weight release.",
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
    score: "83",
    contribution: "18.3",
    reason:
      "GPT-5.6 general availability and Kimi K3 product/API access broadened frontier access beyond partner previews; some sensitive tiers remain more qualified.",
  },
  {
    category: "Agents & Tool Use",
    weight: "20%",
    score: "82",
    contribution: "16.4",
    reason:
      "Stronger agentic operation, tool use, and multi-agent capability at widely available surfaces; long-horizon reliability still uneven.",
  },
  {
    category: "Coding & Software",
    weight: "18%",
    score: "84",
    contribution: "15.1",
    reason:
      "Coding acceleration through GPT-5.6, Sonnet 5, and Kimi coding surfaces; verification and deployment discipline remain limiting.",
  },
  {
    category: "Enterprise Deployment",
    weight: "14%",
    score: "77",
    contribution: "10.8",
    reason:
      "Wider access and competitive cost tiers advanced workflow dependence — operating-model redesign still uneven.",
  },
  {
    category: "Infrastructure Demand",
    weight: "12%",
    score: "93",
    contribution: "11.2",
    reason:
      "Summer grid and power limits remain operational after early-July and mid-July heat windows; physical pace-setting stays live.",
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
    score: "70",
    contribution: "4.2",
    reason:
      "Broader GA reduced some access friction; trusted-access gates and risk frameworks still lag deployment in core systems.",
  },
] as const;

export const ACAI_CALCULATION_TOTAL = {
  contribution: "81.3 → 85",
  reason:
    "Frontier access broadens beneath grid constraints: GPT-5.6 general availability and Kimi K3 product/API diffusion with continuing power and deployment limits.",
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
    name: "OpenAI — GPT-5.6 Product Release",
    body: "Official July 9, 2026 general-availability documentation for GPT-5.6 Sol, Terra, and Luna across ChatGPT, Codex, and the API — capability, efficiency, and access interpreted without promotional framing.",
  },
  {
    name: "Kimi / Moonshot — K3 Documentation",
    body: "Official Kimi K3 product and API availability, pricing, and stated weight-release timing, supplemented by independent reporting on benchmarks, demand, and access conditions.",
  },
  {
    name: "Infrastructure Reporting",
    body: "PJM emergency and hot-weather operations, DOE orders, FERC large-load rules, data-center expansion, power, cooling, and regional siting economics.",
  },
  {
    name: "Enterprise & Deployment Signals",
    body: "Frontier-model availability, adoption pace, workflow dependence, integration timelines, and organizational adaptation by sector.",
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
  "The AI Capability Acceleration Index is an editorial framework. It compresses public signals into a directional reading — whether progress is steady, deployment-bound, or beginning to affect work, infrastructure, and markets — without techno-prophecy or acceleration theater.";

export const ACAI_SCALE_LABELS = [
  "Slow",
  "Steady",
  "Fast",
  "Accelerating",
  "Disruptive",
] as const;

export const ACAI_SECTION_SUBTITLES = {
  whatMoved:
    "GPT-5.6 general availability and Kimi K3 product/API access broadened frontier diffusion — capability, cost, and competition over headline cadence alone.",
  milestones:
    "Developments that would justify a material change in the acceleration reading — grounded in operations, not hype.",
  frontierWatchlist:
    "System layers and integration paths worth tracking each week — capability and physical capacity together.",
  above85:
    "Capability pace is accelerating but not yet disruptive. These developments would justify a stronger qualitative assessment.",
  calculated:
    "A weighted editorial model constrained by deployment pace, integration depth, infrastructure demand, and operational reliability.",
  capabilityBands:
    "Bands keep the reading from drifting into hype — reserved for measurable capability, deployment, and system effects.",
  sources:
    "The reading is based on public model releases, company documentation, product updates, deployment signals, infrastructure reporting, and observed operational thresholds. It is an interpretive framework, not a forecast.",
} as const;

/** Append-only public series. Future reviews push a new snapshot. */
export const ACAI_SERIES: LedgerMonitorSeries = {
  id: "ai-capability",
  methodologyVersion: LEDGER_METHODOLOGY_VERSION,
  snapshots: [
    {
      reviewDate: "August 3, 2026",
      evidenceCutoff: "August 3, 2026",
      currentState: "Capability pace: Accelerating",
      currentDirection: "Broadening, infrastructure-bound",
      previousState: "Accelerating (archived numerical series)",
      materialChangeSummary:
        "OpenAI reported GPT-5.6 general availability; Kimi reported K3 product and API access. Physical infrastructure constraints remained binding.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "OpenAI",
          title: "GPT-5.6: Frontier intelligence that scales with your ambition",
          date: "July 9, 2026",
          url: "https://openai.com/index/gpt-5-6/",
          supports:
            "Frontier model general availability across ChatGPT, Codex, and the API",
        },
      ],
    },
    {
      reviewDate: "August 12, 2026",
      evidenceCutoff: LEDGER_EVIDENCE_CUTOFF,
      currentState: "Capability pace: Accelerating",
      currentDirection: "Consumer access broadening, infrastructure-bound",
      previousState: "Capability pace: Accelerating",
      materialChangeSummary:
        "OpenAI’s August 6 ChatGPT updates broadened consumer GPT-5.6 Sol/Luna access while leaving Work/Codex on July versions; PJM large-load adequacy framing replaced expired mid-July emergency-order language as the live physical constraint story.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "OpenAI",
          title:
            "Improving GPT-5.6 Sol in ChatGPT—and expanding access to GPT-5.6 Luna for free users",
          date: "August 6, 2026",
          url: "https://openai.com/index/improving-gpt-5-6-sol-in-chatgpt/",
          supports:
            "Consumer ChatGPT Sol/Luna updates distinct from unchanged Work/Codex July model versions",
        },
        {
          institution: "OpenAI Deployment Safety Hub",
          title: "GPT-5.6 — August Updates",
          date: "August 6, 2026",
          url: "https://deploymentsafety.openai.com/gpt-5-6-august-update",
          supports:
            "August ChatGPT model versions treated separately from July Codex/Work deployments",
        },
        {
          institution: "PJM Interconnection",
          title: "Interim Resource Adequacy / large-load framework materials",
          date: "Reviewed through August 12, 2026",
          url: "https://www.pjm.com/-/media/DotCom/about-pjm/who-we-are/public-disclosures/2026/20260727-cifp-framework-for-service-during-periods-of-insufficient-resource-adequacy-executive-summary.pdf",
          supports:
            "Physical power and large-load adequacy remaining co-equal deployment limits",
        },
      ],
    },
  ],
};

export const ACAI_SNAPSHOT = latestSnapshot(ACAI_SERIES);
