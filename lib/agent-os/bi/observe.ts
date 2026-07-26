/**
 * Normalize observed analytics for conversion audit.
 * Live: derive only from GA4 bundle (never fixture overlays).
 * Fixture: use dedicated conversion observation fixture.
 */

import type { AgentOsDataBundle } from "../adapters/types";
import type { Ga4WeeklyBundle } from "@/lib/intelligence/types";
import {
  AUTHORITATIVE_CONVERSION_EVENT,
  EXPECTED_EVENT_INVENTORY,
  GA4_ADAPTER_QUERIED_EVENTS,
} from "./expected-events";
import type {
  BiConversionObservationBundle,
  ExpectedEventInventoryItem,
  ObservedStatus,
  SourceMediumRow,
} from "./types";

/** Events fixture mode pretends Agent OS queried (may exceed live allowlist intentionally). */
export const FIXTURE_QUERIED_EVENTS = [
  ...GA4_ADAPTER_QUERIED_EVENTS,
] as const;

/**
 * Fixture observations encoding the Conversion & Measurement audit scenarios:
 * CTA present, submit absent; Studio entry + verified soft-completion;
 * tool→Concierge weak; source/medium fragmentation; small-sample noise;
 * possible CTA regression; healthy Studio progression area.
 */
export function createFixtureConversionObservations(
  reportingPeriod: { start: string; end: string },
  collectedAt = "2026-07-20T14:00:00.000Z",
): BiConversionObservationBundle {
  const comparisonPeriod = {
    start: "2026-07-06",
    end: "2026-07-12",
  };

  return {
    mode: "fixture",
    reportingPeriod,
    comparisonPeriod,
    queriedEventNames: [...FIXTURE_QUERIED_EVENTS],
    eventCounts: {
      diamond_studio_view: { current: 390, previous: 360 },
      shape_selected: { current: 240, previous: 220 },
      carat_changed: { current: 180, previous: 170 },
      studio_session_engaged: { current: 160, previous: 150 },
      // Prior 70 → current 42 (~40% drop) with stable Studio = possible regression
      consultation_cta_clicked: { current: 42, previous: 70 },
      // Tiny decorative-like sample — must not drive drop-off claims
      home_clicked: { current: 2, previous: 3 },
      // Concierge start observed; submit + generate_lead absent from observed set
      concierge_form_started: { current: 48, previous: 52 },
      // Intentionally omitted: concierge_form_submitted, generate_lead
      conversation_related_resource_clicked: { current: 18, previous: 16 },
      conversation_concierge_clicked: { current: 4, previous: 5 },
    },
    channelGroups: [
      { value: "Organic Search", sessions: 620 },
      { value: "Direct", sessions: 510 },
      { value: "Organic Social", sessions: 210 },
      { value: "Referral", sessions: 140 },
    ],
    landingPages: [
      { value: "/", sessions: 480 },
      { value: "/diamond-shape-studio", sessions: 390 },
      { value: "/diamond-guide/oval-vs-round-diamond", sessions: 180 },
      { value: "/concierge", sessions: 95 },
      { value: "/diamond-studio", sessions: 210 },
    ],
    sourceMediumRows: [
      { source: "instagram.com", medium: "referral", sessions: 45 },
      { source: "l.instagram.com", medium: "referral", sessions: 38 },
      { source: "m.instagram.com", medium: "referral", sessions: 32 },
      { source: "instagram", medium: "social", sessions: 28 },
      { source: "(direct)", medium: "(none)", sessions: 510 },
      // Tiny one-off — must not alone trigger anomaly
      { source: "odd-ref.example", medium: "referral", sessions: 3 },
    ],
    ga4Available: true,
    ga4RetrievalState: "fixture",
    collectedAt,
  };
}

export function deriveLiveConversionObservations(
  bundle: AgentOsDataBundle,
  reportingPeriod: { start: string; end: string },
): BiConversionObservationBundle | null {
  const ga4 = bundle.ga4.data;
  if (!ga4 || !bundle.ga4.ok) {
    return null;
  }

  const eventCounts: BiConversionObservationBundle["eventCounts"] = {};
  for (const name of GA4_ADAPTER_QUERIED_EVENTS) {
    const current = ga4.current.studioEvents[name] ?? 0;
    const previous = ga4.previous.studioEvents[name] ?? 0;
    eventCounts[name] = { current, previous };
  }
  // Derived aliases already on the bundle
  eventCounts.consultation_cta_clicked = {
    current: ga4.current.consultationCtaClicks,
    previous: ga4.previous.consultationCtaClicks,
  };
  eventCounts.diamond_studio_view = {
    current: ga4.current.studioViews,
    previous: ga4.previous.studioViews,
  };

  return {
    mode: "live-derived",
    reportingPeriod,
    comparisonPeriod: {
      start: shiftWeek(reportingPeriod.start, -7),
      end: shiftWeek(reportingPeriod.end, -7),
    },
    queriedEventNames: [...GA4_ADAPTER_QUERIED_EVENTS],
    eventCounts,
    channelGroups: ga4.current.sources.map((s) => ({
      value: s.value,
      sessions: s.sessions,
    })),
    landingPages: ga4.current.landingPages.map((p) => ({
      value: p.value,
      sessions: p.sessions,
    })),
    sourceMediumRows: (ga4.current.sourceMediumRows ?? []).map((r) => ({
      source: r.source,
      medium: r.medium,
      sessions: r.sessions,
    })),
    ga4Available: true,
    ga4RetrievalState: bundle.ga4.health.retrievalState,
    collectedAt: ga4.fetchedAt,
  };
}

