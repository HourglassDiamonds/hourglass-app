import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { founderLocalDate } from "./time";
import { briefIdForLocalDate } from "./ids";

describe("Chief of Staff founder local date / DST", () => {
  it("uses America/New_York civil date, not UTC calendar date", () => {
    const utcDateIsMarch8 = new Date("2026-03-08T04:00:00.000Z");
    assert.equal(utcDateIsMarch8.toISOString().slice(0, 10), "2026-03-08");
    assert.equal(founderLocalDate(utcDateIsMarch8), "2026-03-07");
    assert.equal(
      briefIdForLocalDate(founderLocalDate(utcDateIsMarch8)),
      briefIdForLocalDate("2026-03-07"),
    );
  });

  it("keeps one local morning across the spring DST jump", () => {
    const beforeSpringForward = new Date("2026-03-08T06:30:00.000Z");
    const afterSpringForward = new Date("2026-03-08T07:30:00.000Z");
    assert.equal(founderLocalDate(beforeSpringForward), "2026-03-08");
    assert.equal(founderLocalDate(afterSpringForward), "2026-03-08");
  });

  it("keeps one local morning across the fall DST fallback", () => {
    const beforeFallback = new Date("2026-11-01T05:30:00.000Z");
    const afterFallback = new Date("2026-11-01T06:30:00.000Z");
    assert.equal(founderLocalDate(beforeFallback), "2026-11-01");
    assert.equal(founderLocalDate(afterFallback), "2026-11-01");
  });

  it("does not mint a second date across local midnight", () => {
    const justBeforeMidnight = new Date("2026-08-25T03:59:59.000Z");
    const justAfterMidnight = new Date("2026-08-25T04:00:00.000Z");
    assert.equal(founderLocalDate(justBeforeMidnight), "2026-08-24");
    assert.equal(founderLocalDate(justAfterMidnight), "2026-08-25");
    assert.notEqual(
      briefIdForLocalDate(founderLocalDate(justBeforeMidnight)),
      briefIdForLocalDate(founderLocalDate(justAfterMidnight)),
    );
  });
});
