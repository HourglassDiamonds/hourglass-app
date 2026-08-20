/**
 * Interim Global Pressure Monitor — qualitative status only.
 * Numerical GPI readings are archived and not published from this surface.
 */

import {
  LEDGER_EVIDENCE_CUTOFF,
  LEDGER_METHODOLOGY_VERSION,
  LEDGER_METHOD_NOTICE,
  latestSnapshot,
  type LedgerMonitorSeries,
} from "./ledger-monitor-framework";

export const GPM_DISPLAY_TITLE = "Global Pressure Monitor";

export const GPM_SEO_TITLE = "Global Pressure Monitor";

export const GPM_SEO_DESCRIPTION =
  "Hourglass Ledger Global Pressure Monitor — qualitative status of external threat pressure and systemic transmission.";

export const GPM_HUB_DESCRIPTION =
  "Very high external pressure / Cross-system transmission emerging — energy disruption is beginning to transmit into broader financial conditions while systemic function remains intact.";

export const GPM_KICKER = "The Ledger Intelligence System";

export const GPM_INTRO =
  "A qualitative monitor of external threat pressure and systemic transmission. Numerical index readings remain paused on this page.";

export const GPM_CURRENT_STATE_LABEL = "Current State";

export const GPM_CURRENT_STATE =
  "Very high external pressure / Cross-system transmission emerging";

export const GPM_CURRENT_DIRECTION_LABEL = "Current Direction";

export const GPM_CURRENT_DIRECTION =
  "Worsening — energy disruption is beginning to transmit into broader financial conditions while systemic function remains intact.";

export const GPM_LEAD =
  "The U.S.–Iran negotiating window expired without an extension or scheduled talks. Hormuz transit remains extremely restricted: vessel-tracking prints cited in the current cycle remain in the low single digits versus roughly 130–140 daily before the conflict, and below the already-low August 12 counts. Brent has established a higher ~$90–91+ regime. Alternative Gulf crude-routing remains functional, and reviewed evidence does not show a broad non-energy supply-chain seizure. Energy-price effects are confirmed; credit and funding markets continue to function.";

export const GPM_WHAT_CHANGED =
  "Since the August 12 review, the negotiating window failed and expired, with no talks scheduled. Hormuz restriction continued at extreme levels, shipping counts moved lower still, and additional cargo / regional military risk remained in the cycle. Brent moved from around $89 into a ~$90–91+ regime. Alternative routing continues to absorb part of the shock. Credit and funding markets have not confirmed a seizure, so energy disruption is beginning to reach broader financial conditions even while systemic function remains intact.";

export const GPM_THREAT_PANEL = {
  title: "Threat Pressure",
  level: "Very High",
  listLabel: "Drivers",
  items: [
    "Failed / expired U.S.–Iran negotiating window; no talks scheduled",
    "Hormuz transit still extreme (low-single-digit prints vs ~130–140 pre-conflict)",
    "Brent established in a ~$90–91+ regime",
    "Continuing cargo and regional military risk beside the primary corridor constraint",
  ],
} as const;

export const GPM_TRANSMISSION_PANEL = {
  title: "System Transmission",
  level: "Partial (energy) / Emerging (financial path)",
  listLabel: "Evidence",
  items: [
    "Energy-price transmission is confirmed at a higher oil regime",
    "Long-duration borrowing costs have risen alongside the energy shock, without a confirmed funding-market seizure",
    "Alternative Gulf crude-routing remains functional",
    "No verified broad non-energy supply-chain or funding-market seizure in the evidence reviewed",
  ],
} as const;

export const GPM_METHODOLOGY_NOTICE = LEDGER_METHOD_NOTICE;

export const GPM_WATCHING_TITLE = "What We're Watching";

