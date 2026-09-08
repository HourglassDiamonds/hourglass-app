import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addCalendarDays,
  civilDateInZone,
  decodeStoredDue,
  dueRelation,
  encodeDateOnlyForTimestamptz,
  formatDueTiming,
  isDueSoonDate,
  isPastDueDate,
  parseDateOnly,
} from "./date-only";

describe("date-only Open Job semantics", () => {
  it("roundtrips YYYY-MM-DD without shifting the calendar day", () => {
    assert.equal(parseDateOnly("2026-09-08"), "2026-09-08");
    assert.equal(decodeStoredDue("2026-09-08T00:00:00.000Z"), "2026-09-08");
    assert.equal(encodeDateOnlyForTimestamptz("2026-09-08"), "2026-09-08T00:00:00.000Z");
    assert.equal(parseDateOnly(encodeDateOnlyForTimestamptz("2026-09-08")), "2026-09-08");
  });

  it("does not treat UTC midnight of Sep 8 as Sep 7 for an EDT founder", () => {
    const stored = "2026-09-08T00:00:00.000Z";
    assert.equal(decodeStoredDue(stored), "2026-09-08");
    assert.equal(
      formatDueTiming(stored, "2026-09-08T04:00:00.000Z", "America/New_York"),
      "DUE TODAY · SEP 8",
    );
    assert.notEqual(
      formatDueTiming(stored, "2026-09-08T04:00:00.000Z", "America/New_York"),
      "PAST DUE · SEP 7",
    );
  });

  it("classifies Sep 8 as future / today / past across the founder calendar", () => {
    const due = "2026-09-08";
    assert.equal(dueRelation(due, "2026-09-07"), "future");
    assert.equal(dueRelation(due, "2026-09-08"), "today");
    assert.equal(dueRelation(due, "2026-09-09"), "past");
    assert.equal(isPastDueDate(due, "2026-09-07T16:00:00.000Z"), false);
    assert.equal(isPastDueDate(due, "2026-09-08T16:00:00.000Z"), false);
    assert.equal(isPastDueDate(due, "2026-09-09T04:00:00.000Z"), true);
  });

  it("stays due throughout Sep 8 at 00:01 and 23:59 local, including UTC server clock", () => {
    const due = "2026-09-08";
    assert.equal(
      formatDueTiming(due, "2026-09-08T04:01:00.000Z", "America/New_York"),
      "DUE TODAY · SEP 8",
    );
    assert.equal(
      formatDueTiming(due, "2026-09-09T03:59:00.000Z", "America/New_York"),
      "DUE TODAY · SEP 8",
    );
    assert.equal(
      formatDueTiming(due, "2026-09-08T00:01:00.000Z", "UTC"),
      "DUE TODAY · SEP 8",
    );
    assert.equal(
      formatDueTiming(due, "2026-09-08T23:59:00.000Z", "UTC"),
      "DUE TODAY · SEP 8",
    );
  });

  it("does not go past due on Sep 7 evening in America/New_York", () => {
    assert.equal(
      formatDueTiming("2026-09-08", "2026-09-08T03:59:00.000Z", "America/New_York"),
      "DUE TOMORROW · SEP 8",
    );
    assert.equal(isPastDueDate("2026-09-08", "2026-09-08T03:59:00.000Z"), false);
  });

  it("keeps DST spring-forward and fall-back on the intended calendar day", () => {
    assert.equal(
      civilDateInZone("2026-03-08T07:00:00.000Z", "America/New_York"),
      "2026-03-08",
    );
    assert.equal(
      civilDateInZone("2026-11-01T06:00:00.000Z", "America/New_York"),
      "2026-11-01",
    );
    assert.equal(
      formatDueTiming("2026-03-08", "2026-03-08T07:00:00.000Z"),
      "DUE TODAY · MAR 8",
    );
    assert.equal(
      formatDueTiming("2026-11-01", "2026-11-01T06:00:00.000Z"),
      "DUE TODAY · NOV 1",
    );
  });

  it("treats due-soon as calendar days, not UTC midnight instants", () => {
    assert.equal(isDueSoonDate("2026-09-14", "2026-09-08T16:00:00.000Z"), true);
    assert.equal(isDueSoonDate("2026-09-16", "2026-09-08T16:00:00.000Z"), false);
    assert.equal(isDueSoonDate("2026-09-07", "2026-09-08T16:00:00.000Z"), false);
    assert.equal(addCalendarDays("2026-09-08", 1), "2026-09-09");
  });
});
