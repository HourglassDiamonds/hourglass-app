/**
 * Information Signal Map — weekly data.
 * Update values and copy here each week. Page layout is fixed in information-signal-map-view.
 */

export const ISM_UPDATED_LABEL = "Updated weekly — May 19, 2026";

export const ISM_READING = {
  score: 79,
  label: "Signal Clarity",
  weeklyChange: 2,
} as const;

export const ISM_SUMMARY =
  "Across institutional, market, infrastructure, and mainstream channels, narratives are converging more clearly on a shared systems story: energy availability, AI infrastructure expansion, electricity demand, grid and transmission limits, and inflation persistence are increasingly discussed as linked — not as isolated headlines. The remaining disagreement is mostly framing and tempo: whether constraints are cyclical volatility or a longer capacity adjustment beneath still-resilient financial markets.";

export const ISM_SIGNAL_GRID = [
  {
    title: "Consensus",
    body: "Energy, AI capex, grid strain, cooling and transmission constraints, shipping-route sensitivity, and sticky inflation are appearing together more often — as a physical-capacity narrative, not only as market noise.",
  },
  {
    title: "Divergence",
    body: "Financial coverage still emphasizes yields, earnings resilience, and volatility transmission; infrastructure reporting emphasizes bottlenecks, labor, and permitting friction. Same pressure, different time horizons.",
  },
  {
    title: "Underweighted",
    body: "Industrial bottlenecks beneath headline market resilience, transformer lead times, and cooling load growth still receive less sustained attention in mainstream framing than in specialist infrastructure coverage.",
  },
] as const;

export const ISM_SOURCE_STACK = [
  {
    title: "Institutional",
    body: "Emphasizes resilience, inflation management, energy security, and infrastructure investment — measured language, coordination over alarm.",
  },
  {
    title: "Market",
    body: "Emphasizes bond yields, oil sensitivity, AI capex, earnings resilience, and how volatility transmits across rates, commodities, and equities.",
  },
  {
    title: "Infrastructure",
    body: "Emphasizes grid strain, transmission delays, transformer shortages, data-center load growth, and labor or permitting friction on build timelines.",
  },
  {
    title: "Mainstream",
    body: "Emphasizes inflation, the AI boom, geopolitics, and cost-of-living pressure — event-led coverage with growing references to power and capacity limits.",
  },
] as const;

export const ISM_NARRATIVE_MAP = [
  {
    title: "Domestic Framing",
    body: "Emphasizes inflation, utility costs, and household pressure. Tends to underweight shipping-route sensitivity and industrial bottlenecks beneath aggregate market strength.",
  },
  {
    title: "Political Framing",
    body: "Emphasizes geopolitics, energy security rhetoric, and policy response. Tends to underweight slow-moving grid, transmission, and permitting constraints.",
  },
  {
    title: "Market Framing",
    body: "Emphasizes bond yields, oil moves, AI capex, and earnings resilience. Tends to underweight cooling limits, transformer shortages, and physical load growth timelines.",
  },
  {
    title: "Infrastructure Framing",
    body: "Emphasizes electricity demand, data-center expansion, grid capacity, and transmission backlogs. Tends to underweight near-term narrative compression in mainstream media cycles.",
  },
] as const;

export const ISM_NARRATIVE_SHIFT =
  "Coverage is converging on a physical interpretation of AI: less often framed as software alone, more often as data centers, power, cooling, and grid-adjacent capacity. Energy is moving toward the center of AI scaling discussions, and infrastructure constraints are appearing more frequently alongside financial and media commentary on market resilience. The shift is observational — more shared vocabulary across layers, not a claim of hidden coordination or concealed truth.";

export const ISM_WHAT_TO_WATCH = [
  {
    title: "AI as Infrastructure",
    body: "Whether AI narratives continue shifting from capability headlines toward electricity demand, siting, cooling, and transmission in the same news cycle.",
  },
  {
    title: "Energy–AI Linkage",
    body: "How often energy availability and fuel or power pricing appear in the same frame as compute expansion and data-center load growth.",
  },
  {
    title: "Physical Bottlenecks",
    body: "Transformer lead times, grid interconnection queues, permitting friction, and industrial capacity limits acknowledged beneath resilient market language.",
  },
  {
    title: "Framing Compression",
    body: "Whether institutional resilience messaging, market volatility commentary, and infrastructure strain reporting move closer in tone and emphasis — or diverge again.",
  },
] as const;

export const ISM_WHAT_WOULD_CHANGE = [
  {
    title: "Narrative Decoupling",
    body: "Energy, AI infrastructure, and grid strain discussed again as separate storylines with less cross-channel linkage.",
  },
  {
    title: "Clarity Without Convergence",
    body: "Lower headline density and cleaner single-theme reads across policy, markets, and media — without implying conditions have eased materially.",
  },
  {
    title: "Infrastructure Visibility",
    body: "Sustained mainstream attention to transmission, cooling, and labor constraints — not only episodic spikes tied to single events.",
  },
  {
    title: "Tone Moderation",
    body: "More measured cadence across institutional, market, infrastructure, and mainstream sources at the same time, with fewer overlapping macro frames.",
  },
] as const;

export const ISM_FOOTER_NOTE =
  "Narrative analysis and framing comparison — observational, without speculation or certainty claims.";
