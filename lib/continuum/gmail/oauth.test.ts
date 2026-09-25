import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryGmailConnectionStore } from "./connection";
import {
  createGmailOAuthIntent,
  createGmailOAuthPending,
  classifyGmailRefreshThrown,
  interpretGmailTokenRefreshResponse,
  oauthStatesMatch,
  refreshGmailAccessToken,
  pkceChallengeS256,
  safeGmailOAuthTokenError,
  type GmailOAuthTokenExchanger,
} from "./oauth";
import { handleGmailOAuthCallback, handleGmailOAuthStart } from "./handlers";
import { GMAIL_READONLY_SCOPE } from "./types";

const SECRET = "test-session-secret-at-least-32-chars!!";
const KEK = Buffer.from("c".repeat(64), "hex");
const FOUNDER = "founder@hourglass.example";

function oauthEnv() {
  process.env.CONTINUUM_GMAIL_OAUTH_CLIENT_ID = "continuum-gmail-client";
  process.env.CONTINUUM_GMAIL_OAUTH_CLIENT_SECRET = "continuum-gmail-secret";
  process.env.CONTINUUM_GMAIL_OAUTH_REDIRECT_URI =
    "http://localhost:3000/api/continuum/gmail/oauth/callback";
}

function mockExchanger(
  overrides: Partial<GmailOAuthTokenExchanger> & {
    refreshToken?: string;
  } = {},
): GmailOAuthTokenExchanger & { codes: string[]; verifiers: string[]; revoked: string[] } {
  const codes: string[] = [];
  const verifiers: string[] = [];
  const revoked: string[] = [];
  return {
    codes,
    verifiers,
    revoked,
    async exchangeCode(input) {
      codes.push(input.code);
      verifiers.push(input.codeVerifier);
      if (overrides.exchangeCode) return overrides.exchangeCode(input);
      return {
        refreshToken: overrides.refreshToken ?? "refresh-abc",
        accessToken: "access-in-memory-only",
        tokenType: "Bearer",
        scope: GMAIL_READONLY_SCOPE,
      };
    },
    async revokeToken(token) {
      revoked.push(token);
      if (overrides.revokeToken) await overrides.revokeToken(token);
    },
  };
}

