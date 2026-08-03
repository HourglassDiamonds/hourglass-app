/**
 * Information Signal Map — weekly data.
 * ARCHIVED NUMERICAL SERIES — public page is qualitative (no proprietary clarity score).
 * ISM_READING remains for rebuild if a reproducible content-analysis methodology is developed.
 */

import {
  LEDGER_EVIDENCE_CUTOFF,
  LEDGER_METHODOLOGY_VERSION,
  latestSnapshot,
  type LedgerMonitorSeries,
} from "./ledger-monitor-framework";

export const ISM_UPDATED_LABEL =
  "Interim status — methodology revision in progress";

export const ISM_READING = {
  score: 85,
  label: "Signal Clarity",
  status: "High-Attention, Uneven Clarity",
  weeklyChange: 0,
} as const;

export const ISM_SUMMARY =
  "High-attention, uneven clarity persists. Official military framing, physical shipping evidence, confirmed vessel attacks with disputed actor attribution, and a Houthi embargo declaration without demonstrated enforcement compete in the same cycle. Market pricing indicated oil’s intraday $90 test and lower settlement — told differently across outlets. GPT-5.6 general availability and Kimi K3 product/API access add a parallel capability-versus-qualification story. The Ledger’s current interpretation is that signal density rose without a corresponding increase in clarity.";

export const ISM_SIGNAL_GRID = [
  {
    title: "Consensus",
    body: "Physical-capacity and corridor themes — summer grid alerts, data-center load, Hormuz friction, and infrastructure strain — continue appearing together across institutional, market, and specialist sources.",
  },
  {
    title: "Divergence",
    body: "Corridor coverage splits among reimposed blockade descriptions, open-corridor claims, confirmed vessel attacks, and disputed attribution; oil's brief move above $90 and high-$80s settlement are sequenced differently; GPT-5.6 general availability sits beside Kimi K3 product/API access with downloadable weights still pending.",
  },
  {
    title: "Underweighted",
    body: "The gap between access claims and qualified availability — product surfaces, API tiers, partner gates, and pending open-weight releases — receives less sustained attention than headline model announcements.",
  },
] as const;

export const ISM_SOURCE_STACK = [
  {
    title: "Institutional",
    body: "Emphasizes maritime security framing, blockade reimposition, continued strikes connected to commercial-shipping protection claims, and measured diplomatic language — with uneven agreement on corridor tempo and ceasefire prospects.",
  },
  {
    title: "Market",
    body: "Emphasizes oil's $90 test versus high-$80s settlement, bond yields, rate-path sensitivity, AI capex, and earnings resilience — with growing linkage between compute expansion, broader model access, and power infrastructure.",
  },
  {
    title: "Infrastructure",
    body: "Emphasizes the early-July PJM peak, mid-July Hot Weather and Maximum Generation alerts, DOE Order 202-26-35, FERC large-load rules, World Cup transit strain, and grid load.",
  },
  {
    title: "Mainstream",
    body: "Emphasizes vessel attacks, corridor friction, Houthi embargo headlines, AI model releases, and grid heat coverage — with increasing references to qualified access and information integrity in the same cycle.",
  },
] as const;

export const ISM_NARRATIVE_MAP = [
  {
    title: "Domestic Framing",
    body: "Emphasizes event logistics, scam warnings, and heat-related household pressure. Tends to underweight Hormuz governance disputes, sanctions tempo, and industrial bottlenecks beneath aggregate market strength.",
  },
  {
    title: "Political Framing",
    body: "Emphasizes blockade reimposition, strike campaigns, secondary Houthi declaration headlines, Russia sanctions watches, and diplomatic or ceasefire language. Tends to underweight slow-moving information-integrity and access-qualification constraints.",
  },
  {
    title: "Market Framing",
    body: "Emphasizes oil band ambiguity, bond yields, rate-path sensitivity, AI capex after broader frontier access, and earnings resilience. Tends to underweight World Cup scam activity, open-weight timing questions, and physical load growth timelines.",
  },
  {
    title: "Infrastructure Framing",
    body: "Emphasizes PJM's early-July peak, the mid-July alert window, DOE Order 202-26-35, FERC large-load rules, electricity demand, data-center expansion, and transformer manufacturing. Tends to underweight near-term narrative compression in mainstream media cycles.",
  },
] as const;