/**
 * Resolve observation bundle for the current run.
 * Live mode never falls back to fixture conversion overlays.
 */
export function resolveConversionObservations(input: {
  mode: "fixture" | "live";
  bundle: AgentOsDataBundle;
  reportingPeriod: { start: string; end: string };
  fixtureOverlay?: BiConversionObservationBundle | null;
}): BiConversionObservationBundle | null {
  if (input.mode === "fixture") {
    return (
      input.fixtureOverlay ??
      createFixtureConversionObservations(input.reportingPeriod)
    );
  }
  return deriveLiveConversionObservations(input.bundle, input.reportingPeriod);
}

export function buildExpectedEventInventory(
  observations: BiConversionObservationBundle | null,
): ExpectedEventInventoryItem[] {
  return EXPECTED_EVENT_INVENTORY.map((def) => {
    const status = resolveObservedStatus(def.expectedEventName, observations);
    const counts = observations?.eventCounts[def.expectedEventName];
    return {
      ...def,
      observedStatus: status,
      observationPeriod: observations?.reportingPeriod ?? null,
      observationSample: counts?.current ?? null,
      inferenceFlag: false,
      currentCount: counts?.current ?? null,
      previousCount: counts?.previous ?? null,
    };
  });
}

export function resolveObservedStatus(
  eventName: string,
  observations: BiConversionObservationBundle | null,
): ObservedStatus {
  if (!observations) return "unknown";
  const queried = observations.queriedEventNames.includes(eventName);
  if (!queried) return "unknown";
  const counts = observations.eventCounts[eventName];
  if (!counts) return "not-observed";
  if (counts.current > 0) return "observed";
  return "not-observed";
}

export function getEventCount(
  observations: BiConversionObservationBundle | null,
  eventName: string,
): number | null {
  if (!observations) return null;
  if (!observations.queriedEventNames.includes(eventName)) return null;
  return observations.eventCounts[eventName]?.current ?? 0;
}

export function periodsComparable(
  a: { start: string; end: string } | null | undefined,
  b: { start: string; end: string } | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.start === b.start && a.end === b.end;
}

/** Same observation bundle period for both stages — required for drop-off claims. */
export function stagesShareObservationPeriod(
  observations: BiConversionObservationBundle | null,
): boolean {
  return Boolean(observations?.reportingPeriod);
}

export function totalSessions(
  observations: BiConversionObservationBundle | null,
): number {
  if (!observations) return 0;
  return observations.channelGroups.reduce((sum, r) => sum + r.sessions, 0);
}

export function directTrafficShare(
  observations: BiConversionObservationBundle | null,
): number | null {
  if (!observations) return null;
  const total = totalSessions(observations);
  if (total <= 0) return null;
  const direct =
    observations.channelGroups.find((c) =>
      /direct/i.test(c.value),
    )?.sessions ?? 0;
  return direct / total;
}

export function fragmentSourceMediumFamilies(
  rows: SourceMediumRow[],
): Array<{ family: string; variants: SourceMediumRow[]; sessions: number }> {
  const map = new Map<string, SourceMediumRow[]>();
  for (const row of rows) {
    const family = normalizeSourceFamily(row.source);
    const list = map.get(family) ?? [];
    list.push(row);
    map.set(family, list);
  }
  return [...map.entries()]
    .map(([family, variants]) => ({
      family,
      variants,
      sessions: variants.reduce((s, v) => s + v.sessions, 0),
    }))
    .filter((f) => f.variants.length >= 2);
}

function normalizeSourceFamily(source: string): string {
  const s = source.toLowerCase().replace(/^l\.|^m\.|^www\./, "");
  if (s.includes("instagram")) return "instagram";
  if (s.includes("facebook") || s === "fb") return "facebook";
  if (s.includes("linkedin")) return "linkedin";
  return s.split(".")[0] || s;
}

function shiftWeek(isoDate: string, dayDelta: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dayDelta);
  return d.toISOString().slice(0, 10);
}

/** Expose GA4 weekly shape helper for tests without leaking fixture into live. */
export function studioEventsFromGa4(
  ga4: Ga4WeeklyBundle,
): Record<string, number> {
  return { ...ga4.current.studioEvents };
}
