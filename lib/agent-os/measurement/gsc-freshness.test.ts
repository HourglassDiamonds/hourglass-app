import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractFirstIncompleteDate,
  GSC_FALLBACK_INCOMPLETE_LAG_DAYS,
  GSC_SOURCE_TIMEZONE,
  mapDateDimensionRows,
  resolveGscFreshnessBoundary,
} from "./gsc-freshness";
import {
  getAgentOsMeasurementWindows,
  localMidnightUtcIso,
  shiftCalendarDays,
} from "./date-windows";
import { founderLabelForHealthCode } from "./health-codes";

describe("GSC freshness boundary (Pacific + first_incomplete_date)", () => {
  // Fixed asOf: 2026-07-26 20:00 UTC = 13:00 PDT → Pacific today 2026-07-26
  // most recent complete Pacific day = 2026-07-25
  const asOf = new Date("2026-07-26T20:00:00.000Z");

  it("uses first_incomplete_date when present", () => {
    const boundary = resolveGscFreshnessBoundary({
      asOf,
      firstIncompleteDate: "2026-07-24",
      rows: [
        { date: "2026-07-23", impressions: 100, clicks: 5 },
        { date: "2026-07-22", impressions: 90, clicks: 4 },
      ],
    });
    assert.equal(boundary.boundarySource, "metadata");
    assert.equal(boundary.firstIncompleteDate, "2026-07-24");
    assert.equal(boundary.newestFinalizedDate, "2026-07-23");
    assert.equal(boundary.newestObservedActivityDate, "2026-07-23");
    assert.equal(boundary.sourceTimezone, GSC_SOURCE_TIMEZONE);
    assert.equal(boundary.ageDays, 2); // 07-25 complete − 07-23 finalized
    assert.equal(boundary.lagClassification, "normal-delay");
  });

  it("uses conservative fallback when first_incomplete_date absent", () => {
    const boundary = resolveGscFreshnessBoundary({
      asOf,
      firstIncompleteDate: null,
      rows: [{ date: "2026-07-20", impressions: 50, clicks: 2 }],
    });
    assert.equal(boundary.boundarySource, "conservative-fallback");
    const pacific = getAgentOsMeasurementWindows(asOf, GSC_SOURCE_TIMEZONE);
    const expectedFinalized = shiftCalendarDays(
      pacific.mostRecentCompleteDay.end,
      -GSC_FALLBACK_INCOMPLETE_LAG_DAYS,
    );
    assert.equal(boundary.newestFinalizedDate, expectedFinalized);
    assert.equal(
      boundary.firstIncompleteDate,
      shiftCalendarDays(expectedFinalized, 1),
    );
    assert.equal(boundary.newestObservedActivityDate, "2026-07-20");
  });

  it("finalized data through a recent date with normal processing delay", () => {
    const boundary = resolveGscFreshnessBoundary({
      asOf,
      firstIncompleteDate: "2026-07-24",
      rows: [{ date: "2026-07-23", impressions: 10, clicks: 1 }],
    });
    assert.equal(boundary.newestFinalizedDate, "2026-07-23");
    assert.equal(boundary.lagClassification, "normal-delay");
    assert.equal(boundary.healthCode, "stale-within-normal-delay");
  });

  it("allows no rows on the newest finalized day (zero traffic ≠ missing data)", () => {
    const boundary = resolveGscFreshnessBoundary({
      asOf,
      firstIncompleteDate: "2026-07-24",
      // Activity only on older days — finalized day 07-23 has no row (API omits zeros)
      rows: [
        { date: "2026-07-21", impressions: 40, clicks: 2 },
        { date: "2026-07-20", impressions: 30, clicks: 1 },
      ],
    });
    assert.equal(boundary.newestFinalizedDate, "2026-07-23");
    assert.equal(boundary.newestObservedActivityDate, "2026-07-21");
    assert.ok(
      boundary.newestObservedActivityDate! < boundary.newestFinalizedDate!,
    );
    assert.notEqual(boundary.lagClassification, "unusual-stale");
  });

  it("handles several zero-traffic days via omitted rows", () => {
    const boundary = resolveGscFreshnessBoundary({
      asOf,
      firstIncompleteDate: "2026-07-25",
      rows: [
        // Gap 07-22..07-24 omitted (zero traffic) — still finalized through 07-24
        { date: "2026-07-21", impressions: 12, clicks: 0 },
        { date: "2026-07-18", impressions: 8, clicks: 1 },
      ],
    });
    assert.equal(boundary.newestFinalizedDate, "2026-07-24");
    assert.equal(boundary.newestObservedActivityDate, "2026-07-21");
    // age = 07-25 − 07-24 = 1 → fresh
    assert.equal(boundary.ageDays, 1);
    assert.equal(boundary.lagClassification, "fresh");
  });

  it("newest observed older than newest finalized does not invent outage", () => {
    const boundary = resolveGscFreshnessBoundary({
      asOf,
      firstIncompleteDate: "2026-07-24",
      rows: [{ date: "2026-07-10", impressions: 5, clicks: 1 }],
    });
    assert.equal(boundary.newestFinalizedDate, "2026-07-23");
    assert.equal(boundary.newestObservedActivityDate, "2026-07-10");
    assert.equal(boundary.lagClassification, "normal-delay");
    const label = founderLabelForHealthCode(
      "gsc",
      boundary.healthCode,
      {
        newestAvailableDate: boundary.newestFinalizedDate,
        ageDays: boundary.ageDays,
      },
    );
    assert.doesNotMatch(label, /unavailable|authentication|access denied/i);
  });

  it("flags unusually stale finalized boundary", () => {
    const boundary = resolveGscFreshnessBoundary({
      asOf,
      firstIncompleteDate: "2026-07-18",
      rows: [{ date: "2026-07-17", impressions: 100, clicks: 10 }],
    });
    assert.equal(boundary.newestFinalizedDate, "2026-07-17");
    assert.equal(boundary.ageDays, 8);
    assert.equal(boundary.lagClassification, "unusual-stale");
  });

  it("extracts first_incomplete_date from snake_case or camelCase metadata", () => {
    assert.equal(
      extractFirstIncompleteDate({ first_incomplete_date: "2026-07-24" }),
      "2026-07-24",
    );
    assert.equal(
      extractFirstIncompleteDate({ firstIncompleteDate: "2026-07-24" }),
      "2026-07-24",
    );
    assert.equal(extractFirstIncompleteDate({}), null);
    assert.equal(
      extractFirstIncompleteDate({ first_incomplete_date: "not-a-date" }),
      null,
    );
  });

  it("maps date dimension rows and ignores invalid keys", () => {
    const rows = mapDateDimensionRows([
      { keys: ["2026-07-23"], impressions: 1, clicks: 0 },
      { keys: ["bad"], impressions: 9, clicks: 9 },
      { keys: [], impressions: 1, clicks: 1 },
    ]);
    assert.deepEqual(rows, [
      { date: "2026-07-23", impressions: 1, clicks: 0 },
    ]);
  });

  it("Pacific vs Eastern calendar boundary near midnight", () => {
    // 2026-07-27 03:30 UTC = 2026-07-26 20:30 PDT / 2026-07-26 23:30 EDT
    // → Pacific today 07-26, ET today 07-26
    const near = new Date("2026-07-27T03:30:00.000Z");
    const pacific = getAgentOsMeasurementWindows(near, GSC_SOURCE_TIMEZONE);
    const eastern = getAgentOsMeasurementWindows(near, "America/New_York");
    assert.equal(pacific.localToday, "2026-07-26");
    assert.equal(eastern.localToday, "2026-07-26");

    // 2026-07-27 05:30 UTC = 2026-07-26 22:30 PDT / 2026-07-27 01:30 EDT
    // → Pacific still 07-26; Eastern already 07-27
    const crossed = new Date("2026-07-27T05:30:00.000Z");
    const p2 = getAgentOsMeasurementWindows(crossed, GSC_SOURCE_TIMEZONE);
    const e2 = getAgentOsMeasurementWindows(crossed, "America/New_York");
    assert.equal(p2.localToday, "2026-07-26");
    assert.equal(e2.localToday, "2026-07-27");
    assert.notEqual(p2.mostRecentCompleteDay.end, e2.mostRecentCompleteDay.end);
  });

  it("handles Pacific DST spring forward for complete-day windows", () => {
    // After Pacific spring forward 2026-03-08
    const asOfDst = new Date("2026-03-09T20:00:00.000Z");
    const pacific = getAgentOsMeasurementWindows(asOfDst, GSC_SOURCE_TIMEZONE);
    assert.equal(pacific.localToday, "2026-03-09");
    assert.equal(pacific.mostRecentCompleteDay.end, "2026-03-08");
    const midnight = localMidnightUtcIso("2026-03-09", GSC_SOURCE_TIMEZONE);
    assert.ok(Number.isFinite(Date.parse(midnight)));
  });

  it("does not emit false outage label for zero-traffic finalized quiet period", () => {
    const boundary = resolveGscFreshnessBoundary({
      asOf,
      firstIncompleteDate: "2026-07-24",
      rows: [], // no observed activity in lookback
    });
    assert.equal(boundary.newestFinalizedDate, "2026-07-23");
    assert.equal(boundary.newestObservedActivityDate, null);
    assert.equal(boundary.lagClassification, "normal-delay");
    const label = founderLabelForHealthCode("gsc", boundary.healthCode, {
      newestAvailableDate: boundary.newestFinalizedDate,
      ageDays: boundary.ageDays,
    });
    assert.match(label, /finalized|processing delay|expected/i);
    assert.doesNotMatch(label, /unavailable|authentication failed|access denied/i);
  });
});
