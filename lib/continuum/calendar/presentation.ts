/**
 * Founder-facing Calendar context labels.
 * No Person/Project association copy. No description body. No follow-up inference.
 */

import type { CalendarEventEvidence } from "./types";

export type CalendarFounderEventView = {
  source_ref: string;
  title: string;
  when_label: string;
  timezone: string;
  all_day: boolean;
  status_label: string;
  occurrence_label: string | null;
  location: string | null;
  conference_label: string | null;
  attendees: readonly string[];
};

export type CalendarFounderContextView = {
  upcoming: readonly CalendarFounderEventView[];
  recent: readonly CalendarFounderEventView[];
};

function formatWhen(event: CalendarEventEvidence): string {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  if (event.all_day) {
    const day = new Intl.DateTimeFormat("en-US", {
      timeZone: event.timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(start);
    return `${day} · All day`;
  }
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: event.timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: event.timezone,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;
}

function statusLabel(event: CalendarEventEvidence): string {
  if (event.status === "cancelled") return "Cancelled";
  if (event.status === "tentative") return "Tentative";
  return "Confirmed";
}

function occurrenceLabel(event: CalendarEventEvidence): string | null {
  if (event.occurrence_kind === "changed_occurrence") return "Changed occurrence";
  if (event.occurrence_kind === "cancelled_occurrence") return "Cancelled occurrence";
  if (event.occurrence_kind === "occurrence") return "Occurrence";
  if (event.occurrence_kind === "series") return "Series";
  return null;
}

function attendeeLabel(event: CalendarEventEvidence): string[] {
  return event.attendees
    .filter((row) => !row.self)
    .map((row) => row.display_name || "Guest")
    .filter((name, index, all) => all.indexOf(name) === index);
}

export function toCalendarFounderEventView(
  event: CalendarEventEvidence,
): CalendarFounderEventView {
  return {
    source_ref: event.source_ref,
    title: event.title || "Untitled",
    when_label: formatWhen(event),
    timezone: event.timezone,
    all_day: event.all_day,
    status_label: statusLabel(event),
    occurrence_label: occurrenceLabel(event),
    location: event.location,
    conference_label: event.conference?.label ?? null,
    attendees: attendeeLabel(event),
  };
}

export function toCalendarFounderContextView(input: {
  upcoming: readonly CalendarEventEvidence[];
  recent: readonly CalendarEventEvidence[];
}): CalendarFounderContextView {
  return {
    upcoming: input.upcoming.map(toCalendarFounderEventView),
    recent: input.recent.map(toCalendarFounderEventView),
  };
}
