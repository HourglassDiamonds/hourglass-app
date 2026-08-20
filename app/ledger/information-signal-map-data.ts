/**
 * Information Signal Map — weekly data.
 * ARCHIVED NUMERICAL SERIES — public page is qualitative (no proprietary clarity score).
 * ISM_READING remains for rebuild if a reproducible content-analysis methodology is developed.
 * Information Signal sets System Temperature confidence only — it does not add heat.
 */

import {
  LEDGER_EVIDENCE_CUTOFF,
  LEDGER_METHODOLOGY_VERSION,
  latestSnapshot,
  type LedgerMonitorSeries,
} from "./ledger-monitor-framework";

export const ISM_UPDATED_LABEL = "";

export const ISM_READING = {
  score: 85,
  label: "Signal Clarity",
  status: "High-Attention, Uneven Clarity",
  weeklyChange: 0,
} as const;

export const ISM_SUMMARY =
  "Physical evidence is becoming clearer while strategic intent remains more uncertain. Shipping counts, Brent above $90, the failed / expired negotiation framework, long sovereign yields, and European physical-infrastructure effects are now more directly observable. Control-of-Hormuz language, Oman’s role, the diplomatic path, and escalation intentions remain contested. Confidence stays Moderate.";

export const ISM_SIGNAL_GRID = [
  {
    title: "Consensus",
    body: "Hormuz remains extremely constrained; Brent is in a $90+ regime; long-duration sovereign yields have repriced; European water-to-power and freight effects are physical, not merely narrative.",
  },
  {
    title: "Divergence",
    body: "Physical shipping and price prints versus claims about who controls the strait, what diplomacy can still produce, and how far escalation is intended to go. Market outlets now agree oil is above $90; they still disagree about duration and policy path.",
  },
  {
    title: "Underweighted",
    body: "The distinction between clearer physical facts and still-opaque strategic intent — and the fact that rates transmission is an interaction among energy, fiscal issuance, and AI-capital demand, not a single Hormuz-to-yields pipeline.",
  },
] as const;

export const ISM_SOURCE_STACK = [
  {
    title: "Institutional",
    body: "Emphasizes expired talks, maritime-security incidents, and measured language on any successor diplomatic path — with little agreement on Hormuz control status or Oman’s continuing role.",
  },
  {
    title: "Market",
    body: "Emphasizes Brent above $90, long-duration Treasury and G10 yield repricing, softer near-term hike odds, and still-functioning credit — linking energy pressure to term premia more tightly than to funding stress.",
  },
  {
    title: "Infrastructure",
    body: "Emphasizes PJM large-load adequacy, European river/nuclear/hydro constraints, and operator adaptation rather than expired July emergency-order windows or event-infrastructure load.",
  },
  {
    title: "Mainstream",
    body: "Emphasizes corridor deadlock, oil above $90, and bond-market headlines — often compressing physical prints, control claims, and rate moves into a single crisis frame.",
  },
] as const;

export const ISM_NARRATIVE_MAP = [
  {
    title: "Domestic Framing",
    body: "Emphasizes consumer prices, borrowing costs, and energy bills. Tends to underweight vessel-tracking evidence and the difference between long-duration repricing and a credit crisis.",
  },
  {
    title: "Political Framing",
    body: "Emphasizes control of the strait, blame for the expired window, and escalation language. Tends to underweight slow-moving physical transit data and still-functioning credit markets.",
  },
  {
    title: "Market Framing",
    body: "Emphasizes $90+ oil, 30-year and 10-year yields, and G10 duration. Tends to underweight that strategic intent and diplomatic path remain less clear than the prints.",
  },
  {
    title: "Infrastructure Framing",
    body: "Emphasizes PJM adequacy actions and European water-constrained power and freight. Tends to underweight near-term headline compression around Hormuz control claims.",
  },
] as const;

export const ISM_NARRATIVE_SHIFT =
  "Clarity improved on physical facts and deteriorated on intent. Brent has held a higher ~$90+ regime rather than settling back into the high-$80s. Reopening hopes have faded. Model-access headlines are no longer the main AI story this week. Density remains high; confidence stays Moderate because strategic intent is still unresolved.";

export const ISM_WHAT_TO_WATCH = [
  {
    title: "Physical-print alignment",
    body: "Whether independently trackable Hormuz transits, Brent, and long yields continue to tell one physical story.",
  },
  {
    title: "Intent versus control claims",
    body: "Whether Hormuz-control language, Oman’s role, and escalation intentions become independently verifiable — or remain a competing headline layer.",
  },
  {
    title: "Diplomatic successor path",
    body: "Whether a new scheduled framework appears after the expired window, distinct from unrecovered-flow claims.",
  },
  {
    title: "Rates-story composition",
    body: "Whether coverage treats long-duration repricing as an interaction among energy, fiscal issuance, and AI-capital demand rather than a monocausal oil-to-yields pipeline.",
  },
] as const;

export const ISM_WHAT_WOULD_CHANGE = [
  {
    title: "Information noise reduction",
    body: "Lower headline density and cleaner single-theme reads across policy, markets, and shipping coverage — without implying corridor conditions have eased.",
  },
  {
    title: "Transit-data alignment",
    body: "Closer alignment between official control or flow claims and independently trackable Hormuz transit volumes.",
  },
  {
    title: "Narrative decoupling",
    body: "Energy-corridor stress, long-duration yields, credit conditions, and AI grid constraints discussed as separable storylines with less forced equivalence.",
  },
  {
    title: "Tone moderation",
    body: "More measured cadence across institutional, market, infrastructure, and mainstream sources at the same time.",
  },
] as const;

