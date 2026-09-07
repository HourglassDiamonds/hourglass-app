/**
 * Calendar OAuth start / callback handlers.
 * Founder session or signed session-transition intent required.
 * Callback never renders token material. Does not mutate Gmail tokens.
 */

import { bindFounderCalendar } from "./mailbox";
import {
  applyCalendarInvalidGrant,
  connectFounderCalendar,
  type CalendarConnectionStore,
} from "./connection";
import {
  encryptCalendarRefreshToken,
  loadCalendarTokenKek,
} from "./token-crypto";
import { isCalendarReadEnabled } from "./env";
import {
  buildCalendarAuthUrl,
  calendarGrantIsReadOnly,
  createCalendarOAuthPending,
  getCalendarOAuthClientConfig,
  oauthStatesMatch,
  parseCalendarOAuthIntent,
  parseCalendarOAuthPending,
  type CalendarOAuthTokenExchanger,
} from "./oauth";
import { CALENDAR_READONLY_SCOPE, CONCIERGE_CALENDAR_PATH } from "./types";
import {
  emitCalendarTelemetry,
  type CalendarTelemetrySink,
  noopCalendarTelemetry,
} from "./logging";

export type CalendarOAuthHandlerResult =
  | {
      status: "redirect";
      url: string;
      setPendingCookie?: string;
      clearCookies?: boolean;
    }
  | { status: "error"; error: string; httpStatus: number; clearCookies?: boolean };

export function handleCalendarOAuthStart(input: {
  founderSessionOk: boolean;
  intentCookie?: string | null;
  signingSecret: string;
  nowMs?: number;
}): CalendarOAuthHandlerResult {
  const nowMs = input.nowMs ?? Date.now();
  const authorized =
    input.founderSessionOk ||
    Boolean(
      input.intentCookie &&
        parseCalendarOAuthIntent(input.intentCookie, input.signingSecret, nowMs),
    );
  if (!authorized) {
    return { status: "error", error: "unauthorized", httpStatus: 401 };
  }
  if (!isCalendarReadEnabled()) {
    return {
      status: "error",
      error: "calendar-activation-required",
      httpStatus: 503,
    };
  }
  const config = getCalendarOAuthClientConfig();
  if (!config.ok) {
    return { status: "error", error: config.error, httpStatus: 503 };
  }
  const pending = createCalendarOAuthPending(input.signingSecret, nowMs);
  const url = buildCalendarAuthUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state: pending.pending.state,
    codeChallenge: pending.challenge,
  });
  return { status: "redirect", url, setPendingCookie: pending.token };
}

