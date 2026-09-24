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
  observeCalendarGrant,
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
import {
  CALENDAR_OAUTH_CALLBACK_REDIRECT_STATUS,
  createCalendarOauthCallbackReport,
  emitCalendarOauthCallback,
  type CalendarOauthCallbackOutcome,
  type CalendarOauthCallbackRedirectCode,
  type CalendarOauthCallbackReport,
  type CalendarOauthCallbackStage,
} from "./oauth-callback-telemetry";

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
  const report = createCalendarOauthCallbackReport({
    googleErrorPresent: input.url.searchParams.has("error"),
    codePresent: input.url.searchParams.has("code"),
  });
  try {
    return await runCalendarOAuthCallback(input, {
      nowMs,
      telemetry,
      founderRedirect,
      report,
    });
  } catch (error) {
    if (report.outcome === "unknown_failure" && report.callbackStatus === 0) {
      report.callbackStatus = 500;
    }
    throw error;
  } finally {
    emitCalendarOauthCallback(report);
  }
}

async function runCalendarOAuthCallback(
  input: {
    url: URL;
    pendingCookie?: string | null;
    signingSecret: string;
    exchanger: CalendarOAuthTokenExchanger;
    fetchPrimaryEmail: (accessToken: string | null) => Promise<{ emailAddress: string }>;
    connections: CalendarConnectionStore;
    tokenKek?: Buffer;
    founderEmail?: string;
  },
  ctx: {
    nowMs: number;
    telemetry: CalendarTelemetrySink;
    founderRedirect: string;
    report: CalendarOauthCallbackReport;
  },
): Promise<CalendarOAuthHandlerResult> {
  const { report, founderRedirect, telemetry, nowMs } = ctx;
  if (report.googleErrorPresent) {
    emitCalendarTelemetry(telemetry, {
      event: "calendar-oauth-failed",
      error_code: "oauth-denied",
    });
    return finishRedirect(report, founderRedirect, "oauth-denied", {
      stage: "google_error",
      outcome: "google_denied",
    });
  }

  const pending = input.pendingCookie
    ? parseCalendarOAuthPending(input.pendingCookie, input.signingSecret, nowMs)
    : null;
  if (!pending) {
    return finishError(report, "oauth-state-mismatch", 401, {
      stage: "request",
      outcome: "state_invalid",
      stateValid: false,
    });
  }

  const state = input.url.searchParams.get("state");
  if (!oauthStatesMatch(pending.state, state)) {
    emitCalendarTelemetry(telemetry, {
      event: "calendar-oauth-failed",
      error_code: "oauth-state-mismatch",
    });
    return finishError(report, "oauth-state-mismatch", 401, {
      stage: "request",
      outcome: "state_invalid",
      stateValid: false,
    });
  }
  report.stateValid = true;
  report.stage = "state_validated";

  const code = input.url.searchParams.get("code");
  if (!code) {
    return finishError(report, "oauth-code-missing", 400, {
      stage: "state_validated",
      outcome: "missing_code",
    });
  }

  report.tokenExchangeAttempted = true;
  report.stage = "token_exchange";
  let tokens: Awaited<ReturnType<CalendarOAuthTokenExchanger["exchangeCode"]>>;
  try {
    tokens = await input.exchanger.exchangeCode({
      code,
      codeVerifier: pending.codeVerifier,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "token-exchange-failed";
    if (message === "missing-refresh-token") {
      report.tokenExchangeSucceeded = true;
      report.refreshTokenPresent = false;
      return finishRedirect(report, founderRedirect, "oauth-refresh-token-missing", {
        stage: "token_validated",
        outcome: "missing_refresh_token",
      });
    }
    report.tokenExchangeSucceeded = false;
    if (message === "invalid_grant" || message.includes("invalid_grant")) {
      await applyCalendarInvalidGrant(input.connections, new Date(nowMs).toISOString());
      return finishRedirect(report, founderRedirect, "invalid_grant", {
        stage: "token_exchange",
        outcome: "token_exchange_failed",
      });
    }
    return finishRedirect(report, founderRedirect, "token-exchange-failed", {
      stage: "token_exchange",
      outcome: "token_exchange_failed",
    });
  }

  report.tokenExchangeSucceeded = true;
  const refreshPresent = Boolean(tokens.refreshToken);
  report.refreshTokenPresent = refreshPresent;
  if (!refreshPresent) {
    return finishRedirect(report, founderRedirect, "oauth-refresh-token-missing", {
      stage: "token_validated",
      outcome: "missing_refresh_token",
    });
  }
  report.stage = "token_validated";

  const observed = observeCalendarGrant(tokens.scope);
  report.calendarReadonlyGranted = observed.calendarReadonlyGranted;
  report.writeScopePresent = observed.writeScopePresent;
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
    const outcome: CalendarOauthCallbackOutcome = observed.writeScopePresent
      ? "write_scope_rejected"
      : "scope_missing";
    return finishRedirect(report, founderRedirect, "calendar-scope-rejected", {
      stage: "token_validated",
      outcome,
    });
  }
  report.stage = "scope_validated";

  const kek = input.tokenKek
    ? { ok: true as const, key: input.tokenKek }
    : loadCalendarTokenKek();
  if (!kek.ok) {
    try {
      await input.exchanger.revokeToken(tokens.refreshToken);
    } catch {
      /* best-effort */
    }
    const outcome: CalendarOauthCallbackOutcome =
      kek.error === "token-kek-missing" ? "kek_missing" : "encryption_failed";
    return finishRedirect(report, founderRedirect, kek.error, {
      stage: "scope_validated",
      outcome,
    });
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
    report.identityValidated = false;
    return finishRedirect(report, founderRedirect, "token-exchange-failed", {
      stage: "scope_validated",
      outcome: "unknown_failure",
    });
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
    report.identityValidated = false;
    return finishRedirect(report, founderRedirect, bound.error, {
      stage: "scope_validated",
      outcome: "identity_mismatch",
    });
  }
  report.identityValidated = true;
  report.stage = "identity_validated";

  let wrapped: ReturnType<typeof encryptCalendarRefreshToken>;
  report.encryptionAttempted = true;
  try {
    wrapped = encryptCalendarRefreshToken(tokens.refreshToken, kek.key);
    report.encryptionSucceeded = true;
  } catch {
    report.encryptionSucceeded = false;
    try {
      await input.exchanger.revokeToken(tokens.refreshToken);
    } catch {
      /* best-effort */
    }
    return finishRedirect(report, founderRedirect, "oauth-encryption-failed", {
      stage: "identity_validated",
      outcome: "encryption_failed",
    });
  }
  report.stage = "encrypted";

  const existing = await input.connections.getFounderConnection();
  const connected = connectFounderCalendar({
    existing,
    calendarEmailHash: bound.calendarEmailHash,
    refreshToken: wrapped,
    grantedScope: CALENDAR_READONLY_SCOPE,
    providerTokenType: tokens.tokenType,
    now: new Date(nowMs).toISOString(),
  });
  report.connectionWriteAttempted = true;
  try {
    await input.connections.putConnection(connected);
    report.connectionWriteSucceeded = true;
  } catch {
    report.connectionWriteSucceeded = false;
    try {
      await input.exchanger.revokeToken(tokens.refreshToken);
    } catch {
      /* best-effort */
    }
    return finishRedirect(report, founderRedirect, "oauth-write-failed", {
      stage: "encrypted",
      outcome: "connection_write_failed",
    });
  }
  report.stage = "connection_written";
  emitCalendarTelemetry(telemetry, {
    event: "calendar-oauth-ok",
    status: "connected",
  });
  return finishRedirect(report, founderRedirect, "connected", {
    stage: "redirect",
    outcome: "success_redirect",
  });
}

function finishRedirect(
  report: CalendarOauthCallbackReport,
  founderRedirect: string,
  code: CalendarOauthCallbackRedirectCode,
  patch: {
    stage: CalendarOauthCallbackStage;
    outcome: CalendarOauthCallbackOutcome;
    stateValid?: boolean;
  },
): CalendarOAuthHandlerResult {
  report.stage = patch.stage;
  report.outcome = patch.outcome;
  report.callbackStatus = CALENDAR_OAUTH_CALLBACK_REDIRECT_STATUS;
  report.redirectCode = code;
  if (patch.stateValid != null) report.stateValid = patch.stateValid;
  return {
    status: "redirect",
    url: withCalendarQuery(founderRedirect, code),
    clearCookies: true,
  };
}

function finishError(
  report: CalendarOauthCallbackReport,
  code: "oauth-state-mismatch" | "oauth-code-missing",
  httpStatus: number,
  patch: {
    stage: CalendarOauthCallbackStage;
    outcome: CalendarOauthCallbackOutcome;
    stateValid?: boolean;
  },
): CalendarOAuthHandlerResult {
  report.stage = patch.stage;
  report.outcome = patch.outcome;
  report.callbackStatus = httpStatus;
  report.redirectCode = code;
  if (patch.stateValid != null) report.stateValid = patch.stateValid;
  return {
    status: "error",
    error: code,
    httpStatus,
    clearCookies: true,
  };
}

function withCalendarQuery(base: string, code: string): string {
  const url = new URL(base, "http://hourglass.local");
  url.searchParams.set("calendar", code);
  return `${url.pathname}${url.search}`;
}
