/**
 * Timezone helpers for founder cadence (America/New_York) with DST awareness.
 * Internal persisted timestamps remain UTC; local calendar is for evaluation labels/windows.
 */

export type LocalCalendarStamp = {
  date: string;
  hour: number;
  minute: number;
  second: number;
  offsetMinutes: number;
};

/**
 * Offset of `timeZone` from UTC at the given instant, in minutes
 * (e.g. America/New_York ≈ -300 in EST, -240 in EDT).
 */
export function timeZoneOffsetMinutes(
  isoUtc: string,
  timeZone: string,
): number {
  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO timestamp: ${isoUtc}`);
  }
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

export function localCalendarStamp(
  isoUtc: string,
  timeZone: string,
): LocalCalendarStamp {
  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO timestamp: ${isoUtc}`);
  }
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    offsetMinutes: timeZoneOffsetMinutes(isoUtc, timeZone),
  };
}

/**
 * ISO weekday from a YYYY-MM-DD calendar date (1=Monday … 7=Sunday).
 * Uses UTC noon of that date so DST does not shift the weekday.
 */
export function founderLocalIsoWeekday(localDate: string): number {
  const [y, m, d] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

/** Minutes since local midnight for a stamp. */
export function localMinutesSinceMidnight(stamp: {
  hour: number;
  minute: number;
}): number {
  return stamp.hour * 60 + stamp.minute;
}

/**
 * True when the founder-local wall clock is at or after hour:minute
 * on the calendar day of `isoUtc` in `timeZone`.
 */
export function isAtOrAfterLocalTime(
  isoUtc: string,
  timeZone: string,
  hour: number,
  minute: number,
): boolean {
  const stamp = localCalendarStamp(isoUtc, timeZone);
  return (
    localMinutesSinceMidnight(stamp) >= hour * 60 + minute
  );
}

/**
 * Convert a founder-local wall time on a YYYY-MM-DD calendar date to a UTC ISO
 * instant. Iteratively applies the DST-aware offset (not a fixed UTC hour).
 */
export function utcIsoForLocalWallTime(
  localDate: string,
  hour: number,
  minute: number,
  timeZone: string,
): string {
  const [y, m, d] = localDate.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid local date: ${localDate}`);
  }
  const localAsUtcMs = Date.UTC(y, m - 1, d, hour, minute, 0);
  let guess = localAsUtcMs;
  for (let i = 0; i < 4; i++) {
    const offsetMin = timeZoneOffsetMinutes(
      new Date(guess).toISOString(),
      timeZone,
    );
    guess = localAsUtcMs - offsetMin * 60_000;
  }
  // Verify / nudge if Intl rounds oddly near transitions
  for (let i = 0; i < 3; i++) {
    const stamp = localCalendarStamp(new Date(guess).toISOString(), timeZone);
    const wanted = hour * 60 + minute;
    const got = localMinutesSinceMidnight(stamp);
    let dayDelta = 0;
    if (stamp.date < localDate) dayDelta = 1;
    else if (stamp.date > localDate) dayDelta = -1;
    const deltaMin = dayDelta * 1440 + (wanted - got);
    if (deltaMin === 0 && stamp.date === localDate) break;
    guess += deltaMin * 60_000;
  }
  return new Date(guess).toISOString();
}
