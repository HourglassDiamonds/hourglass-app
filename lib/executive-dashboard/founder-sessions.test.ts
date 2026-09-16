import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
  CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
} from "@/lib/continuum/runtime-env";
import { readExecutiveDashboardSession } from "./access";
import {
  confirmDurableFounderSession,
  createMemoryFounderSessionStore,
  isDurableFounderSessionStoreEnabled,
  persistDurableFounderSession,
  revokeDurableFounderSession,
  setFounderSessionStoreForTests,
  type FounderSessionStore,
} from "./founder-sessions";
import { CONTINUUM_FOUNDER_WEBAUTHN_USER_ID } from "./passkeys/config";
import {
  createFounderSessionId,
  createExecutiveDashboardSessionToken,
  executiveDashboardSessionCookieOptions,
  EXECUTIVE_DASHBOARD_SESSION_COOKIE,
  EXECUTIVE_DASHBOARD_SESSION_PATH,
  FOUNDER_SESSION_ID_PATTERN,
  shouldUseSecureExecutiveDashboardCookie,
  verifyExecutiveDashboardSessionToken,
} from "./session";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PREVIEW_URL = `https://${CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF}.supabase.co`;
const PRODUCTION_URL = `https://${CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`;

const PREVIEW_ISOLATED_ENV = {
  CONTINUUM_ENV: "preview",
  VERCEL_ENV: "preview",
  CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
  CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
  SUPABASE_URL: PREVIEW_URL,
  NODE_ENV: "development",
} as const;

const PRODUCTION_ENV = {
  CONTINUUM_ENV: "production",
  VERCEL_ENV: "production",
  VERCEL: "1",
  CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
  CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
  SUPABASE_URL: PRODUCTION_URL,
  NODE_ENV: "production",
} as const;

const username = "founder";
const sessionSecret = "test-session-secret-32chars-minimum!!";

async function withEnv(
  values: Record<string, string | undefined>,
  fn: () => Promise<void> | void,
): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function decodePayload(token: string): Record<string, unknown> {
  const body = token.split(".")[0] ?? "";
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
}

