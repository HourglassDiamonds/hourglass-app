/**
 * Safe Calendar activation telemetry.
 * Allowlisted fields only. No titles, attendees, locations, tokens, or auth codes.
 */

export const CALENDAR_SAFE_TELEMETRY_EVENTS = [
  "calendar-oauth-ok",
  "calendar-oauth-failed",
  "calendar-read-ok",
  "calendar-read-failed",
  "calendar-connection",
] as const;

export type CalendarSafeTelemetryEventName =
  (typeof CALENDAR_SAFE_TELEMETRY_EVENTS)[number];

export type CalendarSafeTelemetryEvent = {
  event: CalendarSafeTelemetryEventName;
  status?: string;
  error_code?: string;
  event_count?: number;
};

const ALLOWED_KEYS = new Set(["event", "status", "error_code", "event_count"]);

export type CalendarTelemetrySink = (event: CalendarSafeTelemetryEvent) => void;

export const noopCalendarTelemetry: CalendarTelemetrySink = () => {};

export function calendarSafeTelemetry(
  event: CalendarSafeTelemetryEvent,
): CalendarSafeTelemetryEvent {
  for (const key of Object.keys(event)) {
    if (!ALLOWED_KEYS.has(key)) throw new Error("calendar-telemetry-forbidden");
  }
  if (
    !(CALENDAR_SAFE_TELEMETRY_EVENTS as readonly string[]).includes(event.event)
  ) {
    throw new Error("calendar-telemetry-event-invalid");
  }
  const sanitized: CalendarSafeTelemetryEvent = { event: event.event };
  if (event.status != null) sanitized.status = event.status;
  if (event.error_code != null) sanitized.error_code = event.error_code;
  if (event.event_count != null) sanitized.event_count = event.event_count;
  return sanitized;
}

export function emitCalendarTelemetry(
  sink: CalendarTelemetrySink,
  event: CalendarSafeTelemetryEvent,
): void {
  sink(calendarSafeTelemetry(event));
}
