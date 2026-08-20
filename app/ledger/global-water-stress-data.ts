/**
 * Global Water Stress Monitor — qualitative public Ledger surface.
 * Water is an evidence layer, not a sixth System Temperature channel.
 * Downstream consequences enter Physical Infrastructure, and Geopolitics
 * where security implications warrant. Do not double-count.
 */

import {
  LEDGER_EVIDENCE_CUTOFF,
  LEDGER_METHODOLOGY_VERSION,
  latestSnapshot,
  type LedgerMonitorSeries,
} from "./ledger-monitor-framework";

export const GWS_DISPLAY_TITLE = "Global Water Stress Monitor";

export const GWS_SEO_DESCRIPTION =
  "Hourglass Ledger Global Water Stress Monitor — qualitative reading of rivers, reservoirs, municipal supply, agriculture, energy transmission, and policy/security, including both worsening and improving regions.";

export const GWS_INTRO =
  "A qualitative monitor of water as a physical evidence layer: rivers and surface water, reservoirs and aquifers, municipal supply, agriculture, energy and industrial transmission, and policy/security. Downstream effects appear in power, freight, and security where they are independently visible. Improving regions are shown alongside worsening ones.";

export const GWS_CURRENT_STATE = "High water stress / Multi-system transmission";

export const GWS_CURRENT_DIRECTION =
  "Worsening globally / highly uneven regionally";

export const GWS_SUMMARY =
  "Water stress is high and transmitting into multiple systems, but the map is highly uneven. European rivers are producing real power, freight, agricultural, and municipal effects this season. The Colorado River remains a long-running structural stress, not a new weekly shock. The Tigris–Euphrates system is materially improved after winter precipitation and higher Iraqi reserves, while remaining structurally vulnerable to upstream dependence. Gulf desalination is a strategic vulnerability in a war setting — not a current regional drinking-water collapse. India is watch / elevated seasonal risk; rainfall forecasts are not confirmed system failure.";

export const GWS_WEEKLY_SIGNAL =
  "Europe is carrying the clearest near-term water stress, with low river levels affecting power generation, freight and agriculture. Conditions across the Tigris–Euphrates system have improved materially in 2026, though upstream dependence remains a structural vulnerability. The Colorado River remains under long-term stress, but current conditions do not represent a new weekly deterioration.";

export const GWS_CATEGORIES = [
  {
    name: "Rivers & Surface Water",
    level: "High, uneven",
    body: "European river-level constraints are active this season. Colorado remains structurally stressed. Tigris–Euphrates surface conditions improved on winter precipitation and higher reserves, without removing upstream vulnerability.",
  },
  {
    name: "Reservoirs & Aquifers",
    level: "Mixed",
    body: "Iraqi reserves are reported substantially higher than the prior stressed comparison year. Colorado Basin storage remains a long-running allocation problem. Aquifer stress is regional rather than a single global print.",
  },
  {
    name: "Municipal / Drinking Water",
    level: "Selective restrictions",
    body: "Some European municipal and agricultural restrictions are materially relevant. Gulf drinking-water systems are not in confirmed regional collapse; the live issue is strategic desalination exposure if power facilities are hit.",
  },
  {
    name: "Agriculture & Food",
    level: "Seasonal / regional",
    body: "European agricultural water limits are part of the current seasonal transmission. Improving Iraqi marsh and irrigation conditions sit beside that European pressure. India remains a forecast-sensitive watch, not a confirmed crop-system failure.",
  },
  {
    name: "Energy / Industrial Transmission",
    level: "Confirmed in Europe",
    body: "Low Danube cooling water has affected Romanian nuclear output; hydro weakness and nuclear-cooling effects appear elsewhere in Europe; Rhine/Danube freight is constrained.",
  },
  {
    name: "Policy / Security",
    level: "Strategic, not collapsed",
    body: "Gulf desalination is strategically exposed because it depends on power. That is a transmission-path risk, not evidence of a current regional tap collapse. Upstream dependence on the Tigris–Euphrates remains a structural political fact even in a better hydrologic year.",
  },
] as const;

export const GWS_REGIONS = [
  {
    name: "Europe",
    level: "High",
    direction: "Worsening seasonally",
    transmission: "Power / freight / agriculture / municipal",
    body: "River-level constraints are producing real effects: nuclear cooling, hydro weakness, Rhine/Danube freight, and selected municipal and agricultural restrictions. Operators are adapting. This is seasonal worsening, not continental system failure.",
  },
  {
    name: "Colorado River",
    level: "Severe structural stress",
    direction: "Long-running",
    transmission: "Water / hydropower / allocations",
    body: "Persistent structural drought and allocation pressure continue. Current conditions extend the long-running basin stress rather than a new weekly deterioration.",
  },
  {
    name: "Tigris / Euphrates",
    level: "Materially improved / structurally vulnerable",
    direction: "Improving hydrology, persistent upstream risk",
    transmission: "Irrigation / marshes / municipal / political dependence",
    body: "Winter precipitation and higher Iraqi reserves — including a much stronger storage comparison versus the prior stressed year — produced partial marsh recovery where supported. Continued dependence on upstream countries remains. The 2026 hydrologic picture is an improvement inside that structural vulnerability.",
  },
  {
    name: "Persian Gulf",
    level: "High strategic desalination vulnerability",
    direction: "Security-exposed, not a tap collapse",
    transmission: "Power / desalination / municipal security",
    body: "The key story is that war can transmit into water security because power and desalination facilities are strategically exposed. That is a strategic vulnerability, not a current regional drinking-water collapse.",
  },
  {
    name: "India",
    level: "Watch / elevated seasonal risk",
    direction: "Forecast-sensitive",
    transmission: "Monsoon / agriculture / municipal watch",
    body: "Seasonal risk is elevated enough to watch. Rainfall forecasts are not confirmed system failure.",
  },
] as const;

