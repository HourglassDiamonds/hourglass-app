/**
 * Interim Global Pressure Monitor — qualitative status only.
 * Numerical GPI readings are archived and not published from this surface.
 */

import {
  LEDGER_EVIDENCE_CUTOFF,
  LEDGER_METHODOLOGY_VERSION,
  LEDGER_METHOD_NOTICE,
  LEDGER_STATUS_LABEL,
  latestSnapshot,
  type LedgerMonitorSeries,
} from "./ledger-monitor-framework";

export const GPM_DISPLAY_TITLE = "Global Pressure Monitor";

export const GPM_SEO_TITLE = "Global Pressure Monitor";

export const GPM_SEO_DESCRIPTION =
  "Hourglass Ledger Global Pressure Monitor — interim qualitative status while the numerical index methodology is rebuilt and historically tested.";

export const GPM_HUB_DESCRIPTION =
  "Very high external pressure / Partial energy transmission — Hormuz and Red Sea shipping stress remain elevated while broader credit-system function holds.";

export const GPM_KICKER = "The Ledger Intelligence System";

export const GPM_INTRO =
  "An interim qualitative monitor of external threat pressure and systemic transmission. Numerical index readings remain paused on this page while the qualitative evidence framework is standardized and historically validated.";

export const GPM_STATUS_LABEL = LEDGER_STATUS_LABEL;

export const GPM_CURRENT_STATE_LABEL = "Current State";

export const GPM_CURRENT_STATE =
  "Very high external pressure / Partial energy transmission";

export const GPM_CURRENT_DIRECTION_LABEL = "Current Direction";

export const GPM_CURRENT_DIRECTION =
  "Unstable — energy premium reasserted as reopen hopes faded";

export const GPM_LEAD =
  "Shipping through the Strait of Hormuz remains far below pre-conflict norms. Reuters reporting citing Kpler and LSEG showed a one-week-low transit count around eight vessels on the latest tracked day (LSEG around eleven), versus roughly 130–140 daily before the conflict. Renewed maritime attacks and stalled U.S.–Iran negotiations have supported Brent near the high-$80s / around $89 a barrel. Credit markets and broader funding conditions have not confirmed a systemic financial transmission event. The Ledger’s current interpretation is concentrated external pressure with partial energy-price transmission — not systemic dysfunction.";

export const GPM_WHAT_CHANGED =
  "Since the August 3 review, hopes for a near-term Hormuz reopening faded as talks remained deadlocked and fresh shipping attacks were reported around Hormuz and Bab el-Mandeb. Vessel-tracking counts cited by Reuters fell to a one-week low near eight (Kpler), with LSEG near eleven, against a pre-conflict baseline of roughly 130–140 daily. Brent traded around $89 as the energy-risk premium reasserted. Credit-spread measures reviewed for this cycle remained near historically tight levels, so financial-system transmission stays contained.";

export const GPM_THREAT_PANEL = {
  title: "Threat Pressure",
  level: "Very High",
  listLabel: "Drivers",
  items: [
    "Hormuz transit near a one-week low (~8 Kpler / ~11 LSEG vs ~130–140 pre-conflict)",
    "Renewed commercial-shipping attacks near Hormuz and Bab el-Mandeb",
    "Elevated oil sensitivity with Brent around $89 / the high-$80s",
    "Prolonged Middle East production/flow recovery risk in EIA outlooks",
  ],
} as const;

export const GPM_TRANSMISSION_PANEL = {
  title: "System Transmission",
  level: "Partial (energy) / Contained (credit)",
  listLabel: "Evidence",
  items: [
    "Brent around $89 as maritime attacks and stalled negotiations supported the premium",
    "EIA outlooks continue to treat prolonged Hormuz-linked disruption as material",
    "Reviewed U.S. credit-spread measures remain near historically tight levels",
    "No confirmed crisis-style funding-market seizure in the reviewed evidence",
  ],
} as const;

export const GPM_METHODOLOGY_NOTICE = LEDGER_METHOD_NOTICE;

export const GPM_WATCHING_TITLE = "What We're Watching";

