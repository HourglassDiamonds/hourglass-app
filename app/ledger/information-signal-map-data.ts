/**
 * Information Signal Map — weekly data.
 * Update values and copy here each week. Page layout is fixed in information-signal-map-view.
 */

export const ISM_UPDATED_LABEL = "Updated weekly — July 14, 2026";

export const ISM_READING = {
  score: 85,
  label: "Signal Clarity",
  status: "High-Attention, Uneven Clarity",
  weeklyChange: 0,
} as const;

export const ISM_SUMMARY =
  "High-attention, uneven clarity persists — Hormuz framing now splits among corridor-open, corridor-risk, fee, and blockade narratives in the same cycle. June CPI's temporary disinflation and the renewed oil escalation are being told as sequential rather than simultaneous stories. Qualified AI access claims and embedded event-fraud risk remain background.";

export const ISM_SIGNAL_GRID = [
  {
    title: "Consensus",
    body: "Physical-capacity and corridor themes — summer grid alerts, data-center load, Hormuz friction, and infrastructure strain — continue appearing together across institutional, market, and specialist sources.",
  },
  {
    title: "Divergence",
    body: "Hormuz framing splits among open-corridor, closed-corridor, fee, and blockade narratives; June CPI temporary disinflation and the renewed oil escalation are sequenced differently across outlets; Chairman Warsh's July 14 Monetary Policy Report testimony pledges price stability with limited forward guidance while markets reprice energy risk.",
  },
  {
    title: "Underweighted",
    body: "The gap between access claims and qualified availability — partner gates, geography, and approval status — receives less sustained attention than headline release announcements.",
  },
] as const;

export const ISM_SOURCE_STACK = [
  {
    title: "Institutional",
    body: "Emphasizes ceasefire-framework failure, competing Hormuz governance claims, energy security, and measured Fed communication — including Chairman Warsh's July 14 semiannual Monetary Policy Report testimony — with uneven agreement on corridor tempo.",
  },
  {
    title: "Market",
    body: "Emphasizes a restored oil risk premium, bond yields, rate-path sensitivity, AI capex, and earnings resilience — with growing linkage between compute expansion and power infrastructure.",
  },
  {
    title: "Infrastructure",
    body: "Emphasizes the early-July PJM peak, FERC large-load rules, World Cup transit strain, grid load, and the Hot Weather Alert covering July 14–17.",
  },
  {
    title: "Mainstream",
    body: "Emphasizes World Cup scams, AI model releases, corridor friction, vessel attacks, and grid heat coverage — with increasing references to qualified access and information integrity in the same cycle.",
  },
] as const;

export const ISM_NARRATIVE_MAP = [
  {
    title: "Domestic Framing",
    body: "Emphasizes event logistics, scam warnings, and heat-related household pressure. Tends to underweight Hormuz governance disputes, sanctions tempo, and industrial bottlenecks beneath aggregate market strength.",
  },
  {
    title: "Political Framing",
    body: "Emphasizes Hormuz framework strain, announced fee and blockade measures, Russia sanctions secondary watches, and policy response. Tends to underweight slow-moving information-integrity and access-qualification constraints.",
  },
  {
    title: "Market Framing",
    body: "Emphasizes restored oil risk premium, bond yields, rate-path sensitivity after Warsh's limited-guidance testimony, AI capex, and earnings resilience. Tends to underweight World Cup scam activity, access gates, and physical load growth timelines.",
  },
  {
    title: "Infrastructure Framing",
    body: "Emphasizes PJM's early-July peak, the July 14–17 Hot Weather Alert, FERC large-load rules, electricity demand, data-center expansion, and transformer manufacturing. Tends to underweight near-term narrative compression in mainstream media cycles.",
  },
] as const;

export const ISM_NARRATIVE_SHIFT =
  "The information environment intensified around corridor governance without justifying a clarity-score change. Competing claims — Iran asserting route control or closure, the U.S. asserting openness while announcing a proposed Hormuz cargo fee and scheduling blockade reimposition against Iranian shipping — appear in the same news cycle without a shared operational facts base. Market coverage shifted from oil near pre-conflict levels to a restored risk premium; institutional coverage reopened ceasefire-framework failure. In July 14 semiannual Monetary Policy Report testimony, Chairman Warsh pledged resolute commitment to restoring price stability and held the funds-rate range at 3½–3¾ percent from the June meeting, while offering limited forward guidance — leaving market energy-risk repricing less anchored by explicit policy signals. Official June CPI offered a temporary disinflation frame that does not yet include this week's oil move. Access-qualification friction in AI coverage and World Cup fraud risk remain embedded. Signal density rose; clarity did not improve enough to warrant a higher reading.";

export const ISM_WHAT_TO_WATCH = [
  {
    title: "Qualified access claims",
    body: "Whether \"released\" and \"available\" continue to describe different realities as frontier-model release frameworks formalize — geography, approval, and partner access matter.",
  },
  {
    title: "Hormuz frame conflict",
    body: "How often open-corridor, closed-corridor, fee, and blockade narratives appear in the same coverage cycle — with routing, insurance, and sovereignty questions unresolved.",
  },
  {
    title: "Fed communication divergence",
    body: "Whether Chairman Warsh's limited-guidance approach in the July 14 Monetary Policy Report testimony produces clearer or noisier market signal through the summer rate path.",
  },
  {
    title: "Grid reliability narrative",
    body: "Whether the July 14–17 Hot Weather Alert stays a localized operational story or broadens into sustained infrastructure narrative across regions.",
  },
] as const;

export const ISM_WHAT_WOULD_CHANGE = [
  {
    title: "Information noise reduction",
    body: "Lower headline density and cleaner single-theme reads across policy, markets, and event coverage — without implying conditions have eased materially.",
  },
  {
    title: "Access claim alignment",
    body: "Closer alignment between release announcements and broadly available deployment — with fewer gaps between partner, geographic, and tiered access.",
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
