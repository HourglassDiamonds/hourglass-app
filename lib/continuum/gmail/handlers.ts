/**
 * OAuth start / callback handlers.
 * Founder session or signed session-transition intent required.
 * Callback never renders token material.
 */

import { bindFounderMailbox } from "./mailbox";
import {
  applyInvalidGrant,
  connectFounderMailbox,
  type GmailConnectionStore,
} from "./connection";
import { encryptRefreshToken, loadGmailTokenKek } from "./token-crypto";
import {
  buildGmailAuthUrl,
  createGmailOAuthPending,
  getGmailOAuthClientConfig,
  oauthStatesMatch,
  parseGmailOAuthIntent,
  parseGmailOAuthPending,
  type GmailOAuthTokenExchanger,
} from "./oauth";
import { GMAIL_READONLY_SCOPE } from "./types";
import { emitGmailTelemetry, type GmailTelemetrySink, noopGmailTelemetry } from "./logging";

export type OAuthHandlerResult =
  | {
      status: "redirect";
      url: string;
      setPendingCookie?: string;
      clearCookies?: boolean;
    }
  | { status: "error"; error: string; httpStatus: number; clearCookies?: boolean };

export function handleGmailOAuthStart(input: {
  founderSessionOk: boolean;
  intentCookie?: string | null;
  signingSecret: string;
  nowMs?: number;
}): OAuthHandlerResult {
  const nowMs = input.nowMs ?? Date.now();
  const authorized =
    input.founderSessionOk ||
    Boolean(
      input.intentCookie &&
        parseGmailOAuthIntent(input.intentCookie, input.signingSecret, nowMs),
    );
  if (!authorized) {
    return { status: "error", error: "unauthorized", httpStatus: 401 };
  }
  const config = getGmailOAuthClientConfig();
  if (!config.ok) {
    return { status: "error", error: config.error, httpStatus: 503 };
  }
  const pending = createGmailOAuthPending(input.signingSecret, nowMs);
  const url = buildGmailAuthUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state: pending.pending.state,
    codeChallenge: pending.challenge,
  });
  return { status: "redirect", url, setPendingCookie: pending.token };
}

export async function handleGmailOAuthCallback(input: {
  url: URL;
  pendingCookie?: string | null;
  signingSecret: string;
  exchanger: GmailOAuthTokenExchanger;
  fetchProfile: (accessToken: string | null) => Promise<{ emailAddress: string }>;
  connections: GmailConnectionStore;
  nowMs?: number;
  telemetry?: GmailTelemetrySink;
  founderRedirect: string;
  tokenKek?: Buffer;
  founderEmail?: string;
}): Promise<OAuthHandlerResult> {
  const nowMs = input.nowMs ?? Date.now();
  const telemetry = input.telemetry ?? noopGmailTelemetry;
  const denied = input.url.searchParams.get("error");
  if (denied) {
    emitGmailTelemetry(telemetry, {
      event: "gmail-oauth-failed",
      error_code: "oauth-denied",
    });
    return {
      status: "redirect",
      url: withGmailQuery(input.founderRedirect, "oauth-denied"),
      clearCookies: true,
    };
  }

  const pending = input.pendingCookie
    ? parseGmailOAuthPending(input.pendingCookie, input.signingSecret, nowMs)
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
    emitGmailTelemetry(telemetry, {
      event: "gmail-oauth-failed",
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

  let tokens: Awaited<ReturnType<GmailOAuthTokenExchanger["exchangeCode"]>>;
  try {
    tokens = await input.exchanger.exchangeCode({
      code,
      codeVerifier: pending.codeVerifier,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "token-exchange-failed";
    if (message === "invalid_grant" || message.includes("invalid_grant")) {
      await applyInvalidGrant(input.connections, new Date(nowMs).toISOString());
      return {
        status: "redirect",
        url: withGmailQuery(input.founderRedirect, "invalid_grant"),
        clearCookies: true,
      };
    }
    return {
      status: "redirect",
      url: withGmailQuery(input.founderRedirect, "token-exchange-failed"),
      clearCookies: true,
    };
  }

  const kek = input.tokenKek
    ? { ok: true as const, key: input.tokenKek }
    : loadGmailTokenKek();
  if (!kek.ok) {
    try {
      await input.exchanger.revokeToken(tokens.refreshToken);
    } catch {
      /* best-effort */
    }
    return {
      status: "redirect",
      url: withGmailQuery(input.founderRedirect, kek.error),
      clearCookies: true,
    };
  }

  let profileEmail: string;
  try {
    const profile = await input.fetchProfile(tokens.accessToken);
    profileEmail = profile.emailAddress;
  } catch {
    try {
      await input.exchanger.revokeToken(tokens.refreshToken);
    } catch {
      /* best-effort */
    }
    return {
      status: "redirect",
      url: withGmailQuery(input.founderRedirect, "token-exchange-failed"),
      clearCookies: true,
    };
  }

  const bound = bindFounderMailbox(profileEmail, input.founderEmail);
  if (!bound.ok) {
    try {
      await input.exchanger.revokeToken(tokens.refreshToken);
    } catch {
      /* best-effort */
    }
    emitGmailTelemetry(telemetry, {
      event: "gmail-oauth-failed",
      error_code: bound.error,
    });
    return {
      status: "redirect",
      url: withGmailQuery(input.founderRedirect, bound.error),
      clearCookies: true,
    };
  }

  if (tokens.scope && tokens.scope !== GMAIL_READONLY_SCOPE) {
    // Granted scope must remain gmail.readonly; extra scopes are not stored as success.
    if (!tokens.scope.split(/\s+/).includes(GMAIL_READONLY_SCOPE)) {
      try {
        await input.exchanger.revokeToken(tokens.refreshToken);
      } catch {
        /* best-effort */
      }
      return {
        status: "redirect",
        url: withGmailQuery(input.founderRedirect, "oauth-denied"),
        clearCookies: true,
      };
    }
  }

  const wrapped = encryptRefreshToken(tokens.refreshToken, kek.key);
  const existing = await input.connections.getFounderConnection();
  const connected = connectFounderMailbox({
    existing,
    mailboxEmailHash: bound.mailboxEmailHash,
    refreshToken: wrapped,
    grantedScope: GMAIL_READONLY_SCOPE,
    providerTokenType: tokens.tokenType,
    now: new Date(nowMs).toISOString(),
  });
  await input.connections.putConnection(connected);
  emitGmailTelemetry(telemetry, {
    event: "gmail-oauth-ok",
    status: "connected",
  });
  return {
    status: "redirect",
    url: withGmailQuery(input.founderRedirect, "connected"),
    clearCookies: true,
  };
}

function withGmailQuery(base: string, code: string): string {
  const url = new URL(base, "http://hourglass.local");
  url.searchParams.set("gmail", code);
  return `${url.pathname}${url.search}`;
}
