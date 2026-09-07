/**
 * Dedicated Continuum Calendar OAuth (calendar.readonly).
 * PKCE + state. Server-side authorization-code exchange.
 * Does not reuse Gmail OAuth client, refresh token env, or Gmail scopes.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import {
  getContinuumCalendarOAuthClientId,
  getContinuumCalendarOAuthClientSecret,
  getContinuumCalendarOAuthRedirectUri,
} from "./env";
import { CALENDAR_READONLY_SCOPE, CALENDAR_WRITE_SCOPES } from "./types";

export const CALENDAR_OAUTH_PKCE_COOKIE = "hgd_calendar_oauth_pkce";
export const CALENDAR_OAUTH_INTENT_COOKIE = "hgd_calendar_oauth_intent";
export const CALENDAR_OAUTH_COOKIE_PATH = "/api/continuum/calendar/oauth";
export const CALENDAR_OAUTH_TTL_SEC = 10 * 60;

export type CalendarOAuthPending = {
  v: 1;
  state: string;
  codeVerifier: string;
  iat: number;
  exp: number;
};

export type CalendarOAuthIntent = {
  v: 1;
  purpose: "calendar-oauth-start";
  username: string;
  iat: number;
  exp: number;
};

export type CalendarOAuthTokenSet = {
  refreshToken: string;
  accessToken: string | null;
  tokenType: string | null;
  scope: string | null;
};

export type CalendarOAuthTokenExchanger = {
  exchangeCode(input: {
    code: string;
    codeVerifier: string;
  }): Promise<CalendarOAuthTokenSet>;
  revokeToken(token: string): Promise<void>;
};

export type CalendarAccessTokenRefresh =
  | { ok: true; accessToken: string }
  | {
      ok: false;
      error:
        | "token-refresh-failed"
        | "refresh-token-rotated"
        | "oauth-not-configured";
    };

export type CalendarAccessTokenRefresher = {
  refreshAccessToken(refreshToken: string): Promise<CalendarAccessTokenRefresh>;
};

function b64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function hmacSign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function signaturesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function generatePkceVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function pkceChallengeS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function generateOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function signCalendarOAuthEnvelope(
  payload: CalendarOAuthPending | CalendarOAuthIntent,
  secret: string,
): string {
  const body = b64urlJson(payload);
  return `${body}.${hmacSign(body, secret)}`;
}

function parseSignedEnvelope<T extends { v: 1; iat: number; exp: number }>(
  token: string,
  secret: string,
  nowMs: number,
): T | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  if (!signaturesMatch(sig, hmacSign(body, secret))) return null;
  let payload: T;
  try {
    payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as T;
  } catch {
    return null;
  }
  if (payload.v !== 1) return null;
  const nowSec = Math.floor(nowMs / 1000);
  if (payload.exp <= nowSec) return null;
  if (payload.iat > nowSec + 60) return null;
  return payload;
}

export function parseCalendarOAuthPending(
  token: string,
  secret: string,
  nowMs = Date.now(),
): CalendarOAuthPending | null {
  const payload = parseSignedEnvelope<CalendarOAuthPending>(token, secret, nowMs);
  if (!payload) return null;
  if (typeof payload.state !== "string" || !payload.state) return null;
  if (typeof payload.codeVerifier !== "string" || !payload.codeVerifier) {
    return null;
  }
  return payload;
}

export function parseCalendarOAuthIntent(
  token: string,
  secret: string,
  nowMs = Date.now(),
): CalendarOAuthIntent | null {
  const payload = parseSignedEnvelope<CalendarOAuthIntent>(token, secret, nowMs);
  if (!payload) return null;
  if (payload.purpose !== "calendar-oauth-start") return null;
  if (typeof payload.username !== "string" || !payload.username) return null;
  return payload;
}

export function createCalendarOAuthPending(
  secret: string,
  nowMs = Date.now(),
): { token: string; pending: CalendarOAuthPending; challenge: string } {
  const iat = Math.floor(nowMs / 1000);
  const pending: CalendarOAuthPending = {
    v: 1,
    state: generateOAuthState(),
    codeVerifier: generatePkceVerifier(),
    iat,
    exp: iat + CALENDAR_OAUTH_TTL_SEC,
  };
  return {
    token: signCalendarOAuthEnvelope(pending, secret),
    pending,
    challenge: pkceChallengeS256(pending.codeVerifier),
  };
}

export function createCalendarOAuthIntent(
  username: string,
  secret: string,
  nowMs = Date.now(),
): { token: string; intent: CalendarOAuthIntent } {
  const iat = Math.floor(nowMs / 1000);
  const intent: CalendarOAuthIntent = {
    v: 1,
    purpose: "calendar-oauth-start",
    username,
    iat,
    exp: iat + CALENDAR_OAUTH_TTL_SEC,
  };
  return { token: signCalendarOAuthEnvelope(intent, secret), intent };
}

export function calendarOAuthCookieOptions(secure: boolean): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: CALENDAR_OAUTH_COOKIE_PATH,
    maxAge: CALENDAR_OAUTH_TTL_SEC,
  };
}

export function buildCalendarAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: CALENDAR_READONLY_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function getCalendarOAuthClientConfig():
  | {
      ok: true;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    }
  | { ok: false; error: "oauth-not-configured" } {
  const clientId = getContinuumCalendarOAuthClientId();
  const clientSecret = getContinuumCalendarOAuthClientSecret();
  const redirectUri = getContinuumCalendarOAuthRedirectUri();
  if (!clientId || !clientSecret || !redirectUri) {
    return { ok: false, error: "oauth-not-configured" };
  }
  return { ok: true, clientId, clientSecret, redirectUri };
}

function createDedicatedCalendarOAuth2Client(): OAuth2Client {
  const config = getCalendarOAuthClientConfig();
  if (!config.ok) throw new Error(config.error);
  return new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
}

export function grantedCalendarScopes(scope: string | null | undefined): string[] {
  if (!scope) return [];
  return scope.split(/\s+/).filter((item) => item.length > 0);
}

export function calendarGrantIsReadOnly(scope: string | null | undefined): boolean {
  const granted = grantedCalendarScopes(scope);
  if (!granted.includes(CALENDAR_READONLY_SCOPE)) return false;
  return !granted.some((item) =>
    (CALENDAR_WRITE_SCOPES as readonly string[]).includes(item),
  );
}

export function interpretCalendarTokenRefreshResponse(input: {
  accessToken?: string | null;
  returnedRefreshToken?: string | null;
  originalRefreshToken: string;
}): CalendarAccessTokenRefresh {
  if (
    input.returnedRefreshToken &&
    input.returnedRefreshToken !== input.originalRefreshToken
  ) {
    return { ok: false, error: "refresh-token-rotated" };
  }
  if (!input.accessToken) {
    return { ok: false, error: "token-refresh-failed" };
  }
  return { ok: true, accessToken: input.accessToken };
}

export async function refreshCalendarAccessToken(
  refreshToken: string,
): Promise<CalendarAccessTokenRefresh> {
  const config = getCalendarOAuthClientConfig();
  if (!config.ok) return { ok: false, error: "oauth-not-configured" };
  if (!refreshToken) return { ok: false, error: "token-refresh-failed" };
  const client = new OAuth2Client(
    config.clientId,
    config.clientSecret,
    config.redirectUri,
  );
  client.setCredentials({ refresh_token: refreshToken });
  try {
    const { credentials } = await client.refreshAccessToken();
    return interpretCalendarTokenRefreshResponse({
      accessToken: credentials.access_token,
      returnedRefreshToken: credentials.refresh_token,
      originalRefreshToken: refreshToken,
    });
  } catch {
    return { ok: false, error: "token-refresh-failed" };
  }
}

export const liveCalendarAccessTokenRefresher: CalendarAccessTokenRefresher = {
  refreshAccessToken: refreshCalendarAccessToken,
};

export const liveCalendarOAuthTokenExchanger: CalendarOAuthTokenExchanger = {
  async exchangeCode(input) {
    const client = createDedicatedCalendarOAuth2Client();
    const { tokens } = await client.getToken({
      code: input.code,
      codeVerifier: input.codeVerifier,
    });
    if (!tokens.refresh_token) {
      throw new Error("token-exchange-failed");
    }
    return {
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token ?? null,
      tokenType: tokens.token_type ?? "Bearer",
      scope: tokens.scope ?? CALENDAR_READONLY_SCOPE,
    };
  },
  async revokeToken(token) {
    const client = createDedicatedCalendarOAuth2Client();
    await client.revokeToken(token);
  },
};

export function oauthStatesMatch(expected: string, actual: string | null): boolean {
  if (!actual) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
