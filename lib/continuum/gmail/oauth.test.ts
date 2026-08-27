import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryGmailConnectionStore } from "./connection";
import {
  createGmailOAuthIntent,
  createGmailOAuthPending,
  oauthStatesMatch,
  pkceChallengeS256,
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

  it("does not treat unequal OAuth states as matching", () => {
    assert.equal(oauthStatesMatch("abc", "abd"), false);
    assert.equal(oauthStatesMatch("abc", null), false);
    assert.equal(oauthStatesMatch("abc", "abc"), true);
  });
});