describe("Continuum Gmail OAuth", () => {
  it("fails closed without founder session or intent", () => {
    oauthEnv();
    const result = handleGmailOAuthStart({
      founderSessionOk: false,
      signingSecret: SECRET,
    });
    assert.equal(result.status, "error");
    if (result.status === "error") {
      assert.equal(result.error, "unauthorized");
      assert.equal(result.httpStatus, 401);
    }
  });

  it("starts with a session-transition intent and uses PKCE + gmail.readonly", () => {
    oauthEnv();
    const intent = createGmailOAuthIntent("founder", SECRET);
    const result = handleGmailOAuthStart({
      founderSessionOk: false,
      intentCookie: intent.token,
      signingSecret: SECRET,
    });
    assert.equal(result.status, "redirect");
    if (result.status !== "redirect") return;
    const url = new URL(result.url);
    assert.equal(url.origin, "https://accounts.google.com");
    assert.equal(
      url.searchParams.get("scope"),
      GMAIL_READONLY_SCOPE,
    );
    assert.equal(url.searchParams.get("access_type"), "offline");
    assert.equal(url.searchParams.get("prompt"), "consent");
    assert.equal(url.searchParams.get("include_granted_scopes"), "false");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.ok(url.searchParams.get("code_challenge"));
    assert.ok(url.searchParams.get("state"));
    assert.ok(result.setPendingCookie);
  });

  it("rejects a state mismatch", async () => {
    oauthEnv();
    const pending = createGmailOAuthPending(SECRET);
    const store = new InMemoryGmailConnectionStore();
    const exchanger = mockExchanger();
    const result = await handleGmailOAuthCallback({
      url: new URL(
        "http://localhost:3000/api/continuum/gmail/oauth/callback?code=abc&state=wrong",
      ),
      pendingCookie: pending.token,
      signingSecret: SECRET,
      exchanger,
      fetchProfile: async () => ({ emailAddress: FOUNDER }),
      connections: store,
      founderRedirect: "/executive-dashboard/concierge",
      tokenKek: KEK,
      founderEmail: FOUNDER,
    });
    assert.equal(result.status, "error");
    if (result.status === "error") {
      assert.equal(result.error, "oauth-state-mismatch");
    }
    assert.equal(await store.getFounderConnection(), null);
    assert.equal(exchanger.codes.length, 0);
  });

  it("sends the PKCE verifier on code exchange", async () => {
    oauthEnv();
    const pending = createGmailOAuthPending(SECRET);
    const store = new InMemoryGmailConnectionStore();
    const exchanger = mockExchanger();
    const result = await handleGmailOAuthCallback({
      url: new URL(
        `http://localhost:3000/api/continuum/gmail/oauth/callback?code=auth-code&state=${pending.pending.state}`,
      ),
      pendingCookie: pending.token,
      signingSecret: SECRET,
      exchanger,
      fetchProfile: async () => ({ emailAddress: FOUNDER }),
      connections: store,
      founderRedirect: "/executive-dashboard/concierge",
      tokenKek: KEK,
      founderEmail: FOUNDER,
    });
    assert.equal(result.status, "redirect");
    if (result.status === "redirect") {
      assert.match(result.url, /gmail=connected/);
      assert.equal(result.url.includes("refresh-abc"), false);
      assert.equal(result.url.includes("auth-code"), false);
      assert.equal(result.url.includes("access-in-memory"), false);
    }
    assert.deepEqual(exchanger.codes, ["auth-code"]);
    assert.deepEqual(exchanger.verifiers, [pending.pending.codeVerifier]);
    assert.equal(
      pkceChallengeS256(pending.pending.codeVerifier),
      pkceChallengeS256(exchanger.verifiers[0]),
    );
    const connection = await store.getFounderConnection();
    assert.equal(connection?.status, "connected");
    assert.ok(connection?.refreshToken);
    assert.notEqual(connection?.refreshToken?.ciphertext, "refresh-abc");
  });

  it("revokes and does not retain a wrong mailbox token", async () => {
    oauthEnv();
    const pending = createGmailOAuthPending(SECRET);
    const store = new InMemoryGmailConnectionStore();
    const exchanger = mockExchanger();
    const result = await handleGmailOAuthCallback({
      url: new URL(
        `http://localhost:3000/api/continuum/gmail/oauth/callback?code=auth-code&state=${pending.pending.state}`,
      ),
      pendingCookie: pending.token,
      signingSecret: SECRET,
      exchanger,
      fetchProfile: async () => ({ emailAddress: "other@example.com" }),
      connections: store,
      founderRedirect: "/executive-dashboard/concierge",
      tokenKek: KEK,
      founderEmail: FOUNDER,
    });
    assert.equal(result.status, "redirect");
    if (result.status === "redirect") {
      assert.match(result.url, /gmail=gmail-wrong-mailbox/);
    }
    assert.deepEqual(exchanger.revoked, ["refresh-abc"]);
    assert.equal(await store.getFounderConnection(), null);
  });

  it("redirects invalid_client without retaining a connection", async () => {
    oauthEnv();
    const pending = createGmailOAuthPending(SECRET);
    const store = new InMemoryGmailConnectionStore();
    const exchanger = mockExchanger({
      async exchangeCode() {
        throw new Error("invalid_client");
      },
    });
    const result = await handleGmailOAuthCallback({
      url: new URL(
        `http://localhost:3000/api/continuum/gmail/oauth/callback?code=auth-code&state=${pending.pending.state}`,
      ),
      pendingCookie: pending.token,
      signingSecret: SECRET,
      exchanger,
      fetchProfile: async () => ({ emailAddress: FOUNDER }),
      connections: store,
      founderRedirect: "/executive-dashboard/concierge",
      tokenKek: KEK,
      founderEmail: FOUNDER,
    });
    assert.equal(result.status, "redirect");
    if (result.status === "redirect") {
      assert.match(result.url, /gmail=invalid_client/);
    }
    assert.equal(await store.getFounderConnection(), null);
  });

  it("marks the connection revoked on invalid_grant", async () => {
    oauthEnv();
    const pending = createGmailOAuthPending(SECRET);
    const store = new InMemoryGmailConnectionStore();
    await store.putConnection({
      connectionId: "conn-1",
      mailboxSlot: "founder-v1",
      mailboxEmailHash: "abc",
      status: "connected",
      refreshToken: {
        alg: "aes-256-gcm",
        version: 1,
        iv: "a",
        tag: "b",
        ciphertext: "c",
      },
      grantedScope: GMAIL_READONLY_SCOPE,
      providerTokenType: "Bearer",
      connectedAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      lastSyncAt: null,
      statusErrorCode: null,
    });
    const exchanger = mockExchanger({
      async exchangeCode() {
        throw new Error("invalid_grant");
      },
    });
    const result = await handleGmailOAuthCallback({
      url: new URL(
        `http://localhost:3000/api/continuum/gmail/oauth/callback?code=auth-code&state=${pending.pending.state}`,
      ),
      pendingCookie: pending.token,
      signingSecret: SECRET,
      exchanger,
      fetchProfile: async () => ({ emailAddress: FOUNDER }),
      connections: store,
      founderRedirect: "/executive-dashboard/concierge",
      tokenKek: KEK,
      founderEmail: FOUNDER,
    });
    assert.equal(result.status, "redirect");
    if (result.status === "redirect") {
      assert.match(result.url, /gmail=invalid_grant/);
    }
    const connection = await store.getFounderConnection();
    assert.equal(connection?.status, "revoked");
    assert.equal(connection?.refreshToken, null);
    assert.equal(connection?.statusErrorCode, "invalid_grant");
  });

  it("maps Google token errors to safe codes without leaking descriptions", () => {
    assert.equal(
      safeGmailOAuthTokenError({
        response: { data: { error: "invalid_client", error_description: "secret" } },
      }),
      "invalid_client",
    );
    assert.equal(
      safeGmailOAuthTokenError({
        response: { data: { error: "redirect_uri_mismatch" } },
      }),
      "redirect_uri_mismatch",
    );
    assert.equal(
      safeGmailOAuthTokenError(new Error("token-exchange-failed")),
      "token-exchange-failed",
    );
    const serialized = JSON.stringify(
      safeGmailOAuthTokenError({
        response: { data: { error: "invalid_client", error_description: "secret" } },
      }),
    );
    assert.equal(serialized.includes("secret"), false);
  });

  it("does not treat unequal OAuth states as matching", () => {
    assert.equal(oauthStatesMatch("abc", "abd"), false);
    assert.equal(oauthStatesMatch("abc", null), false);
    assert.equal(oauthStatesMatch("abc", "abc"), true);
  });

  it("stops token refresh when Google returns a replacement refresh token", () => {
    const rotated = interpretGmailTokenRefreshResponse({
      accessToken: "access-new",
      returnedRefreshToken: "refresh-new",
      originalRefreshToken: "refresh-keep",
    });
    assert.deepEqual(rotated, { ok: false, error: "refresh-token-rotated" });
    const ok = interpretGmailTokenRefreshResponse({
      accessToken: "access-new",
      returnedRefreshToken: "refresh-keep",
      originalRefreshToken: "refresh-keep",
    });
    assert.deepEqual(ok, { ok: true, accessToken: "access-new" });
    const missing = interpretGmailTokenRefreshResponse({
      accessToken: null,
      originalRefreshToken: "refresh-keep",
    });
    assert.deepEqual(missing, { ok: false, error: "token-refresh-failed" });
  });

  it("maps refresh provider failures onto the safe category list", async () => {
    const secret = "do-not-log-provider-body";
    const cases = [
      [{ response: { status: 400, data: { error: "invalid_grant", error_description: secret } } }, "provider_invalid_grant"],
      [{ response: { status: 401, data: { error: "invalid_client", error_description: secret } } }, "provider_invalid_client"],
      [{ response: { status: 401, data: { error: "unauthorized_client", error_description: secret } } }, "provider_unauthorized_client"],
      [{ response: { status: 429, data: { error: "rate_limit_exceeded" } } }, "provider_rate_limited"],
      [{ response: { status: 503, data: { error: "backendError", error_description: secret } } }, "provider_5xx"],
      [{ code: "ETIMEDOUT", response: { data: { error_description: secret } } }, "provider_timeout"],
      [{ response: { status: 400, data: { error_description: secret } } }, "malformed_token_response"],
    ] as const;
    for (const [error, category] of cases) {
      assert.equal(classifyGmailRefreshThrown(error), category);
      assert.equal(JSON.stringify(category).includes(secret), false);
    }

    oauthEnv();
    const missingToken = await refreshGmailAccessToken("");
    assert.equal(missingToken.ok, false);
    if (!missingToken.ok) {
      assert.equal(missingToken.error, "token-refresh-failed");
      assert.equal(missingToken.refreshFailureCategory, "refresh_token_missing");
      assert.equal(missingToken.refreshRequestAttempted, false);
    }

    const saved = process.env.CONTINUUM_GMAIL_OAUTH_CLIENT_ID;
    delete process.env.CONTINUUM_GMAIL_OAUTH_CLIENT_ID;
    const missingClient = await refreshGmailAccessToken("refresh-keep");
    process.env.CONTINUUM_GMAIL_OAUTH_CLIENT_ID = saved;
    assert.equal(missingClient.ok, false);
    if (!missingClient.ok) {
      assert.equal(missingClient.error, "oauth-not-configured");
      assert.equal(missingClient.refreshFailureCategory, "oauth_client_missing");
      assert.equal(missingClient.refreshRequestAttempted, false);
    }
  });
});
