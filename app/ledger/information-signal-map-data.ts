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

export const ISM_UPDATED_LABEL =
  "Interim status — methodology revision in progress";

export const ISM_READING = {
  score: 85,
  label: "Signal Clarity",
  status: "High-Attention, Uneven Clarity",
  weeklyChange: 0,
} as const;

export const ISM_SUMMARY =
  "High-attention, uneven clarity persists around Hormuz. Official or political claims about corridor control and recovered flows compete with Reuters-cited Kpler/LSEG transit prints near a one-week low (about eight / eleven vessels versus roughly 130–140 pre-conflict). Fresh shipping-attack reports near Hormuz and Bab el-Mandeb raise density without settling a shared operational facts base. Oil around $89 is told as either temporary risk premium or prolonged supply disruption depending on the outlet. On the AI channel, OpenAI’s August ChatGPT updates broaden consumer access while leaving Work/Codex versions distinct — another case where “updated” describes different surfaces. The Ledger’s current interpretation is that signal density remains high and clarity has not improved enough to raise confidence.";

export const ISM_SIGNAL_GRID = [
  {
    title: "Consensus",
    body: "Hormuz remains constrained relative to pre-conflict norms; energy-risk premium and AI power/large-load constraints continue appearing together across institutional, market, and specialist sources.",
  },
  {
    title: "Divergence",
    body: "Recovered-flow or control claims versus Kpler/LSEG single-digit Hormuz prints; reopen-talk optimism versus Iranian conditionality; oil around $89 as temporary scare versus prolonged disruption; ChatGPT August updates versus unchanged Work/Codex model versions.",
  },
  {
    title: "Underweighted",
    body: "The gap between political claims of corridor control or recovered exports and independently trackable transit volumes — and the distinction between consumer ChatGPT model updates and enterprise/Codex deployments.",
  },
] as const;

export const ISM_SOURCE_STACK = [
  {
    title: "Institutional",
    body: "Emphasizes maritime security actions, blockade and transit framing, diplomatic channels through regional intermediaries, and measured language on reopen prospects — with uneven agreement on whether talks are “advanced” or stalled.",
  },
  {
    title: "Market",
    body: "Emphasizes Brent near $90, credit still comparatively calm, rate-path sensitivity ahead of CPI, and AI capex under power constraints — linking energy premium to policy path more tightly than to funding stress.",
  },
  {
    title: "Infrastructure",
    body: "Emphasizes PJM large-load / resource-adequacy frameworks, data-center curtailment pathways from 2027, and structural interconnection limits rather than expired mid-July emergency-order windows.",
  },
  {
    title: "Mainstream",
    body: "Emphasizes shipping attacks, Hormuz deadlock headlines, oil reclaiming $90, and AI consumer-access updates — often compressing contested flow claims and operational tracking into a single crisis frame.",
  },
] as const;

export const ISM_NARRATIVE_MAP = [
  {
    title: "Domestic Framing",
    body: "Emphasizes consumer prices, summer energy costs, and AI product access. Tends to underweight vessel-tracking contradictions and the difference between ChatGPT consumer updates and enterprise deployment constraints.",
  },
  {
    title: "Political Framing",
    body: "Emphasizes control of the strait, reparations and sanctions conditions, and reopen diplomacy. Tends to underweight slow-moving physical transit data and credit-market non-confirmation.",
  },
  {
    title: "Market Framing",
    body: "Emphasizes oil band action near $90, yields ahead of CPI, and tight credit spreads. Tends to underweight narrative conflict over how much oil is actually leaving the Gulf day to day.",
  },
  {
    title: "Infrastructure Framing",
    body: "Emphasizes PJM IRAS / large-load registry proposals and bring-your-own-capacity requirements. Tends to underweight near-term headline compression around Hormuz diplomacy.",
  },
] as const;

export const ISM_NARRATIVE_SHIFT =
  "Clarity did not improve. Coverage now splits among recovered-export or control claims, Reuters-cited Kpler/LSEG Hormuz prints near a one-week low, reopen diplomacy described as both advanced and blocked, and fresh attack reports at Hormuz and Bab el-Mandeb. Market outlets treat Brent around $89 as either a fading scare or evidence of prolonged disruption. OpenAI’s August 6 ChatGPT access updates sit beside unchanged Work/Codex model versions — another instance of “updated” describing different realities. Density remains high; confidence stays Moderate.";

export const ISM_WHAT_TO_WATCH = [
  {
    title: "Flow-claim alignment",
    body: "Whether official recovered-export statements and independent vessel-tracking prints begin describing the same Hormuz operating reality.",
  },
  {
    title: "Reopen diplomacy vs conditionality",
    body: "Whether Oman/Qatar-mediated talks produce verifiable transit restoration or remain a competing headline layer beside Iranian conditions and U.S. control claims.",
  },
  {
    title: "Oil band storytelling",
    body: "Whether markets and media treat Brent near $90 as one continuous energy-premium story or as conflicting temporary vs structural signals.",
  },
  {
    title: "AI access qualification",
    body: "Whether consumer ChatGPT updates continue to be framed as equivalent to enterprise/Codex capability when model versions remain distinct.",
  },
] as const;

export const ISM_WHAT_WOULD_CHANGE = [
  {
    title: "Information noise reduction",
    body: "Lower headline density and cleaner single-theme reads across policy, markets, and shipping coverage — without implying corridor conditions have eased.",
  },
  {
    title: "Transit-data alignment",
    body: "Closer alignment between official flow claims and independently trackable Hormuz/Bab el-Mandeb transit volumes.",
  },
  {
    title: "Narrative decoupling",
    body: "Energy-corridor stress, credit conditions, and AI grid constraints discussed again as separable storylines with less forced equivalence.",
  },
  {
    title: "Tone moderation",
    body: "More measured cadence across institutional, market, infrastructure, and mainstream sources at the same time.",
  },
] as const;

export const ISM_FOOTER_NOTE =
  "Narrative analysis and framing comparison — observational, without speculation or certainty claims. Information Signal informs System Temperature confidence only; it does not add temperature.";

export const ISM_CURRENT_STATE = "High-attention / Uneven clarity";

export const ISM_CURRENT_DIRECTION =
  "More conflicting corridor claims; no clarity improvement.";

export const ISM_HUB_STATUS = ISM_CURRENT_STATE;

export const ISM_HUB_DESCRIPTION =
  "High-attention / Uneven clarity — recovered-flow claims, vessel-tracking prints, and reopen diplomacy still compete without a shared operational facts base.";

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
      evidenceCutoff: LEDGER_EVIDENCE_CUTOFF,
      currentState: ISM_CURRENT_STATE,
      currentDirection: ISM_CURRENT_DIRECTION,
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
  ],
};

export const ISM_SNAPSHOT = latestSnapshot(ISM_SERIES);