export const GWS_WHAT_WATCHING = [
  {
    title: "European river recovery or deterioration",
    body: "Whether Danube and Rhine levels, nuclear cooling, hydro, freight, and municipal restrictions ease or deepen.",
  },
  {
    title: "Actual Gulf desalination outage",
    body: "Whether strategic exposure becomes a confirmed facility outage affecting municipal supply — not merely a vulnerability narrative.",
  },
  {
    title: "Iraqi reserve and marsh durability",
    body: "Whether the 2026 hydrologic improvement holds through the dry season, distinct from unchanged upstream dependence.",
  },
  {
    title: "Colorado allocation actions",
    body: "Whether structural basin stress produces a material new policy or hydropower event, rather than continuation of the known drought.",
  },
  {
    title: "India monsoon realization",
    body: "Whether seasonal forecasts convert into confirmed agricultural or municipal stress.",
  },
] as const;

export const GWS_FOOTER_NOTE =
  "The Global Water Stress Monitor is a qualitative evidence layer and does not publish a degree score. Physical effects on power and freight appear on the Infrastructure monitor; security implications appear only where they are independently warranted.";

/** Append-only public series. This is the first published snapshot. */
export const GWS_SERIES: LedgerMonitorSeries = {
  id: "global-water-stress",
  methodologyVersion: LEDGER_METHODOLOGY_VERSION,
  snapshots: [
    {
      reviewDate: "August 18, 2026",
      evidenceCutoff: LEDGER_EVIDENCE_CUTOFF,
      currentState: GWS_CURRENT_STATE,
      currentDirection: GWS_CURRENT_DIRECTION,
      previousState: null,
      materialChangeSummary:
        "First published water monitor. High water stress with multi-system transmission, worsening globally and highly uneven regionally. Europe is the live seasonal deterioration; Colorado is long-running structural stress; Tigris–Euphrates is a material improvement inside continued structural vulnerability; Gulf desalination is strategic exposure rather than current collapse; India is watch / forecast, not confirmed failure.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "BBC News",
          title:
            "Romania shuts only nuclear plant as heat causes drop in Danube River level",
          date: "August 13–14, 2026 (reviewed August 18, 2026)",
          url: "https://www.bbc.com/news/articles/cqlxpq5q799o",
          supports:
            "European high seasonal water stress transmitting into nuclear cooling, hydro, and Rhine freight; operators adapting",
        },
        {
          institution: "United Nations in Iraq",
          title: "Rain Brief: Recent Rainfall and Water Situation in Iraq",
          date: "2026 (reviewed August 18, 2026)",
          url: "https://iraq.un.org/en/316784-rain-brief-recent-rainfall-and-water-situation-iraq",
          supports:
            "Above-normal 2025–26 winter rainfall and material storage recovery, with continued upstream/structural vulnerability",
        },
        {
          institution: "964media / Iraqi Water Resources Ministry reporting",
          title:
            "Water reserves rebound but the ministry expects to use 40% before winter",
          date: "2026 (reviewed August 18, 2026)",
          url: "https://en.964media.com/50317/",
          supports:
            "Iraqi storage recovered to about 34 billion cubic meters after a wetter winter; partial marsh recovery; continued dependence on upstream countries",
        },
        {
          institution: "U.S. Bureau of Reclamation",
          title: "24-Month Study Projections — Colorado River system operations",
          date: "July 2026 study (reviewed August 18, 2026)",
          url: "https://www.usbr.gov/lc/region/g4000/riverops/24ms-projections.html",
          supports:
            "Long-running structural drought, storage, and allocation operations at Powell/Mead rather than a new weekly shock in this review window",
        },
        {
          institution: "CSIS",
          title:
            "Could Iran Disrupt the Gulf Countries’ Desalinated Water Supplies?",
          date: "Published March 19, 2026 (reviewed August 18, 2026)",
          url: "https://www.csis.org/analysis/could-iran-disrupt-gulf-countries-desalinated-water-supplies",
          supports:
            "Strategic desalination/power vulnerability in a war setting; not evidence of a confirmed regional drinking-water collapse across the Gulf",
        },
        {
          institution: "India Meteorological Department",
          title:
            "Updated Long Range Forecast for the Southwest Monsoon Seasonal Rainfall during June–September, 2026",
          date: "Published May 29, 2026 (reviewed August 18, 2026)",
          url: "https://mausam.imd.gov.in/Forecast/marquee_data/Press_release_2nd_stage_LRF_29_May_2026-Final.pdf",
          supports:
            "Official seasonal rainfall forecast of below-normal monsoon (90% of LPA ±4%) — India remains watch / forecast, not confirmed agricultural or municipal system failure",
        },
      ],
    },
  ],
};

export const GWS_SNAPSHOT = latestSnapshot(GWS_SERIES);
