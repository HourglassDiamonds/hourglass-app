import type { WeekRange } from "./types";

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Previous complete Mon–Sun week in UTC, relative to `asOf` (defaults to today).
 * Monday cron uses the week that ended last Sunday.
 */
export function getReportWeekRange(asOf: Date = new Date()): WeekRange {
  const cursor = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
  );
  const day = cursor.getUTCDay(); // 0 Sun … 6 Sat
  const daysSinceSunday = day === 0 ? 0 : day;
  const lastSunday = addDays(cursor, -daysSinceSunday);
  const weekEnd = lastSunday;
  const weekStart = addDays(weekEnd, -6);
  return { start: toIsoDate(weekStart), end: toIsoDate(weekEnd) };
}

export function getComparisonWeekRange(week: WeekRange): WeekRange {
  const start = new Date(`${week.start}T00:00:00Z`);
  const end = new Date(`${week.end}T00:00:00Z`);
  return {
    start: toIsoDate(addDays(start, -7)),
    end: toIsoDate(addDays(end, -7)),
  };
}

export function formatWeekLabel(week: WeekRange): string {
  const start = new Date(`${week.start}T12:00:00Z`);
  return start.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
