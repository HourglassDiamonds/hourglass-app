/**
 * Information Signal Map — weekly data.
 * Update values and copy here each week. Page layout is fixed in information-signal-map-view.
 */

export const ISM_UPDATED_LABEL = "Updated weekly — June 20, 2026";

export const ISM_READING = {
  score: 84,
  label: "Signal Clarity",
  weeklyChange: 3,
} as const;

export const ISM_SUMMARY =
  "The World Cup created a high-attention environment for fraud, misinformation, and scams — amplified by AI-generated content and social engineering. Institutional, market, and infrastructure channels continue converging on physical-capacity themes, but information integrity strain rose alongside event logistics and geopolitical relief narratives.";

export const ISM_SIGNAL_GRID = [
  {
    title: "Consensus",
    body: "Hormuz ceasefire relief, renewed Russia sanctions pressure, and AI power-and-grid constraints are appearing together more often — as a linked geopolitical-and-infrastructure narrative across institutional and market sources.",
  },
  {
    title: "Divergence",
    body: "Sports and event coverage emphasizes logistics and security; financial coverage emphasizes yields and relief trades; infrastructure reporting emphasizes bottlenecks and labor. Same pressure layer, different time horizons and vocabulary.",
  },
  {
    title: "Underweighted",
    body: "Fraud, scam activity, and AI-generated misinformation during high-attention events still receive less sustained institutional attention than episodic mainstream spikes — despite growing references to information integrity risk.",
  },
] as const;

export const ISM_SOURCE_STACK = [
  {
    title: "Institutional",
    body: "Emphasizes G7 coordination, Russia sanctions, Hormuz framework, and energy security — measured language, coordination over alarm.",
  },
  {
    title: "Market",
    body: "Emphasizes oil relief trades, bond yields, AI capex, and earnings resilience — with growing linkage between compute expansion and power infrastructure.",
  },
  {
    title: "Infrastructure",
    body: "Emphasizes World Cup transit strain, grid load, transmission delays, data-center power access, and labor or permitting friction on build timelines.",
  },
  {
    title: "Mainstream",
    body: "Emphasizes World Cup logistics, geopolitical relief, scam warnings, and AI boom coverage — with increasing references to power, grid, and information integrity in the same cycle.",
  },
] as const;

export const ISM_NARRATIVE_MAP = [
  {
    title: "Domestic Framing",
    body: "Emphasizes event logistics, utility costs, and household pressure. Tends to underweight Hormuz routing friction, sanctions tempo, and industrial bottlenecks beneath aggregate market strength.",
  },
  {
    title: "Political Framing",
    body: "Emphasizes G7 summit outcomes, Hormuz ceasefire, Russia sanctions, and policy response. Tends to underweight slow-moving grid, permitting, and information-integrity constraints.",
  },
  {
    title: "Market Framing",
    body: "Emphasizes oil relief trades, bond yields, AI capex, and earnings resilience. Tends to underweight World Cup infrastructure strain, scam activity, and physical load growth timelines.",
  },
  {
    title: "Infrastructure Framing",
    body: "Emphasizes World Cup transit, electricity demand, data-center expansion, grid capacity, and transformer manufacturing. Tends to underweight near-term narrative compression in mainstream media cycles.",
  },
] as const;

export const ISM_NARRATIVE_SHIFT =
  "Coverage shifted toward a dual-layer read: surface relief on Hormuz and energy routes, with strain underneath on logistics, sanctions, grid demand, and information integrity. The World Cup moved from sports into transportation, security, weather response, and scam risk — amplified by AI-generated content. Energy relief and Russia sanctions appeared in the same frame as AI power demand and infrastructure strain. The shift is observational — growing convergence across information layers, not a claim of hidden coordination.";

export const ISM_WHAT_TO_WATCH = [
  {
    title: "World Cup information integrity",
    body: "Whether fraud, misinformation, and AI-generated scam activity during high-attention events stays episodic or becomes a sustained information-integrity narrative.",
  },
  {
    title: "Hormuz relief vs. routing friction",
    body: "How often ceasefire progress and uneven shipping normalization appear in the same frame as permit, insurance, and security questions.",
  },
  {
    title: "Russia sanctions re-emphasis",
    body: "Whether renewed G7 pressure on Russia's war economy tightens energy-flow narratives after the Middle East relief trade.",
  },
  {
    title: "AI power-and-grid linkage",
    body: "Whether AI narratives continue shifting from capability headlines toward electricity demand, siting, cooling, transmission, and deployment timelines in the same news cycle.",
  },
] as const;

export const ISM_WHAT_WOULD_CHANGE = [
  {
    title: "Information noise reduction",
    body: "Lower headline density and cleaner single-theme reads across policy, markets, and event coverage — without implying conditions have eased materially.",
  },
  {
    title: "Event strain localization",
    body: "World Cup logistics and security pressure remaining contained to host cities rather than broadening into wider infrastructure narrative.",
  },
  {
    title: "Narrative decoupling",
    body: "Hormuz relief, Russia sanctions, and AI grid strain discussed again as separate storylines with less cross-channel linkage.",
  },
  {
    title: "Tone moderation",
    body: "More measured cadence across institutional, market, infrastructure, and mainstream sources at the same time, with fewer overlapping macro frames.",
  },
] as const;

export const ISM_FOOTER_NOTE =
  "Narrative analysis and framing comparison — observational, without speculation or certainty claims.";
