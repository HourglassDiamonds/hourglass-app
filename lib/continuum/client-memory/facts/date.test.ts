import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  birthdayFromParts,
  formatBirthday,
  isLeapYear,
  parseBirthdayValue,
  upcomingBirthdays,
} from "./date";
import type { BirthdayRead } from "./types";

describe("birthday date contract", () => {
  it("accepts full dates, unknown year, and month-only values", () => {
    assert.deepEqual(birthdayFromParts({ month: 11, day: 12, year: 1985 }).ok ? birthdayFromParts({ month: 11, day: 12, year: 1985 }) : null, {
      ok: true,
      value: { calendar: "gregorian", month: 11, day: 12, year: 1985 },
    });
    assert.deepEqual(parseBirthdayValue({
      calendar: "gregorian",
      month: 11,
      day: 12,
      year: null,
    }), {
      ok: true,
      value: { calendar: "gregorian", month: 11, day: 12, year: null },
    });
    assert.deepEqual(birthdayFromParts({ month: 11 }).ok ? birthdayFromParts({ month: 11, day: null, year: null }) : null, {
      ok: true,
      value: { calendar: "gregorian", month: 11, day: null, year: null },
    });
  });

  it("rejects missing month, invalid months, and impossible days", () => {
    const missing = birthdayFromParts({ month: null });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.reason, "missing-month");
    assert.equal(birthdayFromParts({ month: 0 }).ok, false);
    assert.equal(birthdayFromParts({ month: 13 }).ok, false);
    const april31 = birthdayFromParts({ month: 4, day: 31 });
    assert.equal(april31.ok, false);
    if (!april31.ok) assert.equal(april31.reason, "invalid-day");
  });

  it("handles February 29 leap-year rules", () => {
    assert.equal(isLeapYear(2024), true);
    assert.equal(isLeapYear(2025), false);
    assert.equal(isLeapYear(2000), true);
    assert.equal(isLeapYear(1900), false);
    assert.equal(birthdayFromParts({ month: 2, day: 29 }).ok, true);
    assert.equal(birthdayFromParts({ month: 2, day: 29, year: 2024 }).ok, true);
    assert.equal(birthdayFromParts({ month: 2, day: 29, year: 2025 }).ok, false);
    assert.equal(birthdayFromParts({ month: 2, day: 29, year: 1900 }).ok, false);
  });

  it("rejects unreasonable years and non-gregorian calendars", () => {
    assert.equal(birthdayFromParts({ month: 11, day: 12, year: 1799 }).ok, false);
    assert.equal(birthdayFromParts({ month: 11, day: 12, year: 2101 }).ok, false);
    assert.equal(
      parseBirthdayValue({ calendar: "lunar", month: 11, day: 12, year: null }).ok,
      false,
    );
    assert.equal(parseBirthdayValue("November 12").ok, false);
    assert.equal(parseBirthdayValue({ month: 11 }).ok, false);
  });

  it("formats without inventing age", () => {
    assert.equal(
      formatBirthday({ calendar: "gregorian", month: 11, day: null, year: null }),
      "November",
    );
    assert.equal(
      formatBirthday({ calendar: "gregorian", month: 11, day: 12, year: null }),
      "November 12",
    );
    assert.equal(
      formatBirthday({ calendar: "gregorian", month: 11, day: 12, year: 1985 }),
      "November 12, 1985",
    );
    assert.doesNotMatch(
      formatBirthday({ calendar: "gregorian", month: 11, day: 12, year: null }),
      /age|years old|\d{2} years/i,
    );
  });

  it("computes upcoming recurrence with year wrap and skips unknown days", () => {
    const rows: BirthdayRead[] = [
      {
        factId: "a",
        personId: "1",
        displayName: "Sarah Miller",
        month: 11,
        day: 12,
        year: null,
        verification: "manual",
        sourceSystem: "concierge-manual",
      },
      {
        factId: "b",
        personId: "2",
        displayName: "Month Only",
        month: 11,
        day: null,
        year: null,
        verification: "manual",
        sourceSystem: "concierge-manual",
      },
      {
        factId: "c",
        personId: "3",
        displayName: "Ada Lovelace",
        month: 1,
        day: 2,
        year: 1815,
        verification: "manual",
        sourceSystem: "concierge-manual",
      },
    ];
    const fromNovember = upcomingBirthdays(
      rows,
      new Date("2026-11-01T15:00:00.000Z"),
      "America/New_York",
      30,
    );
    assert.deepEqual(
      fromNovember.map((row) => row.displayName),
      ["Sarah Miller"],
    );
    assert.equal(fromNovember[0]?.daysUntil, 11);
    const fromDecember = upcomingBirthdays(
      rows,
      new Date("2026-12-20T15:00:00.000Z"),
      "America/New_York",
      30,
    );
    assert.deepEqual(
      fromDecember.map((row) => ({ name: row.displayName, days: row.daysUntil })),
      [{ name: "Ada Lovelace", days: 13 }],
    );
  });
});
