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
  "Uneven — Colorado still severe / Texas industrial-use enforcement";

export const GWS_SUMMARY =
  "Water stress is high and transmitting into multiple systems, but the map remains highly uneven. Colorado River conditions stay severe: Lake Powell around 22% full and Lake Mead around 26% as of the September 8 Reclamation weekly, with total system storage near 31%; Upper Basin officials agreed on September 15 to continue Flaming Gorge emergency releases to protect Powell. That is adaptation inside structural shortage, not recovery. Texas is now enforcing data-center water reporting — industrial-use transmission, not a statewide municipal collapse. Europe retains high seasonal stress with previously confirmed power, freight, and agricultural transmission. Tigris–Euphrates remains materially improved and structurally vulnerable. FAO’s August Food Price Index at 133.3 is a cross-system food/agriculture signal, not a new water temperature weight. Water remains qualitative and receives no System Temperature weight.";

export const GWS_WEEKLY_SIGNAL =
  "Colorado remains a severe structural shortage with emergency releases continuing. Texas data-center water enforcement is the new industrial-use print. Do not ratchet the whole water monitor because one region stays severe. Tigris–Euphrates remains the hydrologic counter-signal. Water is an evidence layer, not a sixth temperature weight.";

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
    body: "Some European municipal and agricultural restrictions are materially relevant. Texas is compelling industrial water reporting from data centers. Gulf drinking-water systems are not in confirmed regional collapse; the live issue is strategic desalination exposure if power facilities are hit.",
  },
  {
    name: "Agriculture & Food",
    level: "Seasonal / regional",
    body: "European agricultural water limits remain part of seasonal transmission. FAO’s August Food Price Index rose to 133.3, with weather, Middle East conflict, and Black Sea logistics among pressures — a cross-system food signal, not a standalone water degree. Improving Iraqi marsh and irrigation conditions sit beside that pressure. India remains a forecast-sensitive watch, not a confirmed crop-system failure.",
  },
  {
    name: "Energy / Industrial Transmission",
    level: "Confirmed in Europe",
    body: "Texas data-center water reporting is now an enforcement issue. Low Danube cooling water has affected Romanian nuclear output; hydro weakness and nuclear-cooling effects appear elsewhere in Europe; Rhine/Danube freight is constrained. Colorado hydropower risk at Glen Canyon remains relevant.",
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
    level: "Severe structural stress / Confirmed allocation response",
    direction: "Worsening / policy transmission",
    transmission: "Water / hydropower / allocations",
    body: "Federal 2027–2028 Lower Basin allocation reductions of about 1.25 million acre-feet a year remain in force. As of the September 8 Reclamation weekly, Lake Powell was about 22% full (elevation about 3,517.6 feet) and Lake Mead about 26% (about 1,038.9 feet), with total system storage near 31%. Upper Basin officials agreed September 15 to continue Flaming Gorge emergency releases to protect Powell. This is confirmed structural shortage plus emergency adaptation, not recovery.",
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
    title: "Colorado allocation follow-through and Powell protection",
    body: "Whether 2027–2028 Lower Basin cuts hold, whether Flaming Gorge emergency releases keep Powell above critical hydropower elevations, and whether later cuts deepen.",
  },
  {
    title: "Texas data-center water compliance",
    body: "Whether reporting enforcement produces usable industrial-use data and interconnection discipline, or whether noncompliance and load growth outrun the gate.",
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
      evidenceCutoff: "August 18, 2026",
      currentState: "High water stress / Multi-system transmission",
      currentDirection: "Worsening globally / highly uneven regionally",
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
    {
      reviewDate: "August 24, 2026",
      evidenceCutoff: "August 24, 2026",
      currentState: "High water stress / Multi-system transmission",
      currentDirection: "Worsening / Policy transmission broadening",
      previousState: "High water stress / Multi-system transmission",
      materialChangeSummary:
        "Colorado River is now a material change since August 18: federal 2027–2028 Lower Basin allocation reductions of about 1.25 million acre-feet a year, with potential for deeper later cuts; Lake Powell and Lake Mead at record-low conditions; Powell approaching the minimum elevation needed for Glen Canyon Dam hydropower. Europe retains high seasonal stress with confirmed power/freight/agricultural transmission. Tigris/Euphrates remains materially improved / structurally vulnerable. Gulf desalination remains a strategic vulnerability, not a regional tap collapse. India remains watch/elevated seasonal risk. Water stays qualitative with no System Temperature weight.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "U.S. Department of the Interior",
          title: "Interior Department Finalizes Plans for 2027-2028 Colorado River Operations",
          date: "August 21, 2026 (reviewed August 24, 2026)",
          url: "https://www.doi.gov/pressreleases/interior-department-finalizes-plans-2027-2028-colorado-river-operations",
          supports:
            "Federal 2027–2028 Lower Basin delivery reductions of 1.25 million acre-feet a year; Powell beginning the water year in the lower-elevation infrastructure-protection range",
        },
        {
          institution: "U.S. Bureau of Reclamation",
          title: "Colorado River Post-2026 Operations",
          date: "August 21, 2026 Record of Decision (reviewed August 24, 2026)",
          url: "https://www.usbr.gov/ColoradoRiverBasin/post2026/index.html",
          supports:
            "Record of Decision and 2027–2028 operating guidelines as confirmed allocation-policy transmission, not merely continuation of known drought",
        },
        {
          institution: "AP News",
          title: "Amid dire drought on the Colorado River, federal officials announce water cuts to three states",
          date: "August 21, 2026 (reviewed August 24, 2026)",
          url: "https://apnews.com/article/colorado-river-drought-water-cuts-dfb3a5deec3ecaeab0632dca7a10612e",
          supports:
            "Lake Mead and Lake Powell at record-low conditions; Lower Basin cuts with potential for deeper later reductions",
        },
        {
          institution: "BBC News",
          title:
            "Romania shuts only nuclear plant as heat causes drop in Danube River level",
          date: "August 13–14, 2026 (reviewed August 24, 2026)",
          url: "https://www.bbc.com/news/articles/cqlxpq5q799o",
          supports:
            "European high seasonal water stress continuing to transmit into nuclear cooling, hydro, and Rhine freight; operators adapting",
        },
      ],
    },
    {
      reviewDate: "September 16, 2026",
      evidenceCutoff: LEDGER_EVIDENCE_CUTOFF,
      currentState: GWS_CURRENT_STATE,
      currentDirection: GWS_CURRENT_DIRECTION,
      previousState: "High water stress / Multi-system transmission",
      materialChangeSummary:
        "Colorado remains a severe structural shortage: Reclamation’s September 8 weekly showed Powell about 22% full and Mead about 26%, with system storage near 31%. Upper Basin officials agreed September 15 to continue Flaming Gorge emergency releases to protect Powell. Texas is enforcing data-center water reporting — industrial-use transmission, not a municipal collapse. FAO August Food Price Index 133.3 is a cross-system food signal. Tigris–Euphrates remains the hydrologic counter-signal. Water stays qualitative with no System Temperature weight.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "U.S. Bureau of Reclamation",
          title: "Lower Colorado Weekly Hydrologic Update",
          date: "September 8, 2026 (reviewed September 16, 2026)",
          url: "https://www.usbr.gov/lc/region/g4000/weekly.pdf",
          supports:
            "Lake Powell about 22% full at elevation 3,517.58 feet; Lake Mead about 26% at 1,038.93 feet; Colorado River total system contents about 31% of capacity",
        },
        {
          institution: "The Colorado Sun",
          title:
            "Colorado River officials agree to more emergency water for Powell",
          date: "September 15, 2026",
          url: "https://coloradosun.com/2026/09/15/colorado-river-emergency-release-flaming-gorge-lake-powell/",
          supports:
            "Upper Basin officials agreed to continue Flaming Gorge emergency releases through April to protect Lake Powell — adaptation inside structural shortage, not recovery",
        },
        {
          institution: "Reuters",
          title: "Texas moves to penalize data centers for water violations",
          date: "September 14, 2026 (reviewed September 16, 2026)",
          url: "https://www.reuters.com/legal/litigation/texas-moves-penalize-data-centers-water-violations-2026-09-14/",
          supports:
            "Texas industrial-use water reporting enforcement for data centers; not a statewide municipal tap collapse",
        },
        {
          institution: "FAO",
          title: "Supply concerns drive FAO Food Price Index higher in August",
          date: "September 4, 2026 (reviewed September 16, 2026)",
          url: "https://www.fao.org/newsroom/detail/supply-concerns-drive-fao-food-price-index-higher/en",
          supports:
            "FAO Food Price Index 133.3 in August as a cross-system food/agriculture signal, not a sixth System Temperature weight",
        },
        {
          institution: "Reuters",
          title:
            "World food prices at highest since 2022 as supply risks mount, FAO says",
          date: "September 4, 2026 (reviewed September 16, 2026)",
          url: "https://www.reuters.com/world/europe/world-food-prices-highest-since-2022-supply-risks-mount-fao-says-2026-09-04/",
          supports:
            "FAO index up from 130.8 in July, with weather, Middle East conflict, and Black Sea logistics among pressures",
        },
      ],
    },
  ],
};

export const GWS_SNAPSHOT = latestSnapshot(GWS_SERIES);
