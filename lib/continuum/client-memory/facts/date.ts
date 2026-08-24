/**
 * Pure Gregorian birthday validation, formatting, and recurrence.
 * Birthdays are calendar dates, never timestamps.
 */

import {
  BIRTHDAY_CALENDAR_GREGORIAN,
  BIRTHDAY_YEAR_MAX,
  BIRTHDAY_YEAR_MIN,
  MONTH_NAMES,
  type BirthdayParseResult,
  type BirthdayRead,
  type BirthdayValue,
} from "./types";

export function isLeapYear(year: number): boolean {
  if (!Number.isInteger(year)) return false;
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(month: number, year: number | null): number | null {
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (month === 2) {
    if (year == null) return 29;
    if (!Number.isInteger(year)) return null;
    return isLeapYear(year) ? 29 : 28;
  }
  return [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? null;
}

function asInteger(value: unknown): number | null | undefined {
  if (value == null) return null;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return undefined;
}

export function parseBirthdayValue(raw: unknown): BirthdayParseResult {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "invalid-shape" };
  }
  const record = raw as Record<string, unknown>;
  if (record.calendar !== BIRTHDAY_CALENDAR_GREGORIAN) {
    return { ok: false, reason: "invalid-calendar" };
  }

  const month = asInteger(record.month);
  if (month === undefined) return { ok: false, reason: "invalid-month" };
  if (month == null) return { ok: false, reason: "missing-month" };
  if (month < 1 || month > 12) return { ok: false, reason: "invalid-month" };

  const dayRaw = asInteger(record.day);
  if (dayRaw === undefined) return { ok: false, reason: "invalid-day" };
  const yearRaw = asInteger(record.year);
  if (yearRaw === undefined) return { ok: false, reason: "invalid-year" };

  if (yearRaw != null && (yearRaw < BIRTHDAY_YEAR_MIN || yearRaw > BIRTHDAY_YEAR_MAX)) {
    return { ok: false, reason: "invalid-year" };
  }

  const maxDay = daysInMonth(month, yearRaw);
  if (maxDay == null) return { ok: false, reason: "invalid-month" };
  if (dayRaw != null && (dayRaw < 1 || dayRaw > maxDay)) {
    return { ok: false, reason: "invalid-day" };
  }

  return {
    ok: true,
    value: {
      calendar: BIRTHDAY_CALENDAR_GREGORIAN,
      month,
      day: dayRaw,
      year: yearRaw,
    },
  };
}

export function birthdayFromParts(input: {
  month: unknown;
  day?: unknown;
  year?: unknown;
}): BirthdayParseResult {
  return parseBirthdayValue({
    calendar: BIRTHDAY_CALENDAR_GREGORIAN,
    month: input.month,
    day: input.day ?? null,
    year: input.year ?? null,
  });
}

export function birthdayValuesEqual(a: BirthdayValue, b: BirthdayValue): boolean {
  return a.calendar === b.calendar && a.month === b.month && a.day === b.day && a.year === b.year;
}

export function formatBirthday(value: BirthdayValue): string {
  const monthName = MONTH_NAMES[value.month - 1];
  if (value.day == null && value.year == null) return monthName;
  if (value.day == null) return `${monthName} ${value.year}`;
  if (value.year == null) return `${monthName} ${value.day}`;
  return `${monthName} ${value.day}, ${value.year}`;
}

export function civilDateInTimeZone(
  now: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return { year, month, day };
}

function utcDayNumber(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function dateExists(year: number, month: number, day: number): boolean {
  const max = daysInMonth(month, year);
  return max != null && day >= 1 && day <= max;
}

function nextBirthdayYear(
  month: number,
  day: number,
  from: { year: number; month: number; day: number },
): number {
  let year =
    month > from.month || (month === from.month && day >= from.day)
      ? from.year
      : from.year + 1;
  while (!dateExists(year, month, day)) {
    year += 1;
  }
  return year;
}

export type UpcomingBirthday = BirthdayRead & { daysUntil: number };

export function upcomingBirthdays(
  birthdays: BirthdayRead[],
  now: Date,
  timeZone: string,
  days: number,
): UpcomingBirthday[] {
  if (!Number.isInteger(days) || days < 0) return [];
  const from = civilDateInTimeZone(now, timeZone);
  const todayNumber = utcDayNumber(from.year, from.month, from.day);
  const out: UpcomingBirthday[] = [];
  for (const row of birthdays) {
    if (row.day == null) continue;
    const year = nextBirthdayYear(row.month, row.day, from);
    const daysUntil = utcDayNumber(year, row.month, row.day) - todayNumber;
    if (daysUntil < 0 || daysUntil > days) continue;
    out.push({ ...row, daysUntil });
  }
  out.sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
    return a.displayName.localeCompare(b.displayName);
  });
  return out;
}
