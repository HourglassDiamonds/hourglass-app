/**
 * Date-only calendar values for Open Jobs / CoS.
 * A date-only value is a calendar day, never an instant.
 * Do not use `new Date("YYYY-MM-DD")` — that is UTC midnight, not a day.
 */

export const FOUNDER_BUSINESS_TIME_ZONE = "America/New_York";

export type DateOnly = string;

export type DueRelation = "future" | "today" | "past";

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT_RE = /^(\d{4})-(\d{2})-(\d{2})T/;

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number): number | null {
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  if (month < 1 || month > 12) return null;
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? null;
}

export function dateOnlyFromParts(
  year: number,
  month: number,
  day: number,
): DateOnly | null {
  const max = daysInMonth(year, month);
  if (max == null || day < 1 || day > max) return null;
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

export function parseDateOnlyParts(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = DATE_ONLY_RE.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const encoded = dateOnlyFromParts(year, month, day);
  if (!encoded) return null;
  return { year, month, day };
}

export function isDateOnly(value: string): boolean {
  return parseDateOnlyParts(value) != null;
}

export function dateOnlyFromUtcInstant(iso: string): DateOnly | null {
  const trimmed = iso.trim();
  const match = INSTANT_RE.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return dateOnlyFromParts(year, month, day);
}

/**
 * Accept a founder date-picker value or a stored timestamptz.
 * Date-only stays date-only. Instant storage is decoded by UTC calendar
 * parts because founder YYYY-MM-DD was persisted as that day's UTC midnight.
 */
export function parseDateOnly(raw: string | null | undefined): DateOnly | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  if (DATE_ONLY_RE.test(trimmed)) return parseDateOnlyParts(trimmed) ? trimmed : null;
  return dateOnlyFromUtcInstant(trimmed);
}

export function parseOptionalDateOnly(
  raw: string | null | undefined,
): { ok: true; value: DateOnly | null } | { ok: false } {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return { ok: true, value: null };
  const parsed = parseDateOnly(trimmed);
  if (!parsed) return { ok: false };
  return { ok: true, value: parsed };
}

/**
 * Persist a calendar day on timestamptz without turning it into a local instant.
 * The UTC date of this encoding IS the calendar day. Display must not convert it.
 */
export function encodeDateOnlyForTimestamptz(date: DateOnly): string {
  return `${date}T00:00:00.000Z`;
}

export function decodeStoredDue(value: string | null | undefined): DateOnly | null {
  return parseDateOnly(value);
}

export function civilDateInZone(
  nowIso: string,
  timeZone: string = FOUNDER_BUSINESS_TIME_ZONE,
): DateOnly | null {
  const ms = Date.parse(nowIso);
  if (!Number.isFinite(ms)) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(ms));
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return dateOnlyFromParts(year, month, day);
}

export function compareDateOnly(left: DateOnly, right: DateOnly): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function addCalendarDays(date: DateOnly, days: number): DateOnly | null {
  const parts = parseDateOnlyParts(date);
  if (!parts || !Number.isInteger(days)) return null;
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day + days);
  const next = new Date(utc);
  return dateOnlyFromParts(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
  );
}

export function dueRelation(
  due: DateOnly,
  businessDate: DateOnly,
): DueRelation {
  const cmp = compareDateOnly(due, businessDate);
  if (cmp < 0) return "past";
  if (cmp === 0) return "today";
  return "future";
}

export function daysUntilDue(due: DateOnly, businessDate: DateOnly): number {
  const dueParts = parseDateOnlyParts(due);
  const nowParts = parseDateOnlyParts(businessDate);
  if (!dueParts || !nowParts) return Number.NaN;
  const dueUtc = Date.UTC(dueParts.year, dueParts.month - 1, dueParts.day);
  const nowUtc = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day);
  return Math.round((dueUtc - nowUtc) / 86_400_000);
}

export function formatDateOnlyShort(date: string): string {
  const parts = parseDateOnlyParts(parseDateOnly(date) ?? date);
  if (!parts) return "Due date recorded";
  return `${MONTH_SHORT[parts.month - 1]} ${parts.day}`;
}

export function formatDueTiming(
  due: string | null | undefined,
  nowIso: string,
  timeZone: string = FOUNDER_BUSINESS_TIME_ZONE,
): string {
  if (!due) return "No due date";
  const date = parseDateOnly(due);
  if (!date) return "Due date recorded";
  const today = civilDateInZone(nowIso, timeZone);
  if (!today) return `Due ${formatDateOnlyShort(date)}`;
  const relation = dueRelation(date, today);
  const label = formatDateOnlyShort(date).toUpperCase();
  if (relation === "past") return `PAST DUE · ${label}`;
  if (relation === "today") return `DUE TODAY · ${label}`;
  const until = daysUntilDue(date, today);
  if (until === 1) return `DUE TOMORROW · ${label}`;
  return `DUE ${label}`;
}

export function isPastDueDate(
  due: string | null | undefined,
  nowIso: string,
  timeZone: string = FOUNDER_BUSINESS_TIME_ZONE,
): boolean {
  const date = parseDateOnly(due);
  const today = civilDateInZone(nowIso, timeZone);
  if (!date || !today) return false;
  return dueRelation(date, today) === "past";
}

export function isDueSoonDate(
  due: string | null | undefined,
  nowIso: string,
  days = 7,
  timeZone: string = FOUNDER_BUSINESS_TIME_ZONE,
): boolean {
  const date = parseDateOnly(due);
  const today = civilDateInZone(nowIso, timeZone);
  if (!date || !today) return false;
  const until = daysUntilDue(date, today);
  return until >= 0 && until <= days;
}
