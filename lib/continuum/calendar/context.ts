/**
 * Live read-through Calendar context. No event persistence.
 * Upcoming / recent windows only. No Person/Project association.
 */

import type { CalendarReadApi } from "./adapter";
import { dedupeCalendarEvents, normalizeGoogleCalendarEvent } from "./normalize";
import { toCalendarAssociationHandoff } from "./handoff";
import type { CalendarAssociationHandoff } from "./handoff";
import {
  CALENDAR_LIST_MAX_RESULTS,
  CALENDAR_MAX_CALENDARS,
  CALENDAR_RECENT_WINDOW_MS,
  CALENDAR_UPCOMING_WINDOW_MS,
  type CalendarEventEvidence,
  type CalendarSourceCalendar,
  type GoogleCalendarListEntry,
} from "./types";

export type CalendarContextWindows = {
  now: Date;
  recentFrom: Date;
  upcomingUntil: Date;
};

export function calendarContextWindows(now = new Date()): CalendarContextWindows {
  return {
    now,
    recentFrom: new Date(now.getTime() - CALENDAR_RECENT_WINDOW_MS),
    upcomingUntil: new Date(now.getTime() + CALENDAR_UPCOMING_WINDOW_MS),
  };
}

export function selectReadableCalendars(
  entries: readonly GoogleCalendarListEntry[],
): CalendarSourceCalendar[] {
  const selected: CalendarSourceCalendar[] = [];
  for (const row of entries) {
    const calendarId = row.id?.trim();
    if (!calendarId) continue;
    if (row.selected === false) continue;
    const access = row.accessRole?.trim() ?? null;
    if (access === "freeBusyReader") continue;
    selected.push({
      calendar_id: calendarId,
      summary: row.summary?.trim() || null,
      time_zone: row.timeZone?.trim() || null,
      primary: row.primary === true,
      access_role: access,
      selected: true,
    });
    if (selected.length >= CALENDAR_MAX_CALENDARS) break;
  }
  selected.sort((a, b) => Number(b.primary) - Number(a.primary));
  return selected;
}

export function partitionCalendarEvents(
  events: readonly CalendarEventEvidence[],
  windows: CalendarContextWindows,
): { upcoming: CalendarEventEvidence[]; recent: CalendarEventEvidence[] } {
  const nowIso = windows.now.toISOString();
  const upcoming: CalendarEventEvidence[] = [];
  const recent: CalendarEventEvidence[] = [];
  for (const event of events) {
    if (event.end_at > nowIso) upcoming.push(event);
    else recent.push(event);
  }
  upcoming.sort((a, b) => a.start_at.localeCompare(b.start_at));
  recent.sort((a, b) => b.start_at.localeCompare(a.start_at));
  return { upcoming, recent };
}

export type CalendarReadContext = {
  calendars: readonly CalendarSourceCalendar[];
  upcoming: readonly CalendarEventEvidence[];
  recent: readonly CalendarEventEvidence[];
  association_handoffs: readonly CalendarAssociationHandoff[];
};

export async function readCalendarContext(input: {
  api: CalendarReadApi;
  now?: Date;
}): Promise<CalendarReadContext> {
  const windows = calendarContextWindows(input.now);
  const list = await input.api.getCalendarList();
  const calendars = selectReadableCalendars(list.calendars);
  const capturedAt = windows.now.toISOString();
  const normalized: CalendarEventEvidence[] = [];
  for (const calendar of calendars) {
    const page = await input.api.listEvents({
      calendarId: calendar.calendar_id,
      timeMin: windows.recentFrom.toISOString(),
      timeMax: windows.upcomingUntil.toISOString(),
      maxResults: CALENDAR_LIST_MAX_RESULTS,
      showDeleted: true,
    });
    const calendarTz = page.timeZone ?? calendar.time_zone;
    for (const event of page.events) {
      const evidence = normalizeGoogleCalendarEvent({
        event,
        calendarId: calendar.calendar_id,
        calendarTimeZone: calendarTz,
        calendarAccessRole: calendar.access_role,
        capturedAt,
      });
      if (evidence) normalized.push(evidence);
    }
  }
  const unique = dedupeCalendarEvents(normalized);
  const { upcoming, recent } = partitionCalendarEvents(unique, windows);
  return {
    calendars,
    upcoming,
    recent,
    association_handoffs: [...upcoming, ...recent].map(toCalendarAssociationHandoff),
  };
}

export function primaryCalendarEmail(
  calendars: readonly GoogleCalendarListEntry[],
): string | null {
  const primary = calendars.find((row) => row.primary === true && row.id);
  const id = primary?.id?.trim() ?? calendars[0]?.id?.trim();
  if (!id || !id.includes("@")) return null;
  return id;
}