export async function handleCalendarOAuthCallback(input: {
  url: URL;
  pendingCookie?: string | null;
  signingSecret: string;
  exchanger: CalendarOAuthTokenExchanger;
  fetchPrimaryEmail: (accessToken: string | null) => Promise<{ emailAddress: string }>;
  connections: CalendarConnectionStore;
  nowMs?: number;
  telemetry?: CalendarTelemetrySink;
  founderRedirect?: string;
  tokenKek?: Buffer;
  founderEmail?: string;
}): Promise<CalendarOAuthHandlerResult> {
  const nowMs = input.nowMs ?? Date.now();
  const telemetry = input.telemetry ?? noopCalendarTelemetry;
  const founderRedirect = input.founderRedirect ?? CONCIERGE_CALENDAR_PATH;
  const denied = input.url.searchParams.get("error");
  if (denied) {
    emitCalendarTelemetry(telemetry, {
      event: "calendar-oauth-failed",
      error_code: "oauth-denied",
    });
    return {
      status: "redirect",
      url: withCalendarQuery(founderRedirect, "oauth-denied"),
      clearCookies: true,
    };
  }

  const pending = input.pendingCookie
    ? parseCalendarOAuthPending(input.pendingCookie, input.signingSecret, nowMs)
    : null;
  if (!pending) {
    return {
      status: "error",
      error: "oauth-state-mismatch",
      httpStatus: 401,
      clearCookies: true,
    };
  }

  const state = input.url.searchParams.get("state");
  if (!oauthStatesMatch(pending.state, state)) {
    emitCalendarTelemetry(telemetry, {
      event: "calendar-oauth-failed",
      error_code: "oauth-state-mismatch",
    });
    return {
      status: "error",
      error: "oauth-state-mismatch",
      httpStatus: 401,
      clearCookies: true,
    };
  }

  const code = input.url.searchParams.get("code");
  if (!code) {
    return {
      status: "error",
      error: "oauth-code-missing",
      httpStatus: 400,
      clearCookies: true,
    };
  }

  let tokens: Awaited<ReturnType<CalendarOAuthTokenExchanger["exchangeCode"]>>;
  try {
    tokens = await input.exchanger.exchangeCode({
      code,
      codeVerifier: pending.codeVerifier,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "token-exchange-failed";
    if (message === "invalid_grant" || message.includes("invalid_grant")) {
      await applyCalendarInvalidGrant(input.connections, new Date(nowMs).toISOString());
      return {
        status: "redirect",
        url: withCalendarQuery(founderRedirect, "invalid_grant"),
        clearCookies: true,
      };
    }
    return {
      status: "redirect",
      url: withCalendarQuery(founderRedirect, "token-exchange-failed"),
      clearCookies: true,
    };
  }

  if (!calendarGrantIsReadOnly(tokens.scope ?? CALENDAR_READONLY_SCOPE)) {
    try {
      await input.exchanger.revokeToken(tokens.refreshToken);
    } catch {
      /* best-effort */
    }
    emitCalendarTelemetry(telemetry, {
      event: "calendar-oauth-failed",
      error_code: "calendar-scope-rejected",
    });
    return {
      status: "redirect",
      url: withCalendarQuery(founderRedirect, "calendar-scope-rejected"),
      clearCookies: true,
    };
  }

  const kek = input.tokenKek
    ? { ok: true as const, key: input.tokenKek }
    : loadCalendarTokenKek();
  if (!kek.ok) {
    try {
      await input.exchanger.revokeToken(tokens.refreshToken);
    } catch {
      /* best-effort */
    }
    return {
      status: "redirect",
      url: withCalendarQuery(founderRedirect, kek.error),
      clearCookies: true,
    };
  }

  let profileEmail: string;
  try {
    const profile = await input.fetchPrimaryEmail(tokens.accessToken);
    profileEmail = profile.emailAddress;
  } catch {
    try {
      await input.exchanger.revokeToken(tokens.refreshToken);
    } catch {
      /* best-effort */
    }
    return {
      status: "redirect",
      url: withCalendarQuery(founderRedirect, "token-exchange-failed"),
      clearCookies: true,
    };
  }

  const bound = bindFounderCalendar(profileEmail, input.founderEmail);
  if (!bound.ok) {
    try {
      await input.exchanger.revokeToken(tokens.refreshToken);
    } catch {
      /* best-effort */
    }
    emitCalendarTelemetry(telemetry, {
      event: "calendar-oauth-failed",
      error_code: bound.error,
    });
    return {
      status: "redirect",
      url: withCalendarQuery(founderRedirect, bound.error),
      clearCookies: true,
    };
  }

  const wrapped = encryptCalendarRefreshToken(tokens.refreshToken, kek.key);
  const existing = await input.connections.getFounderConnection();
  const connected = connectFounderCalendar({
    existing,
    calendarEmailHash: bound.calendarEmailHash,
    refreshToken: wrapped,
    grantedScope: CALENDAR_READONLY_SCOPE,
    providerTokenType: tokens.tokenType,
    now: new Date(nowMs).toISOString(),
  });
  await input.connections.putConnection(connected);
  emitCalendarTelemetry(telemetry, {
    event: "calendar-oauth-ok",
    status: "connected",
  });
  return {
    status: "redirect",
    url: withCalendarQuery(founderRedirect, "connected"),
    clearCookies: true,
  };
}

function withCalendarQuery(base: string, code: string): string {
  const url = new URL(base, "http://hourglass.local");
  url.searchParams.set("calendar", code);
  return `${url.pathname}${url.search}`;
}
