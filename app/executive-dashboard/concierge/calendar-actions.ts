"use server";

import { createLiveCalendarApi } from "@/lib/continuum/calendar/adapter";
import {
  applyCalendarDisconnect,
  applyCalendarPause,
  applyCalendarResume,
  readOnlyCalendarConnectionStore,
} from "@/lib/continuum/calendar/connection";
import {
  failedCalendarConnectionTest,
  runCalendarConnectionTest,
  type CalendarConnectionTestResult,
} from "@/lib/continuum/calendar/connection-test";
import { isCalendarReadEnabled } from "@/lib/continuum/calendar/env";
import { getAuthenticatedCalendarConnectionStore } from "@/lib/continuum/calendar/load";
import {
  liveCalendarAccessTokenRefresher,
  liveCalendarOAuthTokenExchanger,
} from "@/lib/continuum/calendar/oauth";
import {
  decryptCalendarRefreshToken,
  loadCalendarTokenKek,
} from "@/lib/continuum/calendar/token-crypto";

export type CalendarConnectionControlState =
  | { ok: true; status: "paused" | "connected" | "disconnected" }
  | { ok: false; error: "unauthorized" | "unavailable" | "connection-inactive" };

export async function pauseCalendarConnection(): Promise<CalendarConnectionControlState> {
  const auth = await getAuthenticatedCalendarConnectionStore();
  if (!auth.ok) return { ok: false, error: auth.reason };
  try {
    await applyCalendarPause(auth.store, new Date().toISOString());
    return { ok: true, status: "paused" };
  } catch {
    return { ok: false, error: "connection-inactive" };
  }
}

export async function resumeCalendarConnection(): Promise<CalendarConnectionControlState> {
  const auth = await getAuthenticatedCalendarConnectionStore();
  if (!auth.ok) return { ok: false, error: auth.reason };
  try {
    await applyCalendarResume(auth.store, new Date().toISOString());
    return { ok: true, status: "connected" };
  } catch {
    return { ok: false, error: "connection-inactive" };
  }
}

export async function disconnectCalendarConnection(): Promise<CalendarConnectionControlState> {
  const auth = await getAuthenticatedCalendarConnectionStore();
  if (!auth.ok) return { ok: false, error: auth.reason };
  const kek = loadCalendarTokenKek();
  if (!kek.ok) return { ok: false, error: "unavailable" };
  try {
    await applyCalendarDisconnect({
      store: auth.store,
      now: new Date().toISOString(),
      decryptRefreshToken: (wrapped) => decryptCalendarRefreshToken(wrapped, kek.key),
      revokeToken: (token) => liveCalendarOAuthTokenExchanger.revokeToken(token),
    });
    return { ok: true, status: "disconnected" };
  } catch {
    return { ok: false, error: "connection-inactive" };
  }
}

export async function disconnectCalendarConnectionForm(): Promise<void> {
  await disconnectCalendarConnection();
}

export async function testCalendarConnection(
  _prev: CalendarConnectionTestResult | null,
  _formData: FormData,
): Promise<CalendarConnectionTestResult> {
  if (!isCalendarReadEnabled()) {
    return failedCalendarConnectionTest("calendar-activation-required");
  }
  const auth = await getAuthenticatedCalendarConnectionStore();
  if (!auth.ok) {
    return failedCalendarConnectionTest(
      auth.reason === "unauthorized" ? "unauthorized" : "unavailable",
    );
  }
  const kek = loadCalendarTokenKek();
  if (!kek.ok) return failedCalendarConnectionTest("decrypt-failed");
  return runCalendarConnectionTest({
    founderSessionOk: true,
    connections: readOnlyCalendarConnectionStore(auth.store),
    createApi: createLiveCalendarApi,
    refreshAccessToken: (token) =>
      liveCalendarAccessTokenRefresher.refreshAccessToken(token),
    decryptRefreshToken: (wrapped) => decryptCalendarRefreshToken(wrapped, kek.key),
  });
}
