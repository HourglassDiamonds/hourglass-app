/**
 * Agent OS measurement date windows — America/New_York, completed days only.
 *
 * Does not replace Monday–Sunday UTC week helpers used by the weekly
 * intelligence pipeline (lib/intelligence/week-ranges.ts).
 */

import {
  localCalendarStamp,
  utcIsoForLocalWallTime,
} from "../persistence/timezone";

export const MEASUREMENT_TIMEZONE = "America/New_York" as const;

export type DateRange = {
  start: string; // YYYY-MM-DD
  end: string;
};

export type AgentOsMeasurementWindows = {
  timezone: typeof MEASUREMENT_TIMEZONE;
  /** Most recent fully completed local calendar day. */
  mostRecentCompleteDay: DateRange;
  /** Day immediately before mostRecentCompleteDay. */
  priorCompleteDay: DateRange;
  /** Rolling completed 7-day period ending on mostRecentCompleteDay. */
  rolling7d: DateRange;
  /** Prior comparable 7-day period. */
  prior7d: DateRange;
  /** Optional completed 28-day baseline ending on mostRecentCompleteDay. */
  baseline28d: DateRange;
  /** Local calendar "today" (may be incomplete — never use as a completed window end). */
  localToday: string;
  asOfUtc: string;
};

function addCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid calendar date: ${isoDate}`);
  }
  const utc = Date.UTC(y, m - 1, d + days);
  const next = new Date(utc);
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function singleDay(isoDate: string): DateRange {
  return { start: isoDate, end: isoDate };
}

function inclusiveRangeEnding(end: string, lengthDays: number): DateRange {
  if (lengthDays < 1) {
    throw new Error(`lengthDays must be >= 1, got ${lengthDays}`);
  }
  return {
    start: addCalendarDays(end, -(lengthDays - 1)),
    end,
  };
}

/**
 * Build Agent OS measurement windows from an instant.
 * Uses America/New_York local calendar; excludes the incomplete current local day.
 */
export function getAgentOsMeasurementWindows(
  asOf: Date = new Date(),
  timeZone: typeof MEASUREMENT_TIMEZONE | string = MEASUREMENT_TIMEZONE,
): AgentOsMeasurementWindows {
  const asOfUtc = asOf.toISOString();
  const todayStamp = localCalendarStamp(asOfUtc, timeZone);
  const localToday = todayStamp.date;
  const mostRecentComplete = addCalendarDays(localToday, -1);
  const priorComplete = addCalendarDays(mostRecentComplete, -1);
  const rolling7d = inclusiveRangeEnding(mostRecentComplete, 7);
  const prior7d = inclusiveRangeEnding(addCalendarDays(rolling7d.start, -1), 7);
  const baseline28d = inclusiveRangeEnding(mostRecentComplete, 28);

  return {
    timezone: MEASUREMENT_TIMEZONE,
    mostRecentCompleteDay: singleDay(mostRecentComplete),
    priorCompleteDay: singleDay(priorComplete),
    rolling7d,
    prior7d,
    baseline28d,
    localToday,
    asOfUtc,
  };
}

/**
 * Build comparison windows ending on an explicit newest reliable source date
 * (e.g. Search Console lag). Still completed-day semantics relative to that date.
 */
export function getWindowsEndingOn(
  newestAvailableDate: string,
  timeZone: string = MEASUREMENT_TIMEZONE,
): {
  timezone: string;
  newestAvailableDate: string;
  mostRecentCompleteDay: DateRange;
  priorCompleteDay: DateRange;
  rolling7d: DateRange;
  prior7d: DateRange;
  baseline28d: DateRange;
} {
  const rolling7d = inclusiveRangeEnding(newestAvailableDate, 7);
  const prior7d = inclusiveRangeEnding(addCalendarDays(rolling7d.start, -1), 7);
  return {
    timezone: timeZone,
    newestAvailableDate,
    mostRecentCompleteDay: singleDay(newestAvailableDate),
    priorCompleteDay: singleDay(addCalendarDays(newestAvailableDate, -1)),
    rolling7d,
    prior7d,
    baseline28d: inclusiveRangeEnding(newestAvailableDate, 28),
  };
}

/** Age in whole days between a source date and the most recent complete local day. */
export function sourceAgeDays(
  newestAvailableDate: string,
  asOf: Date = new Date(),
  timeZone: string = MEASUREMENT_TIMEZONE,
): number {
  const windows = getAgentOsMeasurementWindows(asOf, timeZone);
  const newest = parseDateUtcNoon(newestAvailableDate);
  const complete = parseDateUtcNoon(windows.mostRecentCompleteDay.end);
  return Math.round((complete.getTime() - newest.getTime()) / 86_400_000);
}

function parseDateUtcNoon(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12));
}

/**
 * Search Console lag classification by age in days.
 * Typical GSC delay is 2–3 days; treat ≤3 as normal, 4–5 as elevated, ≥6 unusual.
 * Prefer classifyGscSourceLag in gsc-freshness.ts for Agent OS GSC paths.
 */
export function classifyGscLag(ageDays: number | null): {
  lagClassification:
    | "fresh"
    | "normal-delay"
    | "elevated-delay"
    | "unusual-stale"
    | "unknown";
  healthCode: "ok" | "stale-within-normal-delay" | "stale-unusual";
  confidenceMultiplier: number;
} {
  if (ageDays == null || ageDays < 0) {
    return {
      lagClassification: "unknown",
      healthCode: "stale-unusual",
      confidenceMultiplier: 0.55,
    };
  }
  if (ageDays <= 1) {
    return {
      lagClassification: "fresh",
      healthCode: "ok",
      confidenceMultiplier: 1,
    };
  }
  if (ageDays <= 3) {
    return {
      lagClassification: "normal-delay",
      healthCode: "stale-within-normal-delay",
      confidenceMultiplier: 0.92,
    };
  }
  if (ageDays <= 5) {
    return {
      lagClassification: "elevated-delay",
      healthCode: "stale-within-normal-delay",
      confidenceMultiplier: 0.8,
    };
  }
  return {
    lagClassification: "unusual-stale",
    healthCode: "stale-unusual",
    confidenceMultiplier: 0.55,
  };
}

/** True when `candidate` is a completed day strictly before local today. */
export function isCompletedLocalDay(
  candidate: string,
  asOf: Date = new Date(),
  timeZone: string = MEASUREMENT_TIMEZONE,
): boolean {
  const windows = getAgentOsMeasurementWindows(asOf, timeZone);
  return candidate <= windows.mostRecentCompleteDay.end;
}

/**
 * Local midnight UTC instant for a calendar date in the measurement timezone.
 * Useful for DST boundary tests.
 */
export function localMidnightUtcIso(
  localDate: string,
  timeZone: string = MEASUREMENT_TIMEZONE,
): string {
  return utcIsoForLocalWallTime(localDate, 0, 0, timeZone);
}

export { addCalendarDays as shiftCalendarDays };