function createLegacySessionToken(
  user: string,
  secret: string,
  nowMs = Date.now(),
): string {
  const iat = Math.floor(nowMs / 1000);
  const body = Buffer.from(
    JSON.stringify({ v: 1, u: user, iat, exp: iat + 60 * 60 * 12 }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function createTrackingStore(): {
  store: FounderSessionStore;
  persists: number;
  lookups: number;
  revokes: number;
} {
  const inner = createMemoryFounderSessionStore();
  const counts = { persists: 0, lookups: 0, revokes: 0 };
  return {
    persists: 0,
    lookups: 0,
    revokes: 0,
    store: {
      async persist(row) {
        counts.persists += 1;
        await inner.persist(row);
      },
      async getActive(sessionId, nowMs) {
        counts.lookups += 1;
        return inner.getActive(sessionId, nowMs);
      },
      async revoke(sessionId, nowMs) {
        counts.revokes += 1;
        await inner.revoke(sessionId, nowMs);
      },
    },
    get persists() {
      return counts.persists;
    },
    get lookups() {
      return counts.lookups;
    },
    get revokes() {
      return counts.revokes;
    },
  };
}

const AUTH_ENV = {
  EXECUTIVE_DASHBOARD_USERNAME: username,
  EXECUTIVE_DASHBOARD_PASSWORD_HASH: "unused-for-session-tests",
  EXECUTIVE_DASHBOARD_SESSION_SECRET: sessionSecret,
};

describe("founder durable sessions", () => {
  afterEach(() => {
    setFounderSessionStoreForTests(null);
  });

  it("mints unpredictable session ids that do not contain founder identity", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 64; i += 1) {
      const id = createFounderSessionId();
      assert.match(id, FOUNDER_SESSION_ID_PATTERN);
      assert.doesNotMatch(id, /founder|justin|hourglass|@/i);
      assert.doesNotMatch(id, /203\.0\.113|127\.0\.0/);
      ids.add(id);
    }
    assert.equal(ids.size, 64);
    const now = Date.now();
    const first = createExecutiveDashboardSessionToken(
      username,
      sessionSecret,
      now,
    );
    const second = createExecutiveDashboardSessionToken(
      username,
      sessionSecret,
      now,
    );
    assert.notEqual(first, second);
    const payload = decodePayload(first);
    assert.deepEqual(Object.keys(payload).sort(), ["exp", "iat", "sid", "u", "v"]);
    assert.equal(payload.v, 1);
    assert.equal(payload.u, username);
    assert.equal(typeof payload.sid, "string");
    assert.doesNotMatch(String(payload.sid), /founder|@|203\.0\.113/);
    assert.doesNotMatch(JSON.stringify(payload), /password|passkey|oauth|gmail|refresh_token|credential/i);
  });

  it("rejects forged and expired cookies", () => {
    const token = createExecutiveDashboardSessionToken(username, sessionSecret);
    assert.equal(
      verifyExecutiveDashboardSessionToken(
        `${token.slice(0, -4)}xxxx`,
        sessionSecret,
        username,
      ),
      null,
    );
    const now = Date.now();
    const expired = createExecutiveDashboardSessionToken(
      username,
      sessionSecret,
      now - 60_000,
      30,
    );
    assert.equal(
      verifyExecutiveDashboardSessionToken(
        expired,
        sessionSecret,
        username,
        now + 120_000,
      ),
      null,
    );
  });

  it("accepts a valid Preview session and denies it after logout/revoke", async () => {
    const store = createMemoryFounderSessionStore();
    setFounderSessionStoreForTests(store);
    const now = Date.now();
    const sessionId = createFounderSessionId();
    await withEnv({ ...PREVIEW_ISOLATED_ENV, ...AUTH_ENV }, async () => {
      assert.equal(isDurableFounderSessionStoreEnabled(), true);
      const persisted = await persistDurableFounderSession({
        sessionId,
        founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
        issuedAtMs: now,
        expiresAtMs: now + 12 * 60 * 60 * 1000,
        revokedAtMs: null,
      });
      assert.equal(persisted.ok, true);
      const token = createExecutiveDashboardSessionToken(
        username,
        sessionSecret,
        now,
        12 * 60 * 60,
        sessionId,
      );
      const accepted = await readExecutiveDashboardSession(token, now);
      assert.equal(accepted.ok, true);

      const revoked = await revokeDurableFounderSession(sessionId, now + 1);
      assert.equal(revoked.ok, true);
      const row = store.rows().find((entry) => entry.sessionId === sessionId);
      assert.ok(row?.revokedAtMs != null);
      const copied = await readExecutiveDashboardSession(token, now + 1);
      assert.equal(copied.ok, false);
      if (!copied.ok) assert.equal(copied.reason, "invalid-session");
    });
  });

  it("keeps Production stateless and never calls the durable store", async () => {
    const tracking = createTrackingStore();
    setFounderSessionStoreForTests(tracking.store);
    const now = Date.now();
    const token = createExecutiveDashboardSessionToken(
      username,
      sessionSecret,
      now,
    );
    const legacy = createLegacySessionToken(username, sessionSecret, now);
    await withEnv({ ...PRODUCTION_ENV, ...AUTH_ENV }, async () => {
      assert.equal(isDurableFounderSessionStoreEnabled(), false);
      const persisted = await persistDurableFounderSession({
        sessionId: createFounderSessionId(),
        founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
        issuedAtMs: now,
        expiresAtMs: now + 1000,
        revokedAtMs: null,
      });
      const confirmed = await confirmDurableFounderSession("anything", now);
      const revoked = await revokeDurableFounderSession("anything", now);
      const current = await readExecutiveDashboardSession(token, now);
      const old = await readExecutiveDashboardSession(legacy, now);
      assert.equal(persisted.ok, true);
      assert.equal(confirmed.ok, true);
      assert.equal(revoked.ok, true);
      assert.equal(current.ok, true);
      assert.equal(old.ok, true);
      assert.equal(tracking.persists, 0);
      assert.equal(tracking.lookups, 0);
      assert.equal(tracking.revokes, 0);
    });
  });

  it("fails closed in Preview when the durable store is unavailable", async () => {
    setFounderSessionStoreForTests({
      async persist() {
        throw new Error("db down");
      },
      async getActive() {
        throw new Error("db down");
      },
      async revoke() {
        throw new Error("db down");
      },
    });
    const now = Date.now();
    const token = createExecutiveDashboardSessionToken(
      username,
      sessionSecret,
      now,
    );
    await withEnv({ ...PREVIEW_ISOLATED_ENV, ...AUTH_ENV }, async () => {
      const persisted = await persistDurableFounderSession({
        sessionId: createFounderSessionId(),
        founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
        issuedAtMs: now,
        expiresAtMs: now + 1000,
        revokedAtMs: null,
      });
      assert.equal(persisted.ok, false);
      const session = await readExecutiveDashboardSession(token, now);
      assert.equal(session.ok, false);
      if (!session.ok) assert.equal(session.reason, "invalid-session");
      const revoked = await revokeDurableFounderSession(
        String(decodePayload(token).sid),
        now,
      );
      assert.equal(revoked.ok, false);
    });
  });

  it("denies a Preview cookie whose durable row is missing or expired", async () => {
    const store = createMemoryFounderSessionStore();
    setFounderSessionStoreForTests(store);
    const now = Date.now();
    const missingId = createFounderSessionId();
    const expiredId = createFounderSessionId();
    await withEnv({ ...PREVIEW_ISOLATED_ENV, ...AUTH_ENV }, async () => {
      const missingToken = createExecutiveDashboardSessionToken(
        username,
        sessionSecret,
        now,
        12 * 60 * 60,
        missingId,
      );
      const missing = await readExecutiveDashboardSession(missingToken, now);
      assert.equal(missing.ok, false);
      if (!missing.ok) assert.equal(missing.reason, "invalid-session");

      await persistDurableFounderSession({
        sessionId: expiredId,
        founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
        issuedAtMs: now - 2000,
        expiresAtMs: now - 1000,
        revokedAtMs: null,
      });
      const expiredToken = createExecutiveDashboardSessionToken(
        username,
        sessionSecret,
        now,
        12 * 60 * 60,
        expiredId,
      );
      const expired = await readExecutiveDashboardSession(expiredToken, now);
      assert.equal(expired.ok, false);
      if (!expired.ok) assert.equal(expired.reason, "invalid-session");
    });
  });

  it("denies a Preview cookie that has no durable session id", async () => {
    setFounderSessionStoreForTests(createMemoryFounderSessionStore());
    const legacy = createLegacySessionToken(username, sessionSecret);
    await withEnv({ ...PREVIEW_ISOLATED_ENV, ...AUTH_ENV }, async () => {
      const session = await readExecutiveDashboardSession(legacy);
      assert.equal(session.ok, false);
    });
  });

  it("preserves cookie flags, login next= defense, and shared issue path", async () => {
    const options = executiveDashboardSessionCookieOptions(true);
    assert.equal(options.httpOnly, true);
    assert.equal(options.sameSite, "lax");
    assert.equal(options.path, EXECUTIVE_DASHBOARD_SESSION_PATH);
    assert.equal(EXECUTIVE_DASHBOARD_SESSION_COOKIE, "hgd_ed_session");
    await withEnv({ VERCEL: "1" }, () => {
      assert.equal(shouldUseSecureExecutiveDashboardCookie(), true);
    });

    const actions = readFileSync(
      join(ROOT, "app", "executive-dashboard", "actions.ts"),
      "utf8",
    );
    const passkeyActions = readFileSync(
      join(ROOT, "app", "executive-dashboard", "passkey-actions.ts"),
      "utf8",
    );
    const pairActions = readFileSync(
      join(
        ROOT,
        "app",
        "executive-dashboard",
        "security",
        "passkeys",
        "pair",
        "actions.ts",
      ),
      "utf8",
    );
    const issue = readFileSync(
      join(ROOT, "lib", "executive-dashboard", "issue-session.ts"),
      "utf8",
    );
    const loginForm = readFileSync(
      join(ROOT, "app", "executive-dashboard", "login-form.tsx"),
      "utf8",
    );
    const destination = readFileSync(
      join(ROOT, "lib", "continuum", "operating-shell", "login-destination.ts"),
      "utf8",
    );
    const challenges = readFileSync(
      join(ROOT, "lib", "executive-dashboard", "passkeys", "challenges.ts"),
      "utf8",
    );
    const pairing = readFileSync(
      join(ROOT, "lib", "executive-dashboard", "passkeys", "pairing.ts"),
      "utf8",
    );
    const proxy = readFileSync(join(ROOT, "proxy.ts"), "utf8");

    assert.match(issue, /persistDurableFounderSession/);
    assert.match(issue, /createFounderSessionId/);
    assert.match(actions, /issueExecutiveDashboardSession/);
    assert.match(actions, /resolveFounderLoginDestination/);
    assert.match(actions, /revokeDurableFounderSession/);
    assert.match(actions, /maxAge:\s*0/);
    assert.doesNotMatch(actions, /if \(.*revok/);
    assert.match(passkeyActions, /issueExecutiveDashboardSession/);
    assert.match(pairActions, /issueExecutiveDashboardSession/);
    assert.match(loginForm, /name="next"/);
    assert.match(destination, /safeFounderLoginDestination/);
    assert.match(destination, /decoded\.startsWith\("\/\/"\)/);
    assert.match(challenges, /PASSKEY_CHALLENGE_COOKIE/);
    assert.match(challenges, /v: 2/);
    assert.doesNotMatch(challenges, /continuum_founder_sessions/);
    assert.match(pairing, /hashPairingToken/);
    assert.doesNotMatch(pairing, /continuum_founder_sessions/);
    assert.match(proxy, /export async function proxy/);
    assert.match(proxy, /await readExecutiveDashboardSession/);
  });
});
