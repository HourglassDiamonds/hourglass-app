import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryCalendarConnectionStore } from "./connection";
import {
  calendarGrantIsReadOnly,
  createCalendarOAuthIntent,
  createCalendarOAuthPending,
  interpretCalendarTokenRefreshResponse,
  oauthStatesMatch,
  pkceChallengeS256,
  type CalendarOAuthTokenExchanger,
} from "./oauth";
import {
  handleCalendarOAuthCallback,
  handleCalendarOAuthStart,
} from "./handlers";
import { CALENDAR_READONLY_SCOPE } from "./types";

const SECRET = "test-session-secret-at-least-32-chars!!";
const KEK = Buffer.from("c".repeat(64), "hex");
const FOUNDER = "founder@hourglass.example";

function oauthEnv() {
  process.env.CONTINUUM_CALENDAR_OAUTH_CLIENT_ID = "continuum-calendar-client";
  process.env.CONTINUUM_CALENDAR_OAUTH_CLIENT_SECRET = "continuum-calendar-secret";
  process.env.CONTINUUM_CALENDAR_OAUTH_REDIRECT_URI =
    "http://localhost:3000/api/continuum/calendar/oauth/callback";
  process.env.CONTINUUM_CALENDAR_READ_ENABLED = "true";
}

function mockExchanger(
  overrides: Partial<CalendarOAuthTokenExchanger> & {
    refreshToken?: string;
    scope?: string;
  } = {},
): CalendarOAuthTokenExchanger & { codes: string[]; verifiers: string[]; revoked: string[] } {
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
        scope: overrides.scope ?? CALENDAR_READONLY_SCOPE,
      };
    },
    async revokeToken(token) {
      revoked.push(token);
      if (overrides.revokeToken) await overrides.revokeToken(token);
    },
  };
}

