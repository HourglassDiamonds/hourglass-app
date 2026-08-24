/**
 * Global Pressure Monitor — qualitative status only.
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
  "Very high external pressure / Cross-system transmission emerging — energy transmission is material, while broad systemic financial transmission is not confirmed and adaptation still limits broader failure.";

export const GPM_KICKER = "The Ledger Intelligence System";

export const GPM_INTRO =
  "A qualitative monitor of external threat pressure and systemic transmission. This page does not publish a numerical index reading.";

export const GPM_CURRENT_STATE_LABEL = "Current State";

export const GPM_CURRENT_STATE =
  "Very high external pressure / Cross-system transmission emerging";

export const GPM_CURRENT_DIRECTION_LABEL = "Current Direction";

export const GPM_CURRENT_DIRECTION =
  "Escalating corridor coercion / Adaptation still limiting broader failure";

export const GPM_LEAD =
  "Hormuz remains severely constrained. Tracked commodity-vessel crossings stayed below 20 over the weekend, versus roughly 130–140 daily before the conflict, and UKMTO AIS traffic is still about 90% below pre-conflict levels. Iran has blacklisted 45 tankers, warning of fines, detention or cargo confiscation, and new U.S. sanctions pressure entered the cycle. Brent traded around $92–93 during the August 24 review — above $92, but not a sustained $100 regime. Alternative routing remains functional. Energy-price transmission is material; credit and funding markets continue to function, and broad systemic financial transmission is not confirmed.";

export const GPM_WHAT_CHANGED =
  "Since the August 18 review, independently trackable Hormuz traffic remained extremely depressed, with fewer than 20 tracked commodity-vessel crossings over the weekend and UKMTO AIS still about 90% below pre-conflict levels. Iran blacklisted 45 tankers and threatened fines, detention or cargo confiscation. New U.S. sanctions pressure entered the tape, and Brent moved from the ~$90–91 band into approximately $92–93 without establishing a sustained $100 regime. Alternative routing, credit and funding continue to function. Energy transmission is material; broad systemic financial transmission is still not confirmed. The Geo/Energy discrete state is unchanged.";

export const GPM_THREAT_PANEL = {
  title: "Threat Pressure",
  level: "Very High",
  listLabel: "Drivers",
  items: [
    "Weekend commodity-vessel Hormuz crossings still below 20 vs ~130–140 daily pre-conflict",
    "UKMTO AIS traffic still about 90% below pre-conflict levels",
    "Iran blacklisting 45 tankers, with threats of fines, detention or cargo confiscation",
    "New U.S. sanctions pressure; Brent around $92–93, not a sustained $100 regime",
  ],
} as const;

export const GPM_TRANSMISSION_PANEL = {
  title: "System Transmission",
  level: "Partial (energy) / Emerging (financial path)",
  listLabel: "Evidence",
  items: [
    "Energy-price transmission is material at Brent around $92–93",
    "Broad systemic financial transmission is not confirmed; credit and funding continue to function",
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
    body: "Whether Brent holds above $92 and approaches $100, versus a return toward the prior $90 band. A higher print alone is not a new geo temperature increment.",
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
      evidenceCutoff: "August 18, 2026",
      currentState: "Very high external pressure / Cross-system transmission emerging",
      currentDirection:
        "Worsening — energy disruption is beginning to transmit into broader financial conditions while systemic function remains intact.",
      previousState: "Very high external pressure / Partial energy transmission",
      materialChangeSummary:
        "Since the August 12 review, the negotiating window failed and expired, with no talks scheduled. Hormuz restriction continued at extreme levels, shipping counts moved lower still, and additional cargo / regional military risk remained in the cycle. Brent moved from around $89 into a ~$90–91+ regime. Alternative routing continues to absorb part of the shock. Credit and funding markets have not confirmed a seizure, so energy disruption is beginning to reach broader financial conditions even while systemic function remains intact.",
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
    {
      reviewDate: "August 24, 2026",
      evidenceCutoff: LEDGER_EVIDENCE_CUTOFF,
      currentState: GPM_CURRENT_STATE,
      currentDirection: GPM_CURRENT_DIRECTION,
      previousState: "Very high external pressure / Cross-system transmission emerging",
      materialChangeSummary: GPM_WHAT_CHANGED,
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "Reuters",
          title:
            "Fewer than 20 ships transit key Strait of Hormuz over weekend, data shows",
          date: "August 24, 2026",
          url: "https://www.thehindu.com/news/international/fewer-than-20-ships-transit-key-strait-of-hormuz-over-weekend-data-shows/article71383056.ece",
          supports:
            "Fewer than 20 commodity vessels transited Hormuz over the weekend; UKMTO AIS-detected transits approximately 90% below pre-conflict baselines",
        },
        {
          institution: "Reuters",
          title:
            "Iran blacklists 45 tankers over Hormuz transit rules, warns of fines, detention",
          date: "August 24, 2026",
          url: "https://www.moneycontrol.com/world/iran-blacklists-45-tankers-over-hormuz-transit-rules-warns-of-fines-detention-article-14014363.html",
          supports:
            "Iran blacklisted 45 tankers and warned of fines, detention or cargo confiscation; commercial traffic still around 90% below pre-conflict levels per UKMTO cited by Reuters",
        },
        {
          institution: "Reuters",
          title: "Oil falls ahead of US announcement of new sanctions on Iran",
          date: "August 24, 2026",
          url: "https://ca.marketscreener.com/news/oil-falls-as-us-prepares-to-unveil-new-iran-sanctions-ce7858dad089f422",
          supports:
            "Brent around $92–93 on August 24; expected new U.S. sanctions on Iran; Hormuz still constraining shipments that once carried about a fifth of global supplies",
        },
        {
          institution: "U.S. Energy Information Administration",
          title: "Short-Term Energy Outlook — Hormuz-linked disruption context",
          date: "Accessed August 24, 2026",
          url: "https://www.eia.gov/outlooks/steo/",
          supports:
            "Prolonged Middle East flow/production recovery risk under continued Hormuz-linked disruption",
        },
      ],
    },
  ],
};

export const GPM_SNAPSHOT = latestSnapshot(GPM_SERIES);