export const ISM_NARRATIVE_SHIFT =
  "Signal density rose around corridor enforcement without improving clarity. Coverage now splits among reimposed blockade descriptions, open-corridor claims, confirmed vessel attacks near Oman, and disputed attribution of who struck which ships. Official military framing and physical shipping evidence do not always describe the same operational facts base. A Houthi maritime-embargo declaration entered the cycle as a secondary corridor headline before sustained enforcement was demonstrated. Market outlets treated Brent's brief move above $90 and its high-$80s settlement as different stories. On the AI channel, GPT-5.6 general availability across ChatGPT, Codex, and the API sits beside Kimi K3 product and API access with full downloadable weights still pending — another instance of \"available\" describing different realities. Diplomatic and ceasefire language remains an offsetting frame. Density increased; clarity did not improve.";

export const ISM_WHAT_TO_WATCH = [
  {
    title: "Qualified access claims",
    body: "Whether \"released\" and \"available\" continue to describe different realities as GPT-5.6 general availability, Kimi product/API access, and pending open-weight releases coexist in coverage.",
  },
  {
    title: "Hormuz frame conflict",
    body: "How often blockade, open-corridor, confirmed-attack, disputed-attribution, and Houthi-declaration narratives appear in the same coverage cycle — with routing, insurance, and sovereignty questions unresolved.",
  },
  {
    title: "Oil band storytelling",
    body: "Whether markets and media treat Brent's intraday $90 test and high-$80s settlement as one continuous energy-premium story or as conflicting signals.",
  },
  {
    title: "Grid reliability narrative",
    body: "Whether the mid-July PJM alert window stays a localized operational story or broadens into sustained infrastructure narrative across regions.",
  },
] as const;

export const ISM_WHAT_WOULD_CHANGE = [
  {
    title: "Information noise reduction",
    body: "Lower headline density and cleaner single-theme reads across policy, markets, and event coverage — without implying conditions have eased materially.",
  },
  {
    title: "Access claim alignment",
    body: "Closer alignment between release announcements and broadly available deployment — with fewer gaps between product, API, partner, geographic, and open-weight access.",
  },
  {
    title: "Narrative decoupling",
    body: "Hormuz corridor friction, secondary Red Sea risk headlines, and AI grid strain discussed again as separate storylines with less cross-channel linkage.",
  },
  {
    title: "Tone moderation",
    body: "More measured cadence across institutional, market, infrastructure, and mainstream sources at the same time, with fewer overlapping macro frames.",
  },
] as const;

export const ISM_FOOTER_NOTE =
  "Narrative analysis and framing comparison — observational, without speculation or certainty claims.";

export const ISM_CURRENT_STATE = "High-attention / Uneven clarity";

export const ISM_CURRENT_DIRECTION =
  "More signals, no corresponding increase in clarity.";

/** Append-only public series. Future reviews push a new snapshot. */
export const ISM_SERIES: LedgerMonitorSeries = {
  id: "information-signal-map",
  methodologyVersion: LEDGER_METHODOLOGY_VERSION,
  snapshots: [
    {
      reviewDate: "August 3, 2026",
      evidenceCutoff: LEDGER_EVIDENCE_CUTOFF,
      currentState: ISM_CURRENT_STATE,
      currentDirection: ISM_CURRENT_DIRECTION,
      previousState: "High-Attention, Uneven Clarity (archived numerical series)",
      materialChangeSummary:
        "Signal density rose around corridor enforcement and frontier AI access claims without a corresponding increase in clarity.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "U.S. Central Command / maritime security reporting",
          title: "Public military framing of Red Sea and corridor operations",
          date: "Reviewed through August 3, 2026",
          supports:
            "Official military framing competing with physical shipping evidence in the same cycle",
        },
        {
          institution: "Market price reporting (Brent crude)",
          title: "Intraday oil band around the $90 test and high-$80s settlement",
          date: "Reviewed through August 3, 2026",
          supports:
            "Oil’s brief move above $90 and lower settlement told differently across outlets",
        },
        {
          institution: "OpenAI",
          title: "GPT-5.6 general availability documentation",
          date: "July 9, 2026",
          url: "https://openai.com/",
          supports:
            "Parallel capability-versus-qualification story beside Kimi K3 access claims",
        },
        {
          institution: "PJM Interconnection",
          title: "Summer grid alert coverage synthesis",
          date: "July 2026 (reviewed through August 3, 2026)",
          url: "https://www.pjm.com/",
          supports:
            "Physical-capacity and grid themes appearing across institutional and specialist sources",
        },
      ],
    },
  ],
};

export const ISM_SNAPSHOT = latestSnapshot(ISM_SERIES);
