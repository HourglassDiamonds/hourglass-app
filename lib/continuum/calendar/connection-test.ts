/**
 * Founder Calendar connection probe.
 * calendarList GET only. Does not list event bodies or write.
 */

import type { CalendarReadApi } from "./adapter";
import type { CalendarConnectionStore } from "./connection";
import { isCalendarReadEligible } from "./connection";
import { CONCIERGE_CALENDAR_PATH } from "./types";

export { CONCIERGE_CALENDAR_PATH };

export type CalendarConnectionTestResult = {
  connectionVerified: boolean;
  calendarListSucceeded: boolean;
  calendarCount: number | null;
  safeErrorCode: string | null;
};

export function failedCalendarConnectionTest(
  code: string,
): CalendarConnectionTestResult {
  return {
    connectionVerified: false,
    calendarListSucceeded: false,
    calendarCount: null,
    safeErrorCode: code,
  };
}

export async function runCalendarConnectionTest(input: {
  founderSessionOk: boolean;
  connections: CalendarConnectionStore;
  createApi: (accessToken: string) => CalendarReadApi;
  refreshAccessToken: (
    refreshToken: string,
  ) => Promise<{ ok: true; accessToken: string } | { ok: false; error: string }>;
  decryptRefreshToken: (wrapped: {
    alg: "aes-256-gcm";
    version: 1;
    iv: string;
    tag: string;
    ciphertext: string;
  }) => string;
}): Promise<CalendarConnectionTestResult> {
  if (!input.founderSessionOk) {
    return failedCalendarConnectionTest("unauthorized");
  }
  const connection = await input.connections.getFounderConnection();
  if (!isCalendarReadEligible(connection) || !connection?.refreshToken) {
    return failedCalendarConnectionTest("connection-inactive");
  }
  let refresh: string;
  try {
    refresh = input.decryptRefreshToken(connection.refreshToken);
  } catch {
    return failedCalendarConnectionTest("decrypt-failed");
  }
  const access = await input.refreshAccessToken(refresh);
  if (!access.ok) {
    return failedCalendarConnectionTest(access.error);
  }
  try {
    const list = await input.createApi(access.accessToken).getCalendarList();
    return {
      connectionVerified: true,
      calendarListSucceeded: true,
      calendarCount: list.calendars.length,
      safeErrorCode: null,
    };
  } catch {
    return failedCalendarConnectionTest("calendar-list-failed");
  }
}
