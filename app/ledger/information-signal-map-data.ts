/**
 * Information Signal Map — weekly data.
 * Update values and copy here each week. Page layout is fixed in information-signal-map-view.
 */

export const ISM_UPDATED_LABEL = "Updated weekly — June 2, 2026";

export const ISM_READING = {
  score: 81,
  label: "Signal Clarity",
  weeklyChange: 2,
} as const;

export const ISM_SUMMARY =
  "Across institutional, market, infrastructure, and mainstream channels, narrative convergence increased this week. AI infrastructure, power demand, grid limitations, transmission, cooling requirements, and industrial capacity are increasingly discussed together — not as isolated headlines. The remaining disagreement is mostly framing and tempo: whether constraints reflect cyclical volatility or a longer capacity adjustment beneath still-resilient financial markets.";

export const ISM_SIGNAL_GRID = [
  {
    title: "Consensus",
    body: "AI infrastructure, power demand, grid limitations, transmission, cooling, and industrial capacity are appearing together more often — as a linked physical-capacity narrative across institutional, market, and infrastructure sources.",
  },
  {
    title: "Divergence",
    body: "Financial coverage still emphasizes yields, earnings resilience, and volatility transmission; infrastructure reporting emphasizes bottlenecks, labor, and permitting friction. Same pressure layer, different time horizons and vocabulary.",
  },
  {
    title: "Underweighted",
    body: "Electrical labor availability, transformer manufacturing throughput, and permitting coordination still receive less sustained mainstream attention than in specialist infrastructure coverage — despite growing references to power and capacity limits.",
  },
] as const;

export const ISM_SOURCE_STACK = [
  {
    title: "Institutional",
    body: "Emphasizes infrastructure investment, energy security, grid modernization, and deployment timelines — measured language, coordination over alarm.",
  },
  {
    title: "Market",
    body: "Emphasizes AI capex, power demand, transmission constraints, bond yields, and earnings resilience — with growing linkage between compute expansion and physical infrastructure.",
  },
  {
    title: "Infrastructure",
    body: "Emphasizes grid strain, transmission delays, transformer shortages, cooling requirements, data-center load growth, and labor or permitting friction on build timelines.",
  },
  {
    title: "Mainstream",
    body: "Emphasizes inflation, the AI boom, cost-of-living pressure, and geopolitics — with increasing references to power, cooling, and industrial capacity in the same coverage cycle.",
  },
] as const;

export const ISM_NARRATIVE_MAP = [
  {
    title: "Domestic Framing",
    body: "Emphasizes inflation, utility costs, and household pressure. Tends to underweight transmission expansion, transformer lead times, and industrial bottlenecks beneath aggregate market strength.",
  },
  {
    title: "Political Framing",
    body: "Emphasizes geopolitics, energy security rhetoric, and policy response. Tends to underweight slow-moving grid, permitting, and utility coordination constraints.",
  },
  {
    title: "Market Framing",
    body: "Emphasizes bond yields, AI capex, and earnings resilience. Tends to underweight cooling limits, electrical labor shortages, and physical load growth timelines.",
  },
  {
    title: "Infrastructure Framing",
    body: "Emphasizes electricity demand, data-center expansion, grid capacity, transmission backlogs, and transformer manufacturing. Tends to underweight near-term narrative compression in mainstream media cycles.",
  },
] as const;

export const ISM_NARRATIVE_SHIFT =
  "Coverage converged further on a physical interpretation of AI and industrial expansion: less often framed as software or volatility alone, more often as data centers, power, cooling, transmission, and deployment capacity. Energy, grid limitations, and industrial capacity appeared more frequently in the same frame as AI infrastructure investment and market resilience. The shift is observational — growing convergence across information layers, not a claim of hidden coordination or concealed truth.";

export const ISM_WHAT_TO_WATCH = [
  {
    title: "AI as Infrastructure",
    body: "Whether AI narratives continue shifting from capability headlines toward electricity demand, siting, cooling, transmission, and deployment timelines in the same news cycle.",
  },
  {
    title: "Energy–AI Linkage",
    body: "How often power availability, grid limitations, and fuel or electricity pricing appear in the same frame as compute expansion and data-center load growth.",
  },
  {
    title: "Physical Bottlenecks",
    body: "Transformer lead times, grid interconnection queues, permitting friction, cooling requirements, and industrial capacity limits acknowledged beneath resilient market language.",
  },
  {
    title: "Framing Compression",
    body: "Whether institutional resilience messaging, market commentary, and infrastructure strain reporting move closer in tone and emphasis — or diverge again on tempo.",
  },
] as const;

export const ISM_WHAT_WOULD_CHANGE = [
  {
    title: "Narrative Decoupling",
    body: "AI infrastructure, power demand, and grid strain discussed again as separate storylines with less cross-channel linkage.",
  },
  {
    title: "Clarity Without Convergence",
    body: "Lower headline density and cleaner single-theme reads across policy, markets, and media — without implying conditions have eased materially.",
  },
  {
    title: "Infrastructure Visibility",
    body: "Sustained mainstream attention to transmission, cooling, transformer manufacturing, and labor constraints — not only episodic spikes tied to single events.",
  },
  {
    title: "Tone Moderation",
    body: "More measured cadence across institutional, market, infrastructure, and mainstream sources at the same time, with fewer overlapping macro frames.",
  },
] as const;

export const ISM_FOOTER_NOTE =
  "Narrative analysis and framing comparison — observational, without speculation or certainty claims.";
