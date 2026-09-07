/**
 * Normalize Google Calendar events into Continuum source evidence.
 * Does not associate People or Projects. Does not copy event descriptions.
 */

import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { addCalendarDays, googleDateTimeToUtcIso, parseDateOnly } from "./timezone";
import {
  CALENDAR_SOURCE_SYSTEM,
  type CalendarAttendeeEvidence,
  type CalendarAttendeeResponse,
  type CalendarEventEvidence,
  type CalendarEventStatus,
  type CalendarOccurrenceKind,
  type CalendarOrganizerEvidence,
  type GoogleCalendarAttendee,
  type GoogleCalendarEvent,
} from "./types";

export function calendarSourceRef(
  calendarId: string,
  eventId: string,
): string {
  return `${CALENDAR_SOURCE_SYSTEM}:${calendarId}:${eventId}`;
}

function asStatus(value: string | null | undefined): CalendarEventStatus {
  if (value === "confirmed" || value === "tentative" || value === "cancelled") {
    return value;
  }
  return "unknown";
}

function asAttendeeResponse(
  value: string | null | undefined,
): CalendarAttendeeResponse {
  if (
    value === "accepted" ||
    value === "declined" ||
    value === "tentative" ||
    value === "needsAction"
  ) {
    return value;
  }
  return "unknown";
}

function occurrenceKind(event: GoogleCalendarEvent): CalendarOccurrenceKind {
  const cancelled = event.status === "cancelled";
  if (event.recurringEventId) {
    if (cancelled) return "cancelled_occurrence";
    if (event.originalStartTime) return "changed_occurrence";
    return "occurrence";
  }
  if (event.recurrence && event.recurrence.length > 0) return "series";
  if (cancelled) return "single";
  return "single";
}

function normalizePerson(input: {
  email?: string | null;
  displayName?: string | null;
  self?: boolean | null;
}): CalendarOrganizerEvidence {
  const email = input.email?.trim() ?? "";
  return {
    display_name: input.displayName?.trim() || null,
    email_hash: email ? hashEmail(email) : null,
    email_present: Boolean(email),
    self: input.self === true,
  };
}

function normalizeAttendee(
  row: GoogleCalendarAttendee,
): CalendarAttendeeEvidence {
  const person = normalizePerson(row);
  return {
    ...person,
    response_status: asAttendeeResponse(row.responseStatus),
    optional: row.optional === true,
    organizer: row.organizer === true,
  };
}

function conferenceOf(event: GoogleCalendarEvent): CalendarEventEvidence["conference"] {
  const solution = event.conferenceData?.conferenceSolution;
  const type = solution?.key?.type?.trim() || null;
  const label = solution?.name?.trim() || (event.hangoutLink ? "Google Meet" : null);
  const conferenceId = event.conferenceData?.conferenceId?.trim() || null;
  if (!type && !label && !conferenceId) return null;
  return { type, label, conference_id: conferenceId };
}

export function normalizeGoogleCalendarEvent(input: {
  event: GoogleCalendarEvent;
  calendarId: string;
  calendarTimeZone?: string | null;
  calendarAccessRole?: string | null;
  capturedAt: string;
}): CalendarEventEvidence | null {
  const eventId = input.event.id?.trim();
  if (!eventId) return null;
  const start = googleDateTimeToUtcIso(
    input.event.start,
    input.calendarTimeZone,
  );
  const end = googleDateTimeToUtcIso(input.event.end, input.calendarTimeZone);
  if (!start) return null;
  let endAt = end?.iso ?? null;
  if (!endAt && start.allDay) {
    const wall = input.event.start?.date
      ? parseDateOnly(input.event.start.date)
      : null;
    if (wall) {
      const next = addCalendarDays(wall, 1);
      const computed = googleDateTimeToUtcIso(
        {
          date: `${String(next.year).padStart(4, "0")}-${String(next.month).padStart(2, "0")}-${String(next.day).padStart(2, "0")}`,
          timeZone: input.event.start?.timeZone,
        },
        input.calendarTimeZone,
      );
      endAt = computed?.iso ?? null;
    }
  }
  if (!endAt) return null;
  const original = input.event.originalStartTime
    ? googleDateTimeToUtcIso(
        input.event.originalStartTime,
        input.calendarTimeZone,
      )
    : null;
  const kind = occurrenceKind(input.event);
  const seriesId =
    input.event.recurringEventId?.trim() ||
    (kind === "series" ? eventId : null);
  const attendees = (input.event.attendees ?? []).map(normalizeAttendee);
  return {
    calendar_event_id: eventId,
    calendar_id: input.calendarId,
    title: input.event.summary?.trim() || null,
    start_at: start.iso,
    end_at: endAt,
    timezone: start.timezone,
    all_day: start.allDay,
    status: asStatus(input.event.status),
    occurrence_kind: kind,
    series_id: seriesId,
    original_start_at: original?.iso ?? null,
    organizer: input.event.organizer
      ? normalizePerson(input.event.organizer)
      : null,
    attendees,
    location: input.event.location?.trim() || null,
    conference: conferenceOf(input.event),
    updated_at: input.event.updated?.trim() || null,
    description_present: Boolean(input.event.description?.trim()),
    source_system: CALENDAR_SOURCE_SYSTEM,
    source_ref: calendarSourceRef(input.calendarId, eventId),
    provenance: {
      captured_at: input.capturedAt,
      provider: "google_calendar_api",
      read_method: "events.list",
      calendar_access_role: input.calendarAccessRole ?? null,
    },
    person_id: null,
    project_id: null,
  };
}

export function dedupeCalendarEvents(
  events: readonly CalendarEventEvidence[],
): CalendarEventEvidence[] {
  const seen = new Set<string>();
  const out: CalendarEventEvidence[] = [];
  for (const event of events) {
    if (seen.has(event.source_ref)) continue;
    seen.add(event.source_ref);
    out.push(event);
  }
  return out;
}