describe("Continuum Calendar OAuth", () => {
  it("fails closed without founder session or intent", () => {
    oauthEnv();
    const result = handleCalendarOAuthStart({
      founderSessionOk: false,
      signingSecret: SECRET,
    });
    assert.equal(result.status, "error");
    if (result.status === "error") {
      assert.equal(result.error, "unauthorized");
      assert.equal(result.httpStatus, 401);
    }
  });

  it("blocks OAuth start when Calendar read activation is off", () => {
    oauthEnv();
    process.env.CONTINUUM_CALENDAR_READ_ENABLED = "false";
    const result = handleCalendarOAuthStart({
      founderSessionOk: true,
      signingSecret: SECRET,
    });
    assert.equal(result.status, "error");
    if (result.status === "error") {
      assert.equal(result.error, "calendar-activation-required");
    }
  });

  it("starts with PKCE and calendar.readonly only", () => {
    oauthEnv();
    const intent = createCalendarOAuthIntent("founder", SECRET);
    const result = handleCalendarOAuthStart({
      founderSessionOk: false,
      intentCookie: intent.token,
      signingSecret: SECRET,
    });
    assert.equal(result.status, "redirect");
    if (result.status !== "redirect") return;
    const url = new URL(result.url);
    assert.equal(url.origin, "https://accounts.google.com");
    assert.equal(url.searchParams.get("scope"), CALENDAR_READONLY_SCOPE);
    assert.equal(url.searchParams.get("include_granted_scopes"), "false");
    assert.equal(url.searchParams.get("prompt"), "consent");
    assert.equal(url.searchParams.get("access_type"), "offline");
    assert.ok(url.searchParams.get("code_challenge"));
    assert.equal(
      url.searchParams.get("scope")?.includes("gmail.readonly"),
      false,
    );
  });

  it("sends the PKCE verifier and stores encrypted refresh only", async () => {
    oauthEnv();
    const pending = createCalendarOAuthPending(SECRET);
    const store = new InMemoryCalendarConnectionStore();
    const exchanger = mockExchanger();
    const result = await handleCalendarOAuthCallback({
      url: new URL(
        `http://localhost:3000/api/continuum/calendar/oauth/callback?code=auth-code&state=${pending.pending.state}`,
      ),
      pendingCookie: pending.token,
      signingSecret: SECRET,
      exchanger,
      fetchPrimaryEmail: async () => ({ emailAddress: FOUNDER }),
      connections: store,
      founderRedirect: "/executive-dashboard/concierge/calendar",
      tokenKek: KEK,
      founderEmail: FOUNDER,
    });
    assert.equal(result.status, "redirect");
    if (result.status === "redirect") {
      assert.match(result.url, /calendar=connected/);
      assert.equal(result.url.includes("refresh-abc"), false);
      assert.equal(result.url.includes("auth-code"), false);
    }
    assert.deepEqual(exchanger.codes, ["auth-code"]);
    assert.equal(
      pkceChallengeS256(pending.pending.codeVerifier),
      pkceChallengeS256(exchanger.verifiers[0]),
    );
    const connection = await store.getFounderConnection();
    assert.equal(connection?.grantedScope, CALENDAR_READONLY_SCOPE);
    assert.notEqual(connection?.refreshToken?.ciphertext, "refresh-abc");
  });

  it("revokes write-capable Calendar grants", async () => {
    oauthEnv();
    const pending = createCalendarOAuthPending(SECRET);
    const store = new InMemoryCalendarConnectionStore();
    const exchanger = mockExchanger({
      scope: "https://www.googleapis.com/auth/calendar",
    });
    const result = await handleCalendarOAuthCallback({
      url: new URL(
        `http://localhost:3000/api/continuum/calendar/oauth/callback?code=auth-code&state=${pending.pending.state}`,
      ),
      pendingCookie: pending.token,
      signingSecret: SECRET,
      exchanger,
      fetchPrimaryEmail: async () => ({ emailAddress: FOUNDER }),
      connections: store,
      founderRedirect: "/executive-dashboard/concierge/calendar",
      tokenKek: KEK,
      founderEmail: FOUNDER,
    });
    assert.equal(result.status, "redirect");
    if (result.status === "redirect") {
      assert.match(result.url, /calendar-scope-rejected/);
    }
    assert.deepEqual(exchanger.revoked, ["refresh-abc"]);
    assert.equal(await store.getFounderConnection(), null);
    assert.equal(calendarGrantIsReadOnly("https://www.googleapis.com/auth/calendar"), false);
  });

  it("revokes a wrong mailbox token", async () => {
    oauthEnv();
    const pending = createCalendarOAuthPending(SECRET);
    const store = new InMemoryCalendarConnectionStore();
    const exchanger = mockExchanger();
    const result = await handleCalendarOAuthCallback({
      url: new URL(
        `http://localhost:3000/api/continuum/calendar/oauth/callback?code=auth-code&state=${pending.pending.state}`,
      ),
      pendingCookie: pending.token,
      signingSecret: SECRET,
      exchanger,
      fetchPrimaryEmail: async () => ({ emailAddress: "other@example.com" }),
      connections: store,
      founderRedirect: "/executive-dashboard/concierge/calendar",
      tokenKek: KEK,
      founderEmail: FOUNDER,
    });
    assert.equal(result.status, "redirect");
    if (result.status === "redirect") {
      assert.match(result.url, /calendar-wrong-mailbox/);
    }
    assert.deepEqual(exchanger.revoked, ["refresh-abc"]);
  });

  it("does not treat unequal OAuth states as matching", () => {
    assert.equal(oauthStatesMatch("abc", "abd"), false);
    assert.equal(oauthStatesMatch("abc", null), false);
    assert.equal(oauthStatesMatch("abc", "abc"), true);
  });

  it("stops token refresh when Google returns a replacement refresh token", () => {
    const rotated = interpretCalendarTokenRefreshResponse({
      accessToken: "access-new",
      returnedRefreshToken: "refresh-new",
      originalRefreshToken: "refresh-keep",
    });
    assert.deepEqual(rotated, { ok: false, error: "refresh-token-rotated" });
  });
});
