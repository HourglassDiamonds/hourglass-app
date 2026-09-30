import type { AttentionMetadataV1, AttentionTimingPrecision } from "./types";

export const FOUNDER_DEFAULT_TIMEZONE = "America/New_York";

type BaseTimeInput = {
  timezone?: string | null;
  originalWording: string;
  referenceInstant: string;
  referenceKind?: "capture" | "source";
  offset?: string | null;
};

export type AttentionTimeInput = BaseTimeInput & (
  | { kind: "date-only"; localDate: string }
  | { kind: "local-date-time"; localDateTime: string }
  | { kind: "tomorrow"; localTime?: string | null }
  | { kind: "calendar-days"; amount: number; localTime?: string | null }
  | { kind: "duration-hours"; amount: number }
  | { kind: "business-days"; amount: number; localTime?: string | null }
  | { kind: "vendor-window" }
);

export type AttentionTimeFailure = {
  ok: false;
  reason: "invalid-reference-instant" | "invalid-timezone" | "invalid-local-date-time" |
    "nonexistent-local-time" | "ambiguous-local-time" | "timezone-offset-mismatch" |
    "ambiguous-meridiem" | "invalid-amount" | "invalid-original-wording" |
    "advisory-window-requires-checkpoint";
};
export type AttentionTimeProposal = { ok: true; instant: string; localDateTime: string;
  metadata: AttentionMetadataV1; requiresConfirmation: boolean };
