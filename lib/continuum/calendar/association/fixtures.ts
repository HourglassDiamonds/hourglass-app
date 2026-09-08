/**
 * #22 CalendarEventEvidence constructors for #23 association tests.
 * Does not fetch Calendar. Does not invent Production activation success.
 */

import type { CalendarEventEvidence } from "../types";
import { calendarSourceRef } from "../normalize";

export function calendarEventEvidence(
  partial: Partial<CalendarEventEvidence> &
    Pick<CalendarEventEvidence, "calendar_event_id" | "calendar_id">,
): CalendarEventEvidence {
  const calendarId = partial.calendar_id;
  const eventId = partial.calendar_event_id;
  const { person_id: _personId, project_id: _projectId, ...rest } = partial;
  return {
    title: "Studio visit",
    start_at: "2026-03-11T14:00:00.000Z",
    end_at: "2026-03-11T15:00:00.000Z",
    timezone: "America/New_York",
    all_day: false,
    status: "confirmed",
    occurrence_kind: "single",
    series_id: null,
    original_start_at: null,
    organizer: null,
    attendees: [],
    location: null,
    conference: null,
    updated_at: null,
    description_present: false,
    provenance: {
      captured_at: "2026-03-10T16:00:00.000Z",
      provider: "google_calendar_api",
      read_method: "events.list",
      calendar_access_role: "owner",
    },
    ...rest,
    calendar_event_id: eventId,
    calendar_id: calendarId,
    source_system: "google_calendar",
    source_ref: rest.source_ref ?? calendarSourceRef(calendarId, eventId),
    person_id: null,
    project_id: null,
  };
}
