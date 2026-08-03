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
  "Interim qualitative monitor of external threat pressure and systemic transmission — numerical readings paused pending methodology revision.";

export const GPM_KICKER = "The Ledger Intelligence System";

export const GPM_INTRO =
  "An interim qualitative monitor of external threat pressure and systemic transmission. Numerical index readings are paused while the model is rebuilt around a fixed, auditable methodology.";

export const GPM_STATUS_LABEL = LEDGER_STATUS_LABEL;

export const GPM_CURRENT_STATE_LABEL = "Current State";

export const GPM_CURRENT_STATE =
  "High external pressure / Contained systemic transmission";

export const GPM_CURRENT_DIRECTION_LABEL = "Current Direction";

export const GPM_CURRENT_DIRECTION =
  "Unstable, with near-term easing in financial transmission";

export const GPM_LEAD =
  "Geopolitical and energy risks remain unusually elevated, particularly around critical shipping corridors. Financial markets and the wider economy have not yet confirmed a systemic transmission event. The Ledger’s current interpretation is that pressure is concentrated rather than fully systemic. Numerical readings will return only after the revised model has been historically tested and documented.";

export const GPM_WHAT_CHANGED =
  "Since the previous review, planned military action affecting the energy-risk premium was paused. Market pricing indicated subsequent oil declines, an equity rally, and easier Treasury yields, while credit markets continued to avoid crisis-level stress. Threat pressure around shipping corridors and geopolitical escalation remains elevated.";

export const GPM_THREAT_PANEL = {
  title: "Threat Pressure",
  level: "Very High",
  listLabel: "Drivers",
  items: [
    "Critical shipping-corridor disruption",
    "Persistent geopolitical escalation risk",
    "Elevated oil and commodity sensitivity",
    "Structural electricity-grid constraints",
  ],
} as const;

export const GPM_TRANSMISSION_PANEL = {
  title: "System Transmission",
  level: "Moderate / Currently Easing",
  listLabel: "Evidence",
  items: [
    "Oil prices declined following the pause in planned military action",
    "Equity markets rallied and Treasury yields eased",
    "Credit markets are not showing crisis-level stress",
    "Latest available supply-chain pressure data remains elevated but declined month over month",
  ],
} as const;

export const GPM_METHODOLOGY_NOTICE = LEDGER_METHOD_NOTICE;

export const GPM_WATCHING_TITLE = "What We're Watching";

export const GPM_WATCHING_BLOCKS = [
  {
    title: "Hormuz & Bab el-Mandeb corridors",
    body: "Whether disruption through Hormuz and Bab el-Mandeb persists or broadens — including vessel risk, transit volumes, insurance conditions, and competing claims over route control.",
  },
  {
    title: "Oil, inflation & policy path",
    body: "Whether oil remains elevated long enough to materially affect inflation, consumption, and central-bank policy — distinct from a short-lived energy premium that never transmits.",
  },
  {
    title: "Credit, stress & volatility confirmation",
    body: "Whether corporate-credit spreads, financial-stress measures, or volatility begin confirming the geopolitical signal. Without that transmission, financial-system stress stays below crisis bands.",
  },
  {
    title: "Supply-chain transmission",
    body: "Whether supply-chain disruption spreads beyond energy shipping into manufacturing, freight, and final-goods availability.",
  },
  {
    title: "Electricity systems under demand",
    body: "Whether electricity systems continue operating normally under record demand or increasingly require emergency measures.",
  },
] as const;

/** Append-only public series. Future reviews push a new snapshot. */
export const GPM_SERIES: LedgerMonitorSeries = {
  id: "global-pressure",
  methodologyVersion: LEDGER_METHODOLOGY_VERSION,
  snapshots: [
    {
      reviewDate: "August 3, 2026",
      evidenceCutoff: LEDGER_EVIDENCE_CUTOFF,
      currentState: GPM_CURRENT_STATE,
      currentDirection: GPM_CURRENT_DIRECTION,
      previousState: "High Heat, Concentrated Pressure (archived numerical series)",
      materialChangeSummary: GPM_WHAT_CHANGED,
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
        {
          institution: "U.S. Department of Transportation / maritime reporting",
          title: "Public shipping-corridor and vessel-risk coverage synthesis",
          date: "Reviewed through August 3, 2026",
          supports:
            "Critical shipping-corridor disruption around Hormuz and Bab el-Mandeb",
        },
        {
          institution: "Federal Reserve Bank of St. Louis (FRED)",
          title: "Treasury yields and equity market series",
          date: "Accessed August 3, 2026",
          url: "https://fred.stlouisfed.org/",
          supports:
            "Equity rally and Treasury-yield easing after the pause in planned military action",
        },
        {
          institution: "Federal Reserve Board",
          title: "Financial Stress Index / credit-spread monitoring",
          date: "Accessed August 3, 2026",
          url: "https://www.federalreserve.gov/econres/notes/feds-notes/default.htm",
          supports: "Credit markets not showing crisis-level stress",
        },
      ],
    },
  ],
};

export const GPM_SNAPSHOT = latestSnapshot(GPM_SERIES);
