import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryCalendarConnectionStore, type CalendarConnectionStore } from "./connection";
import { createCalendarOAuthPending, type CalendarOAuthTokenExchanger } from "./oauth";
import { handleCalendarOAuthCallback } from "./handlers";
import {
  CALENDAR_OAUTH_CALLBACK_EVENT,
  CALENDAR_OAUTH_CALLBACK_FIELDS,
} from "./oauth-callback-telemetry";
import { CALENDAR_READONLY_SCOPE } from "./types";

const SECRET = "test-session-secret-at-least-32-chars!!";
const KEK = Buffer.from("c".repeat(64), "hex");
const FOUNDER = "founder-leak@hourglass.test";
const AUTH_CODE = "auth-code-SHOULD-NOT-LEAK";
const STATE_POISON = "state-SHOULD-NOT-LEAK";
const REFRESH = "refresh-SHOULD-NOT-LEAK";
const ACCESS = "access-SHOULD-NOT-LEAK";
const PROVIDER_ERROR = "redirect_uri_mismatch raw-provider-SHOULD-NOT-LEAK";

type CallbackEvent = Record<string, string | number | boolean | null>;

function capture(run: () => Promise<void>): Promise<CallbackEvent[]> {
  const events: CallbackEvent[] = [];
  const original = console.info;
  console.info = (message?: unknown) => {
    if (typeof message !== "string") return;
    try {
      const parsed = JSON.parse(message) as CallbackEvent;
      if (parsed.event === CALENDAR_OAUTH_CALLBACK_EVENT) events.push(parsed);
    } catch {
      events.push({ event: "unparsed", outcome: message });
    }
  };
  return run().finally(() => {
    console.info = original;
  }).then(() => events);
}

function exchanger(
  impl?: CalendarOAuthTokenExchanger["exchangeCode"],
): CalendarOAuthTokenExchanger & { revoked: string[] } {
  const revoked: string[] = [];
  return {
    revoked,
    async exchangeCode(input) {
      if (impl) return impl(input);
      return {
        refreshToken: REFRESH,
        accessToken: ACCESS,
        tokenType: "Bearer",
        scope: CALENDAR_READONLY_SCOPE,
      };
    },
    async revokeToken(token) {
      revoked.push(token);
    },
  };
}

function callbackUrl(pendingState: string, extra = ""): URL {
  return new URL(
    `http://localhost:3000/api/continuum/calendar/oauth/callback?code=${AUTH_CODE}&state=${pendingState}${extra}`,
  );
}

async function runCallback(input: {
  url: URL;
  pendingCookie?: string | null;
  exchanger: CalendarOAuthTokenExchanger;
  fetchPrimaryEmail?: (accessToken: string | null) => Promise<{ emailAddress: string }>;
  connections?: CalendarConnectionStore;
  tokenKek?: Buffer;
  founderEmail?: string;
}) {
  return handleCalendarOAuthCallback({
    url: input.url,
    pendingCookie: input.pendingCookie,
    signingSecret: SECRET,
    exchanger: input.exchanger,
    fetchPrimaryEmail:
      input.fetchPrimaryEmail ?? (async () => ({ emailAddress: FOUNDER })),
    connections: input.connections ?? new InMemoryCalendarConnectionStore(),
    founderRedirect: "/executive-dashboard/concierge/calendar",
    tokenKek: input.tokenKek === undefined ? KEK : input.tokenKek,
    founderEmail: input.founderEmail === undefined ? FOUNDER : input.founderEmail,
  });
}

function assertPrivate(event: CallbackEvent) {
  const serialized = JSON.stringify(event);
  for (const poison of [
    AUTH_CODE,
    STATE_POISON,
    REFRESH,
    ACCESS,
    FOUNDER,
    PROVIDER_ERROR,
    "redirect_uri_mismatch",
    KEK.toString("hex"),
    "continuum-calendar-secret",
  ]) {
    assert.equal(serialized.includes(poison), false, poison);
  }
  assert.deepEqual(Object.keys(event), [...CALENDAR_OAUTH_CALLBACK_FIELDS]);
}