export const GPM_WATCHING_BLOCKS = [
  {
    title: "Hormuz transit vs continued restriction",
    body: "Whether independently trackable transit recovers from extreme single-digit prints, or whether restriction deepens further.",
  },
  {
    title: "Diplomatic path after the expired window",
    body: "Whether a new scheduled negotiating framework appears — distinct from contested control claims or unrecovered flow statements.",
  },
  {
    title: "Oil regime durability",
    body: "Whether Brent holds mid-$90s or approaches $100, versus a return below the newly established $90+ band.",
  },
  {
    title: "Credit, stress & volatility confirmation",
    body: "Whether corporate-credit spreads, financial-stress measures, or funding markets begin confirming a seizure. Absent that, financial-system stress stays below crisis bands.",
  },
  {
    title: "Supply-chain transmission beyond energy",
    body: "Whether disruption spreads from energy shipping into manufacturing, freight, and final-goods availability. That transmission is not confirmed in the current evidence.",
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
      evidenceCutoff: "August 12, 2026",
      currentState: "Very high external pressure / Partial energy transmission",
      currentDirection:
        "Unstable — energy premium reasserted as reopen hopes faded",
      previousState: "High external pressure / Contained systemic transmission",
      materialChangeSummary:
        "Since the August 3 review, hopes for a near-term Hormuz reopening faded as talks remained deadlocked and fresh shipping attacks were reported around Hormuz and Bab el-Mandeb. Vessel-tracking counts cited by Reuters fell to a one-week low near eight (Kpler), with LSEG near eleven, against a pre-conflict baseline of roughly 130–140 daily. Brent traded around $89 as the energy-risk premium reasserted. Credit-spread measures reviewed for this cycle remained near historically tight levels, so financial-system transmission stays contained.",
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
    {
      reviewDate: "August 18, 2026",
      evidenceCutoff: LEDGER_EVIDENCE_CUTOFF,
      currentState: GPM_CURRENT_STATE,
      currentDirection: GPM_CURRENT_DIRECTION,
      previousState: "Very high external pressure / Partial energy transmission",
      materialChangeSummary: GPM_WHAT_CHANGED,
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "The National",
          title:
            "Hormuz traffic falls to single digits as 60-day deadline for US-Iran MoU expires",
          date: "August 17, 2026 (reviewed August 18, 2026)",
          url: "https://www.thenationalnews.com/business/energy/2026/08/17/hormuz-traffic-falls-to-single-digits-as-60-day-deadline-for-us-iran-mou-expires/",
          supports:
            "Expired 60-day MoU; single-digit Hormuz crossings; Iranian Hormuz oil flows down sharply; pre-conflict transit far above current prints",
        },
        {
          institution: "Marine Link / Reuters",
          title: "No US-Iran Talks Planned, Hormuz Remains Closed",
          date: "August 18, 2026",
          url: "https://www.marinelink.com/news/usiran-talks-planned-hormuz-remains-542205",
          supports:
            "No talks taking place or scheduled; Brent settled just over $91; preliminary shipping data still in single digits",
        },
        {
          institution: "Al Jazeera / UKMTO",
          title:
            "Vessel hit by ‘unknown projectile’ in Strait of Hormuz, UKMTO says",
          date: "August 18, 2026",
          url: "https://www.aljazeera.com/news/2026/8/18/vessel-hit-by-unknown-projectile-in-strait-of-hormuz-ukmto-says",
          supports:
            "Additional cargo / maritime-risk incident in the strait beside the primary transit constraint; single-digit crossings versus 130+ pre-conflict",
        },
        {
          institution: "OilPrice.com",
          title: "How Gulf Oil Is Escaping the Strait of Hormuz",
          date: "August 18, 2026",
          url: "https://oilprice.com/Energy/Crude-Oil/How-Gulf-Oil-Is-Escaping-the-Strait-of-Hormuz.html",
          supports:
            "Brent around $91; Monday commodity-vessel count in low single digits; alternative routing / ship-to-ship and bypass mechanisms remaining part of the absorption story",
        },
        {
          institution: "U.S. Energy Information Administration",
          title: "Short-Term Energy Outlook — Hormuz-linked disruption context",
          date: "Accessed August 18, 2026",
          url: "https://www.eia.gov/outlooks/steo/",
          supports:
            "Prolonged Middle East flow/production recovery risk under continued Hormuz-linked disruption",
        },
        {
          institution: "Federal Reserve Bank of St. Louis (FRED)",
          title: "ICE BofA US Corporate Index Option-Adjusted Spread (BAMLC0A0CM)",
          date: "Latest observation August 17, 2026 (accessed August 18, 2026)",
          url: "https://fred.stlouisfed.org/series/BAMLC0A0CM",
          supports:
            "No verified broad credit-spread or funding-market dysfunction in the evidence reviewed; August 17 IG OAS observation 0.81 — not an August 18 live print",
        },
        {
          institution: "Federal Reserve Bank of St. Louis (FRED)",
          title:
            "ICE BofA US High Yield Index Option-Adjusted Spread (BAMLH0A0HYM2)",
          date: "Latest observation August 17, 2026 (accessed August 18, 2026)",
          url: "https://fred.stlouisfed.org/series/BAMLH0A0HYM2",
          supports:
            "August 17 HY OAS observation 2.70; dated credit print, not an August 18 live funding-market seizure",
        },
      ],
    },
  ],
};

export const GPM_SNAPSHOT = latestSnapshot(GPM_SERIES);
