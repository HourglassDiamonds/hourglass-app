/**
 * Information Signal Map — weekly data.
 * Update values and copy here each week. Page layout is fixed in information-signal-map-view.
 */

export const ISM_UPDATED_LABEL = "Updated weekly — June 28, 2026";

export const ISM_READING = {
  score: 85,
  label: "Signal Clarity",
  weeklyChange: 1,
} as const;

export const ISM_SUMMARY =
  "Information integrity strain rose as World Cup scams, deepfakes, and AI-generated content spread at scale. Geopolitical frame conflict on Hormuz and institutional-market communication divergence under Warsh's Fed added noise — high-attention, uneven clarity across channels.";

export const ISM_SIGNAL_GRID = [
  {
    title: "Consensus",
    body: "Physical-capacity themes — grid load, data-center power, corridor friction, and infrastructure strain — continue appearing together across institutional, market, and specialist sources.",
  },
  {
    title: "Divergence",
    body: "Hormuz framing splits between corridor-functioning and corridor-risk narratives; Fed communication shifted while markets repriced; event coverage emphasizes scams and deepfakes while financial coverage emphasizes yields.",
  },
  {
    title: "Underweighted",
    body: "Trust and verification strain during high-attention events still receives less sustained institutional attention than episodic mainstream spikes — despite growing references to information integrity risk.",
  },
] as const;

export const ISM_SOURCE_STACK = [
  {
    title: "Institutional",
    body: "Emphasizes Hormuz framework, Russia sanctions, energy security, and FERC grid action — measured language, coordination over alarm, with uneven agreement on corridor tempo.",
  },
  {
    title: "Market",
    body: "Emphasizes comparatively calm oil pricing, bond yields, hawkish Fed repricing, AI capex, and earnings resilience — with growing linkage between compute expansion and power infrastructure.",
  },
  {
    title: "Infrastructure",
    body: "Emphasizes FERC large-load rules, World Cup transit strain, grid load, transmission delays, data-center power access, and labor or permitting friction on build timelines.",
  },
  {
    title: "Mainstream",
    body: "Emphasizes World Cup scams, deepfakes, corridor friction, and AI coverage — with increasing references to power, grid, and information integrity in the same cycle.",
  },
] as const;

export const ISM_NARRATIVE_MAP = [
  {
    title: "Domestic Framing",
    body: "Emphasizes event logistics, scam warnings, and household pressure. Tends to underweight Hormuz routing friction, sanctions tempo, and industrial bottlenecks beneath aggregate market strength.",
  },
  {
    title: "Political Framing",
    body: "Emphasizes Hormuz framework strain, Russia sanctions, FERC grid action, and policy response. Tends to underweight slow-moving information-integrity and verification constraints.",
  },
  {
    title: "Market Framing",
    body: "Emphasizes comparatively calm oil pricing, bond yields, hawkish Fed outlook, AI capex, and earnings resilience. Tends to underweight World Cup scam activity and physical load growth timelines.",
  },
  {
    title: "Infrastructure Framing",
    body: "Emphasizes FERC large-load rules, World Cup transit, electricity demand, data-center expansion, grid capacity, and transformer manufacturing. Tends to underweight near-term narrative compression in mainstream media cycles.",
  },
] as const;

export const ISM_NARRATIVE_SHIFT =
  "Coverage shifted toward high-attention, uneven clarity: World Cup scams and AI-generated deepfakes spread at scale while Hormuz framing split between corridor-functioning and corridor-risk narratives. Fed communication changed under new leadership, adding institutional-market divergence. Physical-capacity themes continue converging across channels — observational, not hidden-truth framing.";

export const ISM_WHAT_TO_WATCH = [
  {
    title: "World Cup information integrity",
    body: "Whether fraud, deepfakes, and AI-generated scam activity during high-attention events stays event-localized or broadens into a sustained trust narrative.",
  },
  {
    title: "Hormuz frame conflict",
    body: "How often corridor-functioning and corridor-risk narratives appear in the same coverage cycle — with routing, insurance, and security questions unresolved.",
  },
  {
    title: "Fed communication divergence",
    body: "Whether institutional communication simplification produces clearer or noisier market signal through the summer rate path.",
  },
  {
    title: "AI power-and-grid linkage",
    body: "Whether AI narratives continue shifting from capability headlines toward FERC grid rules, electricity demand, siting, cooling, and deployment timelines.",
  },
] as const;

export const ISM_WHAT_WOULD_CHANGE = [
  {
    title: "Information noise reduction",
    body: "Lower headline density and cleaner single-theme reads across policy, markets, and event coverage — without implying conditions have eased materially.",
  },
  {
    title: "Event strain localization",
    body: "World Cup scam and logistics pressure remaining contained to host cities and event channels rather than broadening into wider trust narrative.",
  },
  {
    title: "Narrative decoupling",
    body: "Hormuz corridor friction, Russia sanctions, and AI grid strain discussed again as separate storylines with less cross-channel linkage.",
  },
  {
    title: "Tone moderation",
    body: "More measured cadence across institutional, market, infrastructure, and mainstream sources at the same time, with fewer overlapping macro frames.",
  },
] as const;

export const ISM_FOOTER_NOTE =
  "Narrative analysis and framing comparison — observational, without speculation or certainty claims.";