export const ISM_FOOTER_NOTE =
  "Narrative analysis and framing comparison — observational, without speculation or certainty claims. Information Signal informs confidence in the System Temperature reading; it does not raise the temperature itself.";

export const ISM_CURRENT_STATE = "High-attention / Uneven clarity";

export const ISM_CURRENT_DIRECTION =
  "Physical evidence clearer; strategic intent more uncertain.";

export const ISM_HUB_STATUS = ISM_CURRENT_STATE;

export const ISM_HUB_DESCRIPTION =
  "High-attention / Uneven clarity — physical prints are clearer while Hormuz control, diplomacy, and escalation intent remain contested.";

/** Append-only public series. Future reviews push a new snapshot. */
export const ISM_SERIES: LedgerMonitorSeries = {
  id: "information-signal-map",
  methodologyVersion: LEDGER_METHODOLOGY_VERSION,
  snapshots: [
    {
      reviewDate: "August 3, 2026",
      evidenceCutoff: "August 3, 2026",
      currentState: "High-attention / Uneven clarity",
      currentDirection: "More signals, no corresponding increase in clarity.",
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
      ],
    },
    {
      reviewDate: "August 12, 2026",
      evidenceCutoff: "August 12, 2026",
      currentState: "High-attention / Uneven clarity",
      currentDirection: "More conflicting corridor claims; no clarity improvement.",
      previousState: "High-attention / Uneven clarity",
      materialChangeSummary:
        "Hormuz reopen optimism faded while recovered-flow claims diverged from vessel-tracking counts; OpenAI’s August ChatGPT updates added another qualified-access storyline without improving overall clarity.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "Reuters",
          title:
            "Hormuz shipping traffic falls to one-week low amid hostilities",
          date: "August 12, 2026",
          url: "https://www.reuters.com/business/energy/hormuz-shipping-traffic-falls-one-week-low-amid-hostilities-2026-08-12/",
          supports:
            "Competing reopen/hostility framing beside Kpler/LSEG transit prints far below pre-conflict norms",
        },
        {
          institution: "Reuters",
          title:
            "Oil rises as doubts over US-Iran deal heighten supply concerns",
          date: "August 12, 2026",
          url: "https://www.reuters.com/business/energy/oil-rises-as-doubts-over-us-iran-deal-heighten-supply-concerns-2026-08-12/",
          supports:
            "Oil near $89 told beside maritime-attack and negotiation-deadlock headlines in the same cycle",
        },
        {
          institution: "OpenAI",
          title:
            "Improving GPT-5.6 Sol in ChatGPT—and expanding access to GPT-5.6 Luna for free users",
          date: "August 6, 2026",
          url: "https://openai.com/index/improving-gpt-5-6-sol-in-chatgpt/",
          supports:
            "Consumer ChatGPT updates distinct from Work/Codex model versions in the same product family",
        },
        {
          institution: "PJM Interconnection",
          title: "Interim Resource Adequacy / large-load framework materials",
          date: "Reviewed through August 12, 2026",
          url: "https://www.pjm.com/-/media/DotCom/about-pjm/who-we-are/public-disclosures/2026/20260727-cifp-framework-for-service-during-periods-of-insufficient-resource-adequacy-executive-summary.pdf",
          supports:
            "Infrastructure narrative shifting from expired July emergency windows to structural large-load adequacy",
        },
      ],
    },
    {
      reviewDate: "August 18, 2026",
      evidenceCutoff: LEDGER_EVIDENCE_CUTOFF,
      currentState: ISM_CURRENT_STATE,
      currentDirection: ISM_CURRENT_DIRECTION,
      previousState: "High-attention / Uneven clarity",
      materialChangeSummary:
        "Physical evidence (shipping counts, Brent above $90, expired talks, long yields, European water-to-power effects) became clearer while strategic intent, Hormuz-control language, Oman’s role, and the diplomatic path remained more uncertain. Confidence stays Moderate; Information Signal still adds no degrees.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "Marine Link / Reuters",
          title: "No US-Iran Talks Planned, Hormuz Remains Closed",
          date: "August 18, 2026",
          url: "https://www.marinelink.com/news/usiran-talks-planned-hormuz-remains-542205",
          supports:
            "Physical shipping still in single digits and Brent above $90 beside contested Hormuz-open/closed and diplomatic-path language",
        },
        {
          institution: "CNBC",
          title: "30-year Treasury yield hits 19-year high",
          date: "August 18, 2026",
          url: "https://www.cnbc.com/2026/08/18/treasury-yields-.html",
          supports:
            "Observable long-duration Treasury and G10 yield repricing becoming a clearer market fact than diplomatic intent",
        },
        {
          institution: "BBC News",
          title:
            "Romania shuts only nuclear plant as heat causes drop in Danube River level",
          date: "August 13–14, 2026 (reviewed August 18, 2026)",
          url: "https://www.bbc.com/news/articles/cqlxpq5q799o",
          supports:
            "European physical-infrastructure effects independently reportable rather than purely narrative",
        },
      ],
    },
  ],
};

export const ISM_SNAPSHOT = latestSnapshot(ISM_SERIES);
