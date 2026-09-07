/**
 * Founder calendar mailbox binding.
 * Exact match against CONTINUUM_CALENDAR_FOUNDER_EMAIL after calendarList.
 * Does not read the Gmail founder-email env.
 */

import { hashEmail, normalizeEmail } from "@/lib/continuum/client-memory/hashes";
import { getContinuumCalendarFounderEmail } from "./env";

export type CalendarMailboxBindResult =
  | { ok: true; calendarEmailHash: string }
  | {
      ok: false;
      error: "calendar-wrong-mailbox" | "calendar-mailbox-unconfigured";
    };

export function bindFounderCalendar(
  profileEmail: string,
  configuredFounderEmail = getContinuumCalendarFounderEmail(),
): CalendarMailboxBindResult {
  const expected = normalizeEmail(configuredFounderEmail);
  const actual = normalizeEmail(profileEmail);
  if (!expected) {
    return { ok: false, error: "calendar-mailbox-unconfigured" };
  }
  if (!actual || actual !== expected) {
    return { ok: false, error: "calendar-wrong-mailbox" };
  }
  const calendarEmailHash = hashEmail(actual);
  if (!calendarEmailHash) {
    return { ok: false, error: "calendar-wrong-mailbox" };
  }
  return { ok: true, calendarEmailHash };
}
