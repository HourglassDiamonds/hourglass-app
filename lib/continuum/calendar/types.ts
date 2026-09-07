/**
 * Continuum Calendar read-only contracts.
 * Dedicated Calendar OAuth + token custody + live event evidence.
 * Does not reuse Gmail OAuth, Intelligence Google OAuth, or store event bodies.
 */

export const CALENDAR_READONLY_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly" as const;

export const CALENDAR_WRITE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

export const CALENDAR_FOUNDER_SLOT = "founder-v1" as const;

export const CONCIERGE_CALENDAR_PATH =
  "/executive-dashboard/concierge/calendar" as const;

export const CALENDAR_SOURCE_SYSTEM = "google_calendar" as const;

export const CALENDAR_TOKEN_ENC_ALG = "aes-256-gcm" as const;

export const CALENDAR_RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const CALENDAR_UPCOMING_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
export const CALENDAR_LIST_MAX_RESULTS = 50 as const;
export const CALENDAR_MAX_CALENDARS = 8 as const;

export const CALENDAR_CONNECTION_STATUSES = [
  "connected",
  "paused",
  "disconnected",
  "revoked",
] as const;

export type CalendarConnectionStatus =
  (typeof CALENDAR_CONNECTION_STATUSES)[number];

export type CalendarTokenCiphertext = {
  alg: typeof CALENDAR_TOKEN_ENC_ALG;
  version: 1;
  iv: string;
  tag: string;
  ciphertext: string;
};

export type CalendarConnection = {
  connectionId: string;
  calendarSlot: typeof CALENDAR_FOUNDER_SLOT;
  calendarEmailHash: string;
  status: CalendarConnectionStatus;
  refreshToken: CalendarTokenCiphertext | null;
  grantedScope: string | null;
  providerTokenType: string | null;
  connectedAt: string | null;
  updatedAt: string;
  lastReadAt: string | null;
  statusErrorCode: string | null;
};

export const CALENDAR_EVENT_STATUSES = [
  "confirmed",
  "tentative",
  "cancelled",
  "unknown",
] as const;

export type CalendarEventStatus = (typeof CALENDAR_EVENT_STATUSES)[number];

export const CALENDAR_OCCURRENCE_KINDS = [
  "single",
  "series",
  "occurrence",
  "changed_occurrence",
  "cancelled_occurrence",
] as const;

export type CalendarOccurrenceKind =
  (typeof CALENDAR_OCCURRENCE_KINDS)[number];

export const CALENDAR_ATTENDEE_RESPONSES = [
  "accepted",
  "declined",
  "tentative",
  "needsAction",
  "unknown",
] as const;

export type CalendarAttendeeResponse =
  (typeof CALENDAR_ATTENDEE_RESPONSES)[number];

export type CalendarAttendeeEvidence = {
  display_name: string | null;
  email_hash: string | null;
  email_present: boolean;
  response_status: CalendarAttendeeResponse;
  optional: boolean;
  organizer: boolean;
  self: boolean;
};

export type CalendarOrganizerEvidence = {
  display_name: string | null;
  email_hash: string | null;
  email_present: boolean;
  self: boolean;
};

export type CalendarConferenceEvidence = {
  type: string | null;
  label: string | null;
  conference_id: string | null;
};

export type CalendarEventProvenance = {
  captured_at: string;
  provider: "google_calendar_api";
  read_method: "events.list";
  calendar_access_role: string | null;
};

export type CalendarEventEvidence = {
  calendar_event_id: string;
  calendar_id: string;
  title: string | null;
  start_at: string;
  end_at: string;
  timezone: string;
  all_day: boolean;
  status: CalendarEventStatus;
  occurrence_kind: CalendarOccurrenceKind;
  series_id: string | null;
  original_start_at: string | null;
  organizer: CalendarOrganizerEvidence | null;
  attendees: readonly CalendarAttendeeEvidence[];
  location: string | null;
  conference: CalendarConferenceEvidence | null;
  updated_at: string | null;
  description_present: boolean;
  source_system: typeof CALENDAR_SOURCE_SYSTEM;
  source_ref: string;
  provenance: CalendarEventProvenance;
  person_id: null;
  project_id: null;
};

export type CalendarSourceCalendar = {
  calendar_id: string;
  summary: string | null;
  time_zone: string | null;
  primary: boolean;
  access_role: string | null;
  selected: boolean;
};

export const CALENDAR_OAUTH_ERROR_CODES = [
  "unauthorized",
  "oauth-not-configured",
  "oauth-state-mismatch",
  "oauth-pkce-mismatch",
  "oauth-code-missing",
  "oauth-denied",
  "calendar-wrong-mailbox",
  "calendar-mailbox-unconfigured",
  "calendar-scope-rejected",
  "calendar-activation-required",
  "token-exchange-failed",
  "token-revoke-failed",
  "invalid_grant",
  "connection-inactive",
] as const;

export type CalendarOAuthErrorCode =
  (typeof CALENDAR_OAUTH_ERROR_CODES)[number];

export type GoogleCalendarDateTime = {
  date?: string | null;
  dateTime?: string | null;
  timeZone?: string | null;
};

export type GoogleCalendarAttendee = {
  email?: string | null;
  displayName?: string | null;
  responseStatus?: string | null;
  optional?: boolean | null;
  organizer?: boolean | null;
  self?: boolean | null;
};

export type GoogleCalendarEvent = {
  id?: string | null;
  status?: string | null;
  summary?: string | null;
  location?: string | null;
  description?: string | null;
  start?: GoogleCalendarDateTime | null;
  end?: GoogleCalendarDateTime | null;
  updated?: string | null;
  organizer?: {
    email?: string | null;
    displayName?: string | null;
    self?: boolean | null;
  } | null;
  attendees?: readonly GoogleCalendarAttendee[] | null;
  hangoutLink?: string | null;
  conferenceData?: {
    conferenceId?: string | null;
    conferenceSolution?: {
      name?: string | null;
      key?: { type?: string | null } | null;
    } | null;
    entryPoints?: readonly {
      entryPointType?: string | null;
      uri?: string | null;
      label?: string | null;
    }[] | null;
  } | null;
  recurrence?: readonly string[] | null;
  recurringEventId?: string | null;
  originalStartTime?: GoogleCalendarDateTime | null;
};

export type GoogleCalendarListEntry = {
  id?: string | null;
  summary?: string | null;
  timeZone?: string | null;
  primary?: boolean | null;
  selected?: boolean | null;
  accessRole?: string | null;
};

export type CalendarListPage = {
  calendars: readonly GoogleCalendarListEntry[];
  nextPageToken: string | null;
};

export type CalendarEventsPage = {
  events: readonly GoogleCalendarEvent[];
  nextPageToken: string | null;
  timeZone: string | null;
};
