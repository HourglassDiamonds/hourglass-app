/**
 * Source-timezone preservation for Calendar evidence.
 * Never consult founder locale, Intl default TZ, or process TZ.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const OFFSET_DATE_TIME =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)(Z|[+-]\d{2}:?\d{2})$/;

export const UTC_TIMEZONE = "UTC" as const;

export type ParsedWallTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

export function parseDateOnly(value: string): ParsedWallTime | null {
  const match = DATE_ONLY.exec(value.trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  };
}

export function parseWallDateTime(value: string): ParsedWallTime | null {
  const match = LOCAL_DATE_TIME.exec(value.trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
    millisecond: Number((match[7] ?? "0").padEnd(3, "0")),
  };
}

function tzOffsetMs(utcMs: number, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utcMs));
    const name = parts.find((part) => part.type === "timeZoneName")?.value;
    if (!name) return null;
    const match = /([+-])(\d{1,2})(?::?(\d{2}))?/.exec(name.replace("GMT", ""));
    if (!match) {
      if (/^(GMT|UTC)$/i.test(name.trim())) return 0;
      return null;
    }
    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number(match[2]);
    const minutes = Number(match[3] ?? 0);
    return sign * (hours * 60 + minutes) * 60_000;
  } catch {
    return null;
  }
}

export function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function zonedWallTimeToUtcIso(
  wall: ParsedWallTime,
  timeZone: string,
): string | null {
  if (!isValidIanaTimeZone(timeZone)) return null;
  const utcGuess = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
    wall.millisecond,
  );
  const first = tzOffsetMs(utcGuess, timeZone);
  if (first == null) return null;
  let utcMs = utcGuess - first;
  const second = tzOffsetMs(utcMs, timeZone);
  if (second == null) return null;
  if (second !== first) utcMs = utcGuess - second;
  return new Date(utcMs).toISOString();
}

export function addCalendarDays(wall: ParsedWallTime, days: number): ParsedWallTime {
  const utc = Date.UTC(wall.year, wall.month - 1, wall.day + days, 0, 0, 0, 0);
  const date = new Date(utc);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  };
}

export function rfc3339ToUtcIso(value: string): string | null {
  const trimmed = value.trim();
  const offset = OFFSET_DATE_TIME.exec(trimmed);
  if (offset) {
    const ms = Date.parse(trimmed);
    if (!Number.isFinite(ms)) return null;
    return new Date(ms).toISOString();
  }
  const ms = Date.parse(trimmed);
  if (Number.isFinite(ms) && /Z|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return new Date(ms).toISOString();
  }
  return null;
}

export function resolveSourceTimeZone(
  eventTimeZone: string | null | undefined,
  calendarTimeZone: string | null | undefined,
): string {
  const event = eventTimeZone?.trim();
  if (event && isValidIanaTimeZone(event)) return event;
  const calendar = calendarTimeZone?.trim();
  if (calendar && isValidIanaTimeZone(calendar)) return calendar;
  return UTC_TIMEZONE;
}

export function googleDateTimeToUtcIso(
  value: {
    date?: string | null;
    dateTime?: string | null;
    timeZone?: string | null;
  } | null | undefined,
  calendarTimeZone: string | null | undefined,
): { iso: string; timezone: string; allDay: boolean } | null {
  if (!value) return null;
  if (value.date) {
    const wall = parseDateOnly(value.date);
    if (!wall) return null;
    const timezone = resolveSourceTimeZone(value.timeZone, calendarTimeZone);
    const iso = zonedWallTimeToUtcIso(wall, timezone);
    if (!iso) return null;
    return { iso, timezone, allDay: true };
  }
  if (!value.dateTime) return null;
  const timezone = resolveSourceTimeZone(value.timeZone, calendarTimeZone);
  const asRfc = rfc3339ToUtcIso(value.dateTime);
  if (asRfc) return { iso: asRfc, timezone, allDay: false };
  const wall = parseWallDateTime(value.dateTime);
  if (!wall) return null;
  const iso = zonedWallTimeToUtcIso(wall, timezone);
  if (!iso) return null;
  return { iso, timezone, allDay: false };
}