describe("Calendar OAuth callback telemetry", () => {
  it("records a successful callback write and connected redirect", async () => {
    const pending = createCalendarOAuthPending(SECRET);
    const store = new InMemoryCalendarConnectionStore();
    const events = await capture(async () => {
      const result = await runCallback({
        url: callbackUrl(pending.pending.state),
        pendingCookie: pending.token,
        exchanger: exchanger(),
        connections: store,
      });
      assert.equal(result.status, "redirect");
      if (result.status === "redirect") assert.match(result.url, /calendar=connected/);
    });
    assert.equal(events.length, 1);
    assertPrivate(events[0]);
    assert.equal(events[0].stage, "redirect");
    assert.equal(events[0].outcome, "success_redirect");
    assert.equal(events[0].callbackStatus, 307);
    assert.equal(events[0].connectionWriteAttempted, true);
    assert.equal(events[0].connectionWriteSucceeded, true);
    assert.equal(events[0].redirectCode, "connected");
    assert.equal(events[0].stateValid, true);
    assert.equal(events[0].refreshTokenPresent, true);
    assert.equal(events[0].calendarReadonlyGranted, true);
    assert.equal(events[0].writeScopePresent, false);
    assert.ok(await store.getFounderConnection());
  });

  it("records google_denied without the provider error", async () => {
    const events = await capture(async () => {
      const result = await runCallback({
        url: new URL(
          `http://localhost:3000/api/continuum/calendar/oauth/callback?error=${PROVIDER_ERROR}`,
        ),
        exchanger: exchanger(),
      });
      assert.equal(result.status, "redirect");
      if (result.status === "redirect") assert.match(result.url, /calendar=oauth-denied/);
    });
    assert.equal(events[0].stage, "google_error");
    assert.equal(events[0].outcome, "google_denied");
    assert.equal(events[0].callbackStatus, 307);
    assert.equal(events[0].googleErrorPresent, true);
    assert.equal(events[0].tokenExchangeAttempted, false);
    assert.equal(events[0].redirectCode, "oauth-denied");
    assertPrivate(events[0]);
  });

  it("records state_invalid and keeps HTTP 401", async () => {
    const pending = createCalendarOAuthPending(SECRET);
    const events = await capture(async () => {
      const result = await runCallback({
        url: callbackUrl(STATE_POISON),
        pendingCookie: pending.token,
        exchanger: exchanger(),
      });
      assert.equal(result.status, "error");
      if (result.status === "error") {
        assert.equal(result.error, "oauth-state-mismatch");
        assert.equal(result.httpStatus, 401);
      }
    });
    assert.equal(events[0].outcome, "state_invalid");
    assert.equal(events[0].callbackStatus, 401);
    assert.equal(events[0].stateValid, false);
    assert.equal(events[0].redirectCode, "oauth-state-mismatch");
    assertPrivate(events[0]);
  });

  it("records missing_code and keeps HTTP 400", async () => {
    const pending = createCalendarOAuthPending(SECRET);
    const events = await capture(async () => {
      const result = await runCallback({
        url: new URL(
          `http://localhost:3000/api/continuum/calendar/oauth/callback?state=${pending.pending.state}`,
        ),
        pendingCookie: pending.token,
        exchanger: exchanger(),
      });
      assert.equal(result.status, "error");
      if (result.status === "error") {
        assert.equal(result.error, "oauth-code-missing");
        assert.equal(result.httpStatus, 400);
      }
    });
    assert.equal(events[0].stage, "state_validated");
    assert.equal(events[0].outcome, "missing_code");
    assert.equal(events[0].callbackStatus, 400);
    assert.equal(events[0].codePresent, false);
    assert.equal(events[0].stateValid, true);
    assert.equal(events[0].redirectCode, "oauth-code-missing");
    assertPrivate(events[0]);
  });

  it("records token_exchange_failed and keeps the existing redirect", async () => {
    const pending = createCalendarOAuthPending(SECRET);
    const store = new InMemoryCalendarConnectionStore();
    const events = await capture(async () => {
      const result = await runCallback({
        url: callbackUrl(pending.pending.state),
        pendingCookie: pending.token,
        connections: store,
        exchanger: exchanger(async () => {
          throw new Error(PROVIDER_ERROR);
        }),
      });
      assert.equal(result.status, "redirect");
      if (result.status === "redirect") {
        assert.match(result.url, /calendar=token-exchange-failed/);
      }
    });
    assert.equal(events[0].stage, "token_exchange");
    assert.equal(events[0].outcome, "token_exchange_failed");
    assert.equal(events[0].callbackStatus, 307);
    assert.equal(events[0].tokenExchangeAttempted, true);
    assert.equal(events[0].tokenExchangeSucceeded, false);
    assert.equal(events[0].redirectCode, "token-exchange-failed");
    assert.equal(await store.getFounderConnection(), null);
    assertPrivate(events[0]);
  });

  it("records missing_refresh_token on its own redirect code", async () => {
    const pending = createCalendarOAuthPending(SECRET);
    const events = await capture(async () => {
      const result = await runCallback({
        url: callbackUrl(pending.pending.state),
        pendingCookie: pending.token,
        exchanger: exchanger(async () => {
          throw new Error("missing-refresh-token");
        }),
      });
      assert.equal(result.status, "redirect");
      if (result.status === "redirect") {
        assert.match(result.url, /calendar=oauth-refresh-token-missing/);
      }
    });
    assert.equal(events[0].outcome, "missing_refresh_token");
    assert.equal(events[0].tokenExchangeSucceeded, true);
    assert.equal(events[0].refreshTokenPresent, false);
    assert.equal(events[0].connectionWriteAttempted, false);
    assert.equal(events[0].redirectCode, "oauth-refresh-token-missing");
    assertPrivate(events[0]);
  });

  it("records scope_missing and still rejects the grant", async () => {
    const pending = createCalendarOAuthPending(SECRET);
    const google = exchanger(async () => ({
      refreshToken: REFRESH,
      accessToken: ACCESS,
      tokenType: "Bearer",
      scope: "openid",
    }));
    const store = new InMemoryCalendarConnectionStore();
    const events = await capture(async () => {
      const result = await runCallback({
        url: callbackUrl(pending.pending.state),
        pendingCookie: pending.token,
        exchanger: google,
        connections: store,
      });
      assert.equal(result.status, "redirect");
      if (result.status === "redirect") {
        assert.match(result.url, /calendar=calendar-scope-rejected/);
      }
    });
    assert.equal(events[0].outcome, "scope_missing");
    assert.equal(events[0].calendarReadonlyGranted, false);
    assert.equal(events[0].writeScopePresent, false);
    assert.equal(events[0].redirectCode, "calendar-scope-rejected");
    assert.deepEqual(google.revoked, [REFRESH]);
    assert.equal(await store.getFounderConnection(), null);
    assertPrivate(events[0]);
  });

  it("records write_scope_rejected and still revokes", async () => {
    const pending = createCalendarOAuthPending(SECRET);
    const google = exchanger(async () => ({
      refreshToken: REFRESH,
      accessToken: ACCESS,
      tokenType: "Bearer",
      scope: "https://www.googleapis.com/auth/calendar",
    }));
    const events = await capture(async () => {
      const result = await runCallback({
        url: callbackUrl(pending.pending.state),
        pendingCookie: pending.token,
        exchanger: google,
      });
      assert.equal(result.status, "redirect");
      if (result.status === "redirect") {
        assert.match(result.url, /calendar=calendar-scope-rejected/);
      }
    });
    assert.equal(events[0].outcome, "write_scope_rejected");
    assert.equal(events[0].writeScopePresent, true);
    assert.equal(events[0].calendarReadonlyGranted, false);
    assert.deepEqual(google.revoked, [REFRESH]);
    assertPrivate(events[0]);
  });

  it("records identity_mismatch and keeps the mailbox redirect", async () => {
    const pending = createCalendarOAuthPending(SECRET);
    const google = exchanger();
    const events = await capture(async () => {
      const result = await runCallback({
        url: callbackUrl(pending.pending.state),
        pendingCookie: pending.token,
        exchanger: google,
        fetchPrimaryEmail: async () => ({ emailAddress: "other-leak@hourglass.test" }),
      });
      assert.equal(result.status, "redirect");
      if (result.status === "redirect") {
        assert.match(result.url, /calendar=calendar-wrong-mailbox/);
      }
    });
    assert.equal(events[0].outcome, "identity_mismatch");
    assert.equal(events[0].identityValidated, false);
    assert.equal(events[0].redirectCode, "calendar-wrong-mailbox");
    assert.equal(JSON.stringify(events[0]).includes("other-leak@hourglass.test"), false);
    assert.deepEqual(google.revoked, [REFRESH]);
    assertPrivate(events[0]);
  });

  it("records encryption_failed without storing a connection", async () => {
    const pending = createCalendarOAuthPending(SECRET);
    const store = new InMemoryCalendarConnectionStore();
    const google = exchanger();
    const events = await capture(async () => {
      const result = await runCallback({
        url: callbackUrl(pending.pending.state),
        pendingCookie: pending.token,
        exchanger: google,
        connections: store,
        tokenKek: Buffer.from("short"),
      });
      assert.equal(result.status, "redirect");
      if (result.status === "redirect") {
        assert.match(result.url, /calendar=oauth-encryption-failed/);
      }
    });
    assert.equal(events[0].outcome, "encryption_failed");
    assert.equal(events[0].encryptionAttempted, true);
    assert.equal(events[0].encryptionSucceeded, false);
    assert.equal(events[0].connectionWriteAttempted, false);
    assert.equal(await store.getFounderConnection(), null);
    assert.deepEqual(google.revoked, [REFRESH]);
    assertPrivate(events[0]);
  });

  it("records connection_write_failed and does not claim connected", async () => {
    const pending = createCalendarOAuthPending(SECRET);
    const store = new InMemoryCalendarConnectionStore();
    const google = exchanger();
    const events = await capture(async () => {
      const result = await runCallback({
        url: callbackUrl(pending.pending.state),
        pendingCookie: pending.token,
        exchanger: google,
        connections: {
          getFounderConnection: () => store.getFounderConnection(),
          putConnection: async () => {
            throw new Error("database-relation-SHOULD-NOT-LEAK");
          },
        },
      });
      assert.equal(result.status, "redirect");
      if (result.status === "redirect") {
        assert.match(result.url, /calendar=oauth-write-failed/);
      }
    });
    assert.equal(events[0].stage, "encrypted");
    assert.equal(events[0].outcome, "connection_write_failed");
    assert.equal(events[0].connectionWriteAttempted, true);
    assert.equal(events[0].connectionWriteSucceeded, false);
    assert.equal(events[0].redirectCode, "oauth-write-failed");
    assert.equal(JSON.stringify(events[0]).includes("database-relation-SHOULD-NOT-LEAK"), false);
    assert.equal(await store.getFounderConnection(), null);
    assert.deepEqual(google.revoked, [REFRESH]);
    assertPrivate(events[0]);
  });
});
