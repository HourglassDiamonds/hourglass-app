/**
 * Compact Today upcoming window.
 * Read-only calendar context. Does not create, update, or schedule events.
 * Advisory timing stays a recommendation. It does not change source truth.
 */

import { civilDateInZone, FOUNDER_BUSINESS_TIME_ZONE } from "@/lib/continuum/date-only";
import type { CalendarEventEvidence, CalendarSourceCalendar } from "./types";

export type CalendarCheckpointDisposition = "advisory";

export type TodayUpcomingItem = {
  sourceRef: string;
  calendarId: string;
  eventId: string;
  timeLabel: string;
  title: string;
  location: string | null;
  meetingLabel: string | null;
  allDay: boolean;
  timezone: string;
  observedAt: string | null;
  disclosure: "full" | "minimal";
  disposition: CalendarCheckpointDisposition;
};

export type TodayUpcomingReadStatus =
  | "ready"
  | "activation-required"
  | "consent-required"
  | "unavailable"
  | "paused"
  | "read-failed";

export type CalendarFeedbackCommitment = {
  sourceRef: string;
  timeLabel: string;
  title: string;
  allDay: boolean;
  location: string | null;
  meetingLabel: string | null;
};

function observedAt(event: CalendarEventEvidence): string | null {
  return event.updated_at || event.provenance.captured_at || null;
}

function minimalDisclosure(
  event: CalendarEventEvidence,
  calendarSummary: string | null,
): boolean {
  if (event.visibility === "private" || event.visibility === "confidential") return true;
  return /\bpersonal\b/i.test(calendarSummary ?? "");
}

function timeLabel(event: CalendarEventEvidence): string {
  if (event.all_day) return "All day";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: event.timezone || FOUNDER_BUSINESS_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  }).formatToParts(new Date(event.start_at));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

function onFounderDay(
  event: CalendarEventEvidence,
  today: string,
  nowIso: string,
): boolean {
  if (event.status === "cancelled" || event.occurrence_kind === "cancelled_occurrence") {
    return false;
  }
  if (event.end_at <= nowIso) return false;
  const startDay = civilDateInZone(event.start_at, FOUNDER_BUSINESS_TIME_ZONE);
  if (startDay === today) return true;
  return event.start_at < nowIso && startDay != null && startDay < today;
}

export function mergeCalendarEvidence(
  events: readonly CalendarEventEvidence[],
): CalendarEventEvidence[] {
  const byRef = new Map<string, CalendarEventEvidence>();
  for (const event of events) {
    const clean: CalendarEventEvidence = {
      ...event,
      person_id: null,
      project_id: null,
    };
    const previous = byRef.get(clean.source_ref);
    if (!previous || (observedAt(clean) ?? "") >= (observedAt(previous) ?? "")) {
      byRef.set(clean.source_ref, clean);
    }
  }
  return [...byRef.values()];
}

export function selectTodayUpcoming(input: {
  events: readonly CalendarEventEvidence[];
  calendars?: readonly Pick<CalendarSourceCalendar, "calendar_id" | "summary">[];
  now?: Date;
}): TodayUpcomingItem[] {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const today = civilDateInZone(nowIso, FOUNDER_BUSINESS_TIME_ZONE);
  if (!today) return [];
  const summaries = new Map(
    (input.calendars ?? []).map((calendar) => [calendar.calendar_id, calendar.summary]),
  );
  return mergeCalendarEvidence(input.events)
    .filter((event) => onFounderDay(event, today, nowIso))
    .sort((left, right) => left.start_at.localeCompare(right.start_at) || left.source_ref.localeCompare(right.source_ref))
    .map((event) => {
      const minimal = minimalDisclosure(event, summaries.get(event.calendar_id) ?? null);
      return {
        sourceRef: event.source_ref,
        calendarId: event.calendar_id,
        eventId: event.calendar_event_id,
        timeLabel: timeLabel(event),
        title: minimal ? "Personal" : event.title || "Untitled",
        location: minimal ? null : event.location,
        meetingLabel: minimal ? null : event.conference?.label ?? null,
        allDay: event.all_day,
        timezone: event.timezone,
        observedAt: observedAt(event),
        disclosure: minimal ? "minimal" : "full",
        disposition: "advisory",
      };
    });
}

export function upcomingFromCalendarRead(input: {
  enabled: boolean;
  status: TodayUpcomingReadStatus;
  events: readonly CalendarEventEvidence[];
  calendars?: readonly Pick<CalendarSourceCalendar, "calendar_id" | "summary">[];
  now?: Date;
}): TodayUpcomingItem[] {
  if (!input.enabled || input.status !== "ready") return [];
  return selectTodayUpcoming(input);
}

export function calendarFeedbackCommitments(
  upcoming: readonly TodayUpcomingItem[],
): CalendarFeedbackCommitment[] {
  return upcoming.map((item) => ({
    sourceRef: item.sourceRef,
    timeLabel: item.timeLabel,
    title: item.title,
    allDay: item.allDay,
    location: item.location,
    meetingLabel: item.meetingLabel,
  }));
}

export function calendarFeedbackMaterialKey(
  commitments: readonly CalendarFeedbackCommitment[],
): string {
  return commitments
    .map((item) =>
      [
        item.sourceRef,
        item.timeLabel,
        item.allDay ? "all-day" : "timed",
        item.title,
        item.location ?? "",
        item.meetingLabel ?? "",
      ].join("|"),
    )
    .join("\n");
}

export function calendarTimingRecommendation(input: {
  focusNames: readonly string[];
  upcoming: readonly TodayUpcomingItem[];
}): string | null {
  const focus = input.focusNames.find((name) => name.trim());
  const next = input.upcoming.find((item) => !item.allDay);
  if (!focus || !next) return null;
  const label = next.disclosure === "minimal" ? "a personal commitment" : next.title;
  return `You have ${label} at ${next.timeLabel}, so I would clear ${focus} before then.`;
}
