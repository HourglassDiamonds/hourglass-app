/**
 * Server-only Calendar connection loader.
 * Founder executive-dashboard session required before service-role access.
 */

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { createLiveCalendarApi } from "./adapter";
import { isCalendarReadEligible, type CalendarConnectionStore } from "./connection";
import { readCalendarContext, type CalendarReadContext } from "./context";
import { isCalendarReadEnabled } from "./env";
import {
  liveCalendarAccessTokenRefresher,
} from "./oauth";
import { createSupabaseCalendarConnectionStore } from "./server";
import {
  decryptCalendarRefreshToken,
  loadCalendarTokenKek,
} from "./token-crypto";

export type AuthenticatedCalendarConnectionStore =
  | { ok: true; store: CalendarConnectionStore; username: string }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function getAuthenticatedCalendarConnectionStore(): Promise<AuthenticatedCalendarConnectionStore> {
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) {
    return { ok: false, reason: "unauthorized" };
  }
  try {
    return {
      ok: true,
      store: createSupabaseCalendarConnectionStore(),
      username: session.username,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export type CalendarFounderSurface =
  | {
      status: "ready";
      connected: true;
      context: CalendarReadContext;
    }
  | {
      status:
        | "activation-required"
        | "consent-required"
        | "unavailable"
        | "paused"
        | "read-failed";
      connected: boolean;
      context: null;
    };

export async function loadCalendarFounderSurface(
  now = new Date(),
): Promise<CalendarFounderSurface> {
  if (!isCalendarReadEnabled()) {
    return { status: "activation-required", connected: false, context: null };
  }
  const auth = await getAuthenticatedCalendarConnectionStore();
  if (!auth.ok) {
    return {
      status: "unavailable",
      connected: false,
      context: null,
    };
  }
  let row;
  try {
    row = await auth.store.getFounderConnection();
  } catch {
    return { status: "unavailable", connected: false, context: null };
  }
  if (!row || row.status === "disconnected" || row.status === "revoked") {
    return { status: "consent-required", connected: false, context: null };
  }
  if (row.status === "paused" || !isCalendarReadEligible(row) || !row.refreshToken) {
    return { status: "paused", connected: false, context: null };
  }
  const kek = loadCalendarTokenKek();
  if (!kek.ok) {
    return { status: "unavailable", connected: true, context: null };
  }
  let refresh: string;
  try {
    refresh = decryptCalendarRefreshToken(row.refreshToken, kek.key);
  } catch {
    return { status: "read-failed", connected: true, context: null };
  }
  const access = await liveCalendarAccessTokenRefresher.refreshAccessToken(refresh);
  if (!access.ok) {
    return { status: "read-failed", connected: true, context: null };
  }
  try {
    const context = await readCalendarContext({
      api: createLiveCalendarApi(access.accessToken),
      now,
    });
    return { status: "ready", connected: true, context };
  } catch {
    return { status: "read-failed", connected: true, context: null };
  }
}
