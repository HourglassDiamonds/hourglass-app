/**
 * Resolve Client Journey observations.
 * Live: GA4 landing pages + allowlisted events only — never fixture overlays.
 * Fixture: dedicated journey observation fixture (may include path transitions).
 */

import type { AgentOsDataBundle } from "../../adapters/types";
import { GA4_ADAPTER_QUERIED_EVENTS } from "../expected-events";
import { createFixtureJourneyObservations } from "./fixtures";
import { normalizeRoute } from "./inventory";
import type { JourneyObservationBundle } from "./types";

/**
 * Live mode never falls back to fixture journey data.
 */
export function resolveJourneyObservations(input: {
  mode: "fixture" | "live";
  bundle: AgentOsDataBundle;
  reportingPeriod: { start: string; end: string };
  fixtureOverlay?: JourneyObservationBundle | null;
}): JourneyObservationBundle | null {
  if (input.mode === "live" && input.fixtureOverlay) {
    throw new Error("Live journey analysis refused fixture observation overlay");
  }

  if (input.mode === "fixture") {
    return (
      input.fixtureOverlay ??
      createFixtureJourneyObservations(input.reportingPeriod)
    );
  }

  return deriveLiveJourneyObservations(input.bundle, input.reportingPeriod);
}

export function deriveLiveJourneyObservations(
  bundle: AgentOsDataBundle,
  reportingPeriod: { start: string; end: string },
): JourneyObservationBundle | null {
  const ga4 = bundle.ga4.data;
  if (!ga4 || !bundle.ga4.ok) {
    return null;
  }

  const eventCounts: Record<string, number> = {};
  for (const name of GA4_ADAPTER_QUERIED_EVENTS) {
    eventCounts[name] = ga4.current.studioEvents[name] ?? 0;
  }
  eventCounts.consultation_cta_clicked = ga4.current.consultationCtaClicks;
  eventCounts.diamond_studio_view = ga4.current.studioViews;

  const gsc = bundle.gsc.data;
  const gscOk = Boolean(bundle.gsc.ok && gsc?.current);

  return {
    mode: "live-derived",
    reportingPeriod,
    // Live GA4 weekly adapter does not expose path-level next-page transitions.
    pathMeasurementAvailable: false,
    transitions: [],
    landingPages: ga4.current.landingPages.map((p) => ({
      route: normalizeRoute(p.value),
      sessions: p.sessions,
    })),
    channelGroups: ga4.current.sources.map((s) => ({
      value: s.value,
      sessions: s.sessions,
    })),
    eventCounts,
    queriedEventNames: [...GA4_ADAPTER_QUERIED_EVENTS],
    gscTopPages: gscOk
      ? (gsc?.current?.topPages ?? []).map((p) => ({
          path: p.page,
          clicks: p.clicks,
          impressions: p.impressions,
        }))
      : [],
    gscTopQueries: gscOk
      ? (gsc?.current?.topQueries ?? []).map((q) => ({
          query: q.query,
          clicks: q.clicks,
        }))
      : [],
    ga4Available: true,
    gscAvailable: gscOk,
    collectedAt: ga4.fetchedAt,
  };
}

export function landingSessions(
  observations: JourneyObservationBundle | null,
  route: string,
): number {
  if (!observations) return 0;
  const normalized = normalizeRoute(route);
  return observations.landingPages
    .filter(
      (p) =>
        p.route === normalized ||
        (normalized !== "/" && p.route.startsWith(normalized)),
    )
    .reduce((sum, p) => sum + p.sessions, 0);
}

export function totalLandingSessions(
  observations: JourneyObservationBundle | null,
): number {
  if (!observations) return 0;
  return observations.landingPages.reduce((sum, p) => sum + p.sessions, 0);
}

export function observedTransitionSessions(
  observations: JourneyObservationBundle | null,
  fromRoute: string,
  toRoute?: string,
): number {
  if (!observations?.pathMeasurementAvailable) return 0;
  const from = normalizeRoute(fromRoute);
  const to = toRoute ? normalizeRoute(toRoute) : null;
  return observations.transitions
    .filter((t) => {
      const tf = normalizeRoute(t.fromRoute);
      const matchesFrom =
        tf === from || (from !== "/" && tf.startsWith(from));
      if (!matchesFrom) return false;
      if (!to) return true;
      return normalizeRoute(t.toRoute) === to;
    })
    .reduce((sum, t) => sum + t.sessions, 0);
}

export function getQueriedEventCount(
  observations: JourneyObservationBundle | null,
  eventName: string,
): number | null {
  if (!observations) return null;
  if (!observations.queriedEventNames.includes(eventName)) return null;
  return observations.eventCounts[eventName] ?? 0;
}
