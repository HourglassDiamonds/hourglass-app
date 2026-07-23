/**
 * Timezone helpers for founder cadence (America/New_York) with DST awareness.
 * Internal persisted timestamps remain UTC; local calendar is for evaluation labels/windows.
 */

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
): { date: string; hour: number; offsetMinutes: number } {
  const date = new Date(isoUtc);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
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
    offsetMinutes: timeZoneOffsetMinutes(isoUtc, timeZone),
  };
}
