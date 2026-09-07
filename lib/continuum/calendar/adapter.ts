/**
 * Server-only Google Calendar API abstraction.
 * Read methods only. Mockable. Live fetch uses GET and cache: no-store.
 * Never insert, update, delete, patch, move, import, or respond.
 */

import type {
  CalendarEventsPage,
  CalendarListPage,
  GoogleCalendarEvent,
  GoogleCalendarListEntry,
} from "./types";

export const CALENDAR_READ_METHODS = ["getCalendarList", "listEvents"] as const;

export type CalendarReadMethod = (typeof CALENDAR_READ_METHODS)[number];

export const CALENDAR_WRITE_METHOD_NAMES = [
  "insert",
  "update",
  "delete",
  "patch",
  "move",
  "import",
  "quickAdd",
  "respond",
  "invite",
] as const;

export type CalendarListEventsQuery = {
  calendarId: string;
  timeMin: string;
  timeMax: string;
  pageToken?: string | null;
  maxResults?: number;
  showDeleted?: boolean;
};

export type CalendarReadApi = {
  getCalendarList(): Promise<CalendarListPage>;
  listEvents(query: CalendarListEventsQuery): Promise<CalendarEventsPage>;
};

export type CalendarApiCall =
  | { method: "getCalendarList" }
  | {
      method: "listEvents";
      calendarId: string;
      timeMin: string;
      timeMax: string;
      pageToken: string | null;
      maxResults: number | null;
      showDeleted: boolean;
    };

export function calendarReadApiMethodNames(
  api: CalendarReadApi,
): readonly string[] {
  return CALENDAR_READ_METHODS.filter(
    (name) => typeof (api as Record<string, unknown>)[name] === "function",
  );
}

export function assertCalendarReadApiHasNoWriteMethods(api: CalendarReadApi): void {
  const record = api as Record<string, unknown>;
  for (const method of CALENDAR_WRITE_METHOD_NAMES) {
    if (typeof record[method] === "function") {
      throw new Error(`calendar-write-method-reachable:${method}`);
    }
  }
  for (const required of CALENDAR_READ_METHODS) {
    if (typeof record[required] !== "function") {
      throw new Error(`calendar-read-method-missing:${required}`);
    }
  }
}

export class MockCalendarApi implements CalendarReadApi {
  readonly calls: CalendarApiCall[] = [];
  private calendarList: CalendarListPage = { calendars: [], nextPageToken: null };
  private readonly eventPages = new Map<string, CalendarEventsPage>();
  errors = new Map<string, Error>();

  setCalendarList(page: CalendarListPage): void {
    this.calendarList = {
      calendars: page.calendars.map((row) => ({ ...row })),
      nextPageToken: page.nextPageToken,
    };
  }

  setEventPage(
    calendarId: string,
    pageToken: string | null,
    page: CalendarEventsPage,
  ): void {
    this.eventPages.set(eventPageKey(calendarId, pageToken), {
      events: page.events.map((row) => ({ ...row })),
      nextPageToken: page.nextPageToken,
      timeZone: page.timeZone,
    });
  }

  private maybeThrow(key: string): void {
    const error = this.errors.get(key);
    if (error) throw error;
  }

  async getCalendarList(): Promise<CalendarListPage> {
    this.calls.push({ method: "getCalendarList" });
    this.maybeThrow("getCalendarList");
    return {
      calendars: this.calendarList.calendars.map((row) => ({ ...row })),
      nextPageToken: this.calendarList.nextPageToken,
    };
  }

  async listEvents(query: CalendarListEventsQuery): Promise<CalendarEventsPage> {
    const pageToken = query.pageToken ?? null;
    this.calls.push({
      method: "listEvents",
      calendarId: query.calendarId,
      timeMin: query.timeMin,
      timeMax: query.timeMax,
      pageToken,
      maxResults: query.maxResults ?? null,
      showDeleted: query.showDeleted === true,
    });
    this.maybeThrow("listEvents");
    this.maybeThrow(`listEvents:${query.calendarId}:${pageToken ?? ""}`);
    const page =
      this.eventPages.get(eventPageKey(query.calendarId, pageToken)) ?? {
        events: [] as GoogleCalendarEvent[],
        nextPageToken: null,
        timeZone: null,
      };
    return {
      events: page.events.map((row) => ({ ...row })),
      nextPageToken: page.nextPageToken,
      timeZone: page.timeZone,
    };
  }
}

export class CalendarHttpError extends Error {
  readonly status: number;
  readonly reason: string;

  constructor(status: number, reason: string) {
    super(`calendar-http-${status}`);
    this.name = "CalendarHttpError";
    this.status = status;
    this.reason = reason;
  }
}

const CALENDAR_API_ROOT = "https://www.googleapis.com/calendar/v3";

function eventPageKey(calendarId: string, pageToken: string | null): string {
  return `${calendarId}\0${pageToken ?? ""}`;
}

/**
 * Live read-only adapter. Constructed only when a real access token is in
 * process memory. Uses HTTP GET exclusively. Write endpoints are unreachable
 * through this adapter.
 */
export function createLiveCalendarApi(accessToken: string): CalendarReadApi {
  async function calendarGet<T>(path: string): Promise<T> {
    const response = await fetch(`${CALENDAR_API_ROOT}${path}`, {
      method: "GET",
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new CalendarHttpError(
        response.status,
        response.status === 404 ? "notFound" : "http",
      );
    }
    return text.trim() ? (JSON.parse(text) as T) : ({} as T);
  }

  const api: CalendarReadApi = {
    getCalendarList: async () => {
      const data = await calendarGet<{
        items?: GoogleCalendarListEntry[];
        nextPageToken?: string;
      }>("/users/me/calendarList?maxResults=50");
      return {
        calendars: data.items ?? [],
        nextPageToken: data.nextPageToken ?? null,
      };
    },
    listEvents: async (query) => {
      const params = new URLSearchParams();
      params.set("timeMin", query.timeMin);
      params.set("timeMax", query.timeMax);
      params.set("singleEvents", "true");
      params.set("orderBy", "startTime");
      params.set("maxResults", String(query.maxResults ?? 50));
      params.set("showDeleted", query.showDeleted ? "true" : "false");
      if (query.pageToken) params.set("pageToken", query.pageToken);
      const data = await calendarGet<{
        items?: GoogleCalendarEvent[];
        nextPageToken?: string;
        timeZone?: string;
      }>(
        `/calendars/${encodeURIComponent(query.calendarId)}/events?${params.toString()}`,
      );
      return {
        events: data.items ?? [],
        nextPageToken: data.nextPageToken ?? null,
        timeZone: data.timeZone ?? null,
      };
    },
  };
  assertCalendarReadApiHasNoWriteMethods(api);
  return api;
}