export const GPM_WATCHING_BLOCKS = [
  {
    title: "Hormuz reopen vs continued constraint",
    body: "Whether diplomacy restores meaningful two-way transit — distinct from contested claims of control or recovered flows that vessel-tracking still does not fully corroborate.",
  },
  {
    title: "Oil, inflation & policy path",
    body: "Whether oil remains elevated long enough to materially affect inflation, consumption, and central-bank policy — beyond a short-lived risk premium.",
  },
  {
    title: "Credit, stress & volatility confirmation",
    body: "Whether corporate-credit spreads, financial-stress measures, or volatility begin confirming the geopolitical signal. Without that transmission, financial-system stress stays below crisis bands.",
  },
  {
    title: "Bab el-Mandeb / Red Sea secondary corridor risk",
    body: "Whether Houthi and related shipping attacks broaden into a sustained second corridor shock beyond the primary Hormuz constraint.",
  },
  {
    title: "Supply-chain transmission beyond energy",
    body: "Whether disruption spreads from energy shipping into manufacturing, freight, and final-goods availability.",
  },
] as const;

/** Append-only public series. Future reviews push a new snapshot. */
export const GPM_SERIES: LedgerMonitorSeries = {
  id: "global-pressure",
  methodologyVersion: LEDGER_METHODOLOGY_VERSION,
  snapshots: [
    {
      reviewDate: "August 3, 2026",
      evidenceCutoff: "August 3, 2026",
      currentState: "High external pressure / Contained systemic transmission",
      currentDirection:
        "Unstable, with near-term easing in financial transmission",
      previousState: "High Heat, Concentrated Pressure (archived numerical series)",
      materialChangeSummary:
        "Planned military action affecting the energy-risk premium was paused; oil declined, equities rallied, and yields eased while corridor threat pressure remained elevated.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "U.S. Energy Information Administration",
          title: "Short-Term Energy Outlook / petroleum market updates",
          date: "Accessed August 3, 2026",
          url: "https://www.eia.gov/outlooks/steo/",
          supports:
            "Elevated oil and commodity sensitivity; post-pause easing in energy-risk premium",
        },
      ],
    },
    {
      reviewDate: "August 12, 2026",
      evidenceCutoff: LEDGER_EVIDENCE_CUTOFF,
      currentState: GPM_CURRENT_STATE,
      currentDirection: GPM_CURRENT_DIRECTION,
      previousState: "High external pressure / Contained systemic transmission",
      materialChangeSummary: GPM_WHAT_CHANGED,
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "Reuters",
          title:
            "Hormuz shipping traffic falls to one-week low amid hostilities",
          date: "August 12, 2026",
          url: "https://www.reuters.com/business/energy/hormuz-shipping-traffic-falls-one-week-low-amid-hostilities-2026-08-12/",
          supports:
            "Kpler one-week-low count near eight vessels; LSEG near eleven; pre-conflict baseline roughly 130–140 daily; continued hostilities and reopen deadlock framing",
        },
        {
          institution: "Reuters",
          title:
            "Oil rises as doubts over US-Iran deal heighten supply concerns",
          date: "August 12, 2026",
          url: "https://www.reuters.com/business/energy/oil-rises-as-doubts-over-us-iran-deal-heighten-supply-concerns-2026-08-12/",
          supports:
            "Brent around $89; maritime attacks in Hormuz and Bab el-Mandeb; stalled U.S.–Iran negotiations supporting the energy-risk premium",
        },
        {
          institution: "U.S. Energy Information Administration",
          title: "Short-Term Energy Outlook — Hormuz-linked disruption context",
          date: "Accessed August 12, 2026",
          url: "https://www.eia.gov/outlooks/steo/",
          supports:
            "Structural Middle East flow/production recovery risk and elevated 2026 Brent outlook under continued Hormuz-linked disruption",
        },
        {
          institution: "Federal Reserve Bank of St. Louis (FRED)",
          title: "ICE BofA US Corporate Index Option-Adjusted Spread (BAMLC0A0CM)",
          date: "Accessed August 12, 2026",
          url: "https://fred.stlouisfed.org/series/BAMLC0A0CM",
          supports:
            "Investment-grade credit spreads remaining near historically tight levels — no confirmed crisis-style financial transmission",
        },
      ],
    },
  ],
};

export const GPM_SNAPSHOT = latestSnapshot(GPM_SERIES);