type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function timezoneValid(timezone: string): boolean {
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(0); return true; }
  catch { return false; }
}
function partsAt(ms: number, timezone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(ms);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}
function sameParts(a: LocalParts, b: LocalParts): boolean { return Object.keys(a).every((key) => a[key as keyof LocalParts] === b[key as keyof LocalParts]); }
function pad(value: number): string { return String(value).padStart(2, "0"); }
function localText(p: LocalParts): string { return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`; }
function parseDate(value: string, reference: LocalParts): { parts: LocalParts; missingYear: boolean } | null {
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); const missing = /^(\d{2})-(\d{2})$/.exec(value);
  const year = full ? Number(full[1]) : missing ? reference.year : NaN;
  const month = Number(full?.[2] ?? missing?.[1]); const day = Number(full?.[3] ?? missing?.[2]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (!Number.isInteger(year) || check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { parts: { year, month, day, hour: 0, minute: 0, second: 0 }, missingYear: Boolean(missing) };
}
function parseLocalDateTime(value: string): LocalParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value); if (!match) return null;
  const parts = { year: +match[1], month: +match[2], day: +match[3], hour: +match[4], minute: +match[5], second: +(match[6] ?? 0) };
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  if (parts.hour > 23 || parts.minute > 59 || parts.second > 59 || date.getUTCFullYear() !== parts.year ||
      date.getUTCMonth() !== parts.month - 1 || date.getUTCDate() !== parts.day) return null;
  return parts;
}
function parseClock(value: string | null | undefined): { hour: number; minute: number } | "ambiguous" | null {
  if (!value) return { hour: 0, minute: 0 }; if (/^\d{1,2}$/.test(value.trim())) return "ambiguous";
  const twelve = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i.exec(value.trim());
  if (twelve) { let hour = +twelve[1]; const minute = +(twelve[2] ?? 0); if (hour < 1 || hour > 12 || minute > 59) return null;
    hour = hour % 12 + (twelve[3].toLowerCase() === "pm" ? 12 : 0); return { hour, minute }; }
  const twentyFour = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!twentyFour || +twentyFour[1] > 23 || +twentyFour[2] > 59) return null;
  return { hour: +twentyFour[1], minute: +twentyFour[2] };
}
function offsetMinutes(value: string): number | null { const match = /^([+-])(\d{2}):(\d{2})$/.exec(value);
  if (!match || +match[2] > 23 || +match[3] > 59) return null;
  return (match[1] === "-" ? -1 : 1) * (+match[2] * 60 + +match[3]); }
function possibleInstants(local: LocalParts, timezone: string): Array<{ ms: number; offset: number }> {
  const wall = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second); const offsets = new Set<number>();
  for (let delta = -36; delta <= 36; delta += 3) { const sample = wall + delta * 3_600_000; const shown = partsAt(sample, timezone);
    offsets.add(Math.round((Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second) - sample) / 60_000)); }
  return [...offsets].map((offset) => ({ ms: wall - offset * 60_000, offset }))
    .filter((candidate) => sameParts(partsAt(candidate.ms, timezone), local))
    .filter((candidate, index, all) => all.findIndex((other) => other.ms === candidate.ms) === index).sort((a, b) => a.ms - b.ms);
}
function addCivilDays(value: LocalParts, amount: number, businessOnly: boolean): LocalParts {
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day)); let remaining = amount; const direction = amount < 0 ? -1 : 1;
  while (remaining !== 0) { date.setUTCDate(date.getUTCDate() + direction); const day = date.getUTCDay();
    if (!businessOnly || (day !== 0 && day !== 6)) remaining -= direction; }
  return { ...value, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function normalizeAttentionTime(input: AttentionTimeInput): AttentionTimeProposal | AttentionTimeFailure {
  if (!input.originalWording.trim() || input.originalWording.length > 500 || input.originalWording.includes("\u0000")) {
    return { ok: false, reason: "invalid-original-wording" };
  }
  const referenceMs = Date.parse(input.referenceInstant); if (!Number.isFinite(referenceMs)) return { ok: false, reason: "invalid-reference-instant" };
  const timezone = input.timezone?.trim() || FOUNDER_DEFAULT_TIMEZONE; if (!timezoneValid(timezone)) return { ok: false, reason: "invalid-timezone" };
  if (input.kind === "vendor-window") return { ok: false, reason: "advisory-window-requires-checkpoint" };
  if ("amount" in input && (!Number.isSafeInteger(input.amount) || input.amount < 0 || input.amount > 3660)) return { ok: false, reason: "invalid-amount" };
  const referenceLocal = partsAt(referenceMs, timezone); const assumptions: string[] = [];
  if (!input.timezone) assumptions.push(`Founder default timezone: ${FOUNDER_DEFAULT_TIMEZONE}`);
  if (input.referenceKind === "source") assumptions.push("Relative date resolved from source timestamp");
  let local: LocalParts; let precision: AttentionTimingPrecision = "exact-instant"; let requiresConfirmation = false;
  if (input.kind === "duration-hours") { const instant = new Date(referenceMs + input.amount * 3_600_000).toISOString();
    local = partsAt(Date.parse(instant), timezone); assumptions.push("Hours are elapsed duration, not calendar dates");
    return success(input, timezone, instant, local, precision, assumptions, false); }
  if (input.kind === "date-only") { const parsed = parseDate(input.localDate, referenceLocal); if (!parsed) return { ok: false, reason: "invalid-local-date-time" };
    local = parsed.parts; precision = "date-only"; requiresConfirmation = parsed.missingYear;
    if (parsed.missingYear) assumptions.push(`Resolved missing year as ${local.year}; explicit confirmation required`);
  } else if (input.kind === "local-date-time") { const parsed = parseLocalDateTime(input.localDateTime); if (!parsed) return { ok: false, reason: "invalid-local-date-time" }; local = parsed;
  } else { const clock = parseClock(input.localTime); if (clock === "ambiguous") return { ok: false, reason: "ambiguous-meridiem" };
    if (!clock) return { ok: false, reason: "invalid-local-date-time" }; const days = input.kind === "tomorrow" ? 1 : input.amount;
    local = addCivilDays({ ...referenceLocal, hour: clock.hour, minute: clock.minute, second: 0 }, days, input.kind === "business-days");
    assumptions.push(input.kind === "business-days" ? "Business days are Monday-Friday; no holiday calendar" : "Days are local calendar dates, not elapsed 24-hour durations"); }
  const candidates = possibleInstants(local, timezone); if (candidates.length === 0) return { ok: false, reason: "nonexistent-local-time" }; let selected = candidates;
  if (input.offset) { const supplied = offsetMinutes(input.offset); if (supplied == null) return { ok: false, reason: "timezone-offset-mismatch" };
    selected = candidates.filter((candidate) => candidate.offset === supplied); if (selected.length === 0) return { ok: false, reason: "timezone-offset-mismatch" }; }
  if (selected.length > 1) return { ok: false, reason: "ambiguous-local-time" };
  return success(input, timezone, new Date(selected[0].ms).toISOString(), local, precision, assumptions, requiresConfirmation);
}
function success(input: AttentionTimeInput, timezone: string, instant: string, local: LocalParts, timingPrecision: AttentionTimingPrecision,
  assumptions: string[], requiresConfirmation: boolean): AttentionTimeProposal {
  return { ok: true, instant, localDateTime: localText(local), requiresConfirmation,
    metadata: { version: 1, timingPrecision, timezone, originalWording: input.originalWording,
      referenceInstant: new Date(Date.parse(input.referenceInstant)).toISOString(), originalLocalDateTime: localText(local),
      conditionPolicy: "review-only", assumptions } };
}
