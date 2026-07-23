/**
 * Fixture-only Client Journey observation overlays.
 * Never imported into live observation derivation.
 */

import type { JourneyObservationBundle } from "./types";

/**
 * Synthetic fixture covering required journey scenarios:
 * 1. High-intent search entry with weak observed next-step
 * 2. Guide entry with observed tool movement
 * 3. Tool entry with missing completion measurement
 * 4. Repository tool→conversation without observed transition data (via inventory)
 * 5. Low-sample local journey
 * 6. Healthy observed path
 * 7. Missing conversion source
 * 8. Duplicate symptoms under one root journey problem
 */
export function createFixtureJourneyObservations(
  reportingPeriod: { start: string; end: string },
  collectedAt = "2026-07-20T14:00:00.000Z",
): JourneyObservationBundle {
  return {
    mode: "fixture",
    reportingPeriod,
    pathMeasurementAvailable: true,
    landingPages: [
      // Scenario 1: high entry, weak next-step (see transitions)
      { route: "/engagement-rings", sessions: 220 },
      // Scenario 2: guide → tool observed
      { route: "/diamond-guide/oval-vs-round-diamond", sessions: 160 },
      // Content-to-tool disconnect: high guide entry, weak Studio movement
      { route: "/diamond-guide/carat-weight-explained", sessions: 120 },
      // Scenario 3 / 6: Studio entry
      { route: "/diamond-studio", sessions: 210 },
      // Scenario 5: low-sample local
      {
        route: "/diamond-guide/charlotte-diamond-advisor-guide",
        sessions: 18,
      },
      // Healthy homepage path
      { route: "/", sessions: 480 },
      { route: "/concierge", sessions: 95 },
      { route: "/diamond-shape-studio", sessions: 90 },
      { route: "/whispered-praise", sessions: 12 },
    ],
    transitions: [
      // Scenario 1: weak next-step from engagement-rings
      { fromRoute: "/engagement-rings", toRoute: "/concierge", sessions: 8 },
      { fromRoute: "/engagement-rings", toRoute: "/diamond-studio", sessions: 12 },
      // Scenario 2: guide → tool observed movement
      {
        fromRoute: "/diamond-guide/oval-vs-round-diamond",
        toRoute: "/diamond-studio",
        sessions: 72,
      },
      // Content-to-tool disconnect scenario: high guide entry, weak Studio movement
      {
        fromRoute: "/diamond-guide/carat-weight-explained",
        toRoute: "/diamond-studio",
        sessions: 8,
      },
      // Scenario 6: healthy homepage → commercial / approach
      { fromRoute: "/", toRoute: "/engagement-rings", sessions: 140 },
      { fromRoute: "/", toRoute: "/our-approach", sessions: 85 },
      { fromRoute: "/", toRoute: "/concierge", sessions: 55 },
      // Scenario 6: Studio → Concierge healthy-ish movement
      { fromRoute: "/diamond-studio", toRoute: "/concierge", sessions: 48 },
      // Low-sample local (scenario 5) — tiny movement
      {
        fromRoute: "/diamond-guide/charlotte-diamond-advisor-guide",
        toRoute: "/concierge",
        sessions: 2,
      },
    ],
    channelGroups: [
      { value: "Organic Search", sessions: 620 },
      { value: "Direct", sessions: 510 },
      { value: "Organic Social", sessions: 210 },
      { value: "Referral", sessions: 140 },
    ],
    eventCounts: {
      diamond_studio_view: 390,
      studio_session_engaged: 160,
      consultation_cta_clicked: 42,
      // Conversion events intentionally absent from counts → unknown/not-observed
    },
    queriedEventNames: [
      "diamond_studio_view",
      "studio_session_engaged",
      "consultation_cta_clicked",
      // Queried but not present in counts → not-observed for fixture conversion gap
      "generate_lead",
      "concierge_form_submitted",
      "concierge_form_started",
    ],
    gscTopPages: [
      {
        path: "https://hourglass.example/engagement-rings",
        clicks: 180,
        impressions: 4200,
      },
      {
        path: "https://hourglass.example/diamond-guide/oval-vs-round-diamond",
        clicks: 95,
        impressions: 3100,
      },
    ],
    gscTopQueries: [
      {
        // High-intent custom/local query on weakly aligned homepage — Search handoff
        query: "custom engagement rings charlotte",
        clicks: 64,
        page: "/",
      },
      {
        query: "oval vs round diamond",
        clicks: 88,
        page: "/diamond-guide/oval-vs-round-diamond",
      },
    ],
    ga4Available: true,
    gscAvailable: true,
    collectedAt,
  };
}

/** Low-sample-only overlay for isolated tests. */
export function createLowSampleJourneyObservations(
  reportingPeriod: { start: string; end: string },
): JourneyObservationBundle {
  const base = createFixtureJourneyObservations(reportingPeriod);
  return {
    ...base,
    landingPages: [
      { route: "/diamond-guide/charlotte-engagement-ring-guide", sessions: 9 },
      { route: "/whispered-praise", sessions: 4 },
    ],
    transitions: [
      {
        fromRoute: "/diamond-guide/charlotte-engagement-ring-guide",
        toRoute: "/concierge",
        sessions: 1,
      },
    ],
    eventCounts: {
      diamond_studio_view: 3,
      consultation_cta_clicked: 1,
    },
  };
}
