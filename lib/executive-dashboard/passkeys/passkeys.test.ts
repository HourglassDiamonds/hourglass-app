import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  EXECUTIVE_DASHBOARD_PASSKEY_AUTH_ERROR,
  isExecutiveDashboardSecurityPath,
} from "../access";
import {
  buildExecutiveDashboardSessionCookie,
  createExecutiveDashboardSessionToken,
  EXECUTIVE_DASHBOARD_SESSION_COOKIE,
  EXECUTIVE_DASHBOARD_SESSION_MAX_AGE_SEC,
  EXECUTIVE_DASHBOARD_SESSION_PATH,
} from "../session";
import {
  completePasskeyAuthentication,
  beginPasskeyAuthentication,
  revokeFounderPasskey,
} from "./authenticate";
import {
  createPasskeyChallengeToken,
  readPasskeyChallengeCookie,
  sessionFingerprint,
} from "./challenges";
import { InMemoryPasskeyChallengeLedger } from "./challenge-ledger";
import {
  CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
  CONTINUUM_PRODUCTION_WEBAUTHN_ORIGIN,
  CONTINUUM_PRODUCTION_WEBAUTHN_RP_ID,
  getContinuumWebAuthnRelyingParty,
  isWebAuthnRpIdValidForOrigin,
} from "./config";
import type { PasskeyCrypto } from "./crypto";
import {
  checkPasskeyChallengeIssueRateLimit,
  checkPasskeyVerifyRateLimit,
  PASSKEY_CHALLENGE_ISSUE_MAX,
  PASSKEY_VERIFY_FAILURE_MAX,
  recordPasskeyVerifyFailure,
  resetPasskeyRateLimits,
} from "./rate-limit";
import {
  beginPasskeyRegistration,
  completePasskeyRegistration,
} from "./register";
import { InMemoryFounderPasskeyStore } from "./store";
import type { PasskeyChallengeRecord } from "./types";
import {
  checkExecutiveDashboardLoginRateLimit,
  EXEC_AUTH_RATE_LIMIT_MAX,
  recordExecutiveDashboardLoginFailure,
  resetExecutiveDashboardLoginRateLimits,
} from "../rate-limit";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SECRET = "test-session-secret-32chars-minimum!!";
const NOW = Date.parse("2026-08-23T18:00:00.000Z");

function withEnv(
  values: Record<string, string | undefined>,
  fn: () => void,
): void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

type TestAttestation = RegistrationResponseJSON & {
  testOrigin?: string;
  testRpId?: string;
  testChallenge?: string;
  testCredentialId?: string;
};

type TestAssertion = AuthenticationResponseJSON & {
  testOrigin?: string;
  testRpId?: string;
  testChallenge?: string;
  testNewCounter?: number;
};

function attestation(overrides: Partial<TestAttestation> = {}): TestAttestation {
  const id = overrides.testCredentialId ?? overrides.id ?? "cred-iphone";
  return {
    id,
    rawId: id,
    type: "public-key",
    clientExtensionResults: {},
    response: {
      clientDataJSON: "e30",
      attestationObject: "e30",
    },
    testOrigin: CONTINUUM_PRODUCTION_WEBAUTHN_ORIGIN,
    testRpId: CONTINUUM_PRODUCTION_WEBAUTHN_RP_ID,
    ...overrides,
  };
}

function assertion(
  id: string,
  overrides: Partial<TestAssertion> = {},
): TestAssertion {
  return {
    id,
    rawId: id,
    type: "public-key",
    clientExtensionResults: {},
    response: {
      clientDataJSON: "e30",
      authenticatorData: "e30",
      signature: "e30",
    },
    testOrigin: CONTINUUM_PRODUCTION_WEBAUTHN_ORIGIN,
    testRpId: CONTINUUM_PRODUCTION_WEBAUTHN_RP_ID,
    ...overrides,
  };
}

function createTestCrypto(): PasskeyCrypto {
  return {
    async generateRegistrationOptions(input) {
      const challenge = randomBytes(32).toString("base64url");
      return {
        rp: { name: "Continuum", id: input.rpID },
        user: {
          id: "dXNlcg",
          name: "continuum-founder",
          displayName: "Continuum",
        },
        challenge,
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        timeout: 60_000,
        excludeCredentials: input.excludeCredentialIds.map((item) => ({
          type: "public-key" as const,
          id: item.id,
          transports: item.transports as never,
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "required",
          ...(input.authenticatorAttachment
            ? { authenticatorAttachment: input.authenticatorAttachment }
            : {}),
        },
        attestation: "none",
      } satisfies PublicKeyCredentialCreationOptionsJSON;
    },
    async verifyRegistrationResponse(input) {
      const extra = input.response as TestAttestation;
      if ((extra.testOrigin ?? input.expectedOrigin) !== input.expectedOrigin) {
        return { verified: false };
      }
      if ((extra.testRpId ?? input.expectedRPID) !== input.expectedRPID) {
        return { verified: false };
      }
      if (
        (extra.testChallenge ?? extra.response.clientDataJSON) !==
          input.expectedChallenge &&
        extra.testChallenge !== undefined &&
        extra.testChallenge !== input.expectedChallenge
      ) {
        return { verified: false };
      }
      if (extra.testChallenge && extra.testChallenge !== input.expectedChallenge) {
        return { verified: false };
      }
      return {
        verified: true,
        credential: {
          id: extra.id,
          publicKey: new Uint8Array([1, 2, 3, 4]),
          counter: 0,
          transports: ["internal"],
        },
        deviceType: "singleDevice",
        backedUp: false,
        origin: input.expectedOrigin,
        rpID: input.expectedRPID,
      };
    },
    async generateAuthenticationOptions(input) {
      const challenge = randomBytes(32).toString("base64url");
      return {
        challenge,
        timeout: 60_000,
        rpId: input.rpID,
        allowCredentials: input.allowCredentials.map((item) => ({
          type: "public-key" as const,
          id: item.id,
          transports: item.transports as never,
        })),
        userVerification: "required",
      } satisfies PublicKeyCredentialRequestOptionsJSON;
    },
    async verifyAuthenticationResponse(input) {
      const extra = input.response as TestAssertion;
      if ((extra.testOrigin ?? input.expectedOrigin) !== input.expectedOrigin) {
        return { verified: false, reason: "origin-mismatch" };
      }
      if ((extra.testRpId ?? input.expectedRPID) !== input.expectedRPID) {
        return { verified: false, reason: "rp-mismatch" };
      }
      if (
        extra.testChallenge !== undefined &&
        extra.testChallenge !== input.expectedChallenge
      ) {
        return { verified: false, reason: "challenge-mismatch" };
      }
      return {
        verified: true,
        newCounter: extra.testNewCounter ?? input.credential.counter + 1,
        backedUp: false,
        deviceType: "singleDevice",
      };
    },
  };
}

function productionEnv(fn: () => void): void {
  withEnv(
    {
      VERCEL_ENV: "production",
      CONTINUUM_WEBAUTHN_ORIGIN: "https://evil.vercel.app",
      CONTINUUM_WEBAUTHN_RP_ID: "evil.vercel.app",
      VERCEL_URL: "hourglass-app.vercel.app",
    },
    fn,
  );
}

describe("founder passkeys", () => {
  let store: InMemoryFounderPasskeyStore;
  let challenges: InMemoryPasskeyChallengeLedger;
  let challengeState: Map<string, PasskeyChallengeRecord>;
  let crypto: PasskeyCrypto;
  const clock = {
    now: () => NOW,
    nowIso: () => new Date(NOW).toISOString(),
  };
  const sessionToken = createExecutiveDashboardSessionToken(
    "founder",
    SECRET,
    NOW,
  );

  function deps() {
    return { store, challenges, crypto, secret: SECRET, clock };
  }

  beforeEach(() => {
    store = new InMemoryFounderPasskeyStore();
    challengeState = new Map();
    challenges = new InMemoryPasskeyChallengeLedger(challengeState, () => NOW);
    crypto = createTestCrypto();
    resetPasskeyRateLimits();
    resetExecutiveDashboardLoginRateLimits();
  });

  afterEach(() => {
    resetPasskeyRateLimits();
    resetExecutiveDashboardLoginRateLimits();
  });

  it("treats hourglassdiamonds.com as a valid RP ID for the www production origin", () => {
    assert.equal(
      isWebAuthnRpIdValidForOrigin(
        CONTINUUM_PRODUCTION_WEBAUTHN_RP_ID,
        CONTINUUM_PRODUCTION_WEBAUTHN_ORIGIN,
      ),
      true,
    );
    productionEnv(() => {
      const rp = getContinuumWebAuthnRelyingParty();
      assert.deepEqual(rp, {
        ok: true,
        origin: CONTINUUM_PRODUCTION_WEBAUTHN_ORIGIN,
        rpID: CONTINUUM_PRODUCTION_WEBAUTHN_RP_ID,
      });
    });
  });

  it("does not accept *.vercel.app as the production relying party", () => {
    productionEnv(() => {
      const rp = getContinuumWebAuthnRelyingParty();
      assert.equal(rp.ok, true);
      if (rp.ok) {
        assert.equal(rp.origin.includes("vercel.app"), false);
        assert.equal(rp.rpID.includes("vercel.app"), false);
        assert.equal(rp.origin, "https://www.hourglassdiamonds.com");
      }
    });
  });

  it("rejects unauthenticated enrollment", async () => {
    await productionEnvAsync(async () => {
      const begin = await beginPasskeyRegistration(
        deps(),
        { sessionOk: false, sessionToken: undefined },
      );
      assert.equal(begin.ok, false);
      if (!begin.ok) assert.equal(begin.reason, "unauthenticated");

      const complete = await completePasskeyRegistration(
        deps(),
        {
          sessionOk: false,
          sessionToken: undefined,
          challengeToken: "x",
          response: attestation(),
        },
      );
      assert.equal(complete.ok, false);
      if (!complete.ok) assert.equal(complete.reason, "unauthenticated");
    });
  });

  it("registers a credential only with a founder session and bound challenge", async () => {
    await productionEnvAsync(async () => {
      const begin = await beginPasskeyRegistration(
        deps(),
        { sessionOk: true, sessionToken },
      );
      assert.equal(begin.ok, true);
      if (!begin.ok) return;
      const complete = await completePasskeyRegistration(
        deps(),
        {
          sessionOk: true,
          sessionToken,
          challengeToken: begin.challengeToken,
          response: attestation({
            testChallenge: begin.options.challenge,
            testCredentialId: "cred-iphone",
          }),
          label: "iPhone",
        },
      );
      assert.equal(complete.ok, true);
      const saved = await store.getByCredentialId("cred-iphone");
      assert.ok(saved);
      assert.equal(saved?.label, "iPhone");
      assert.equal(saved?.founderUserId, CONTINUUM_FOUNDER_WEBAUTHN_USER_ID);
      assert.equal(saved?.revokedAt, null);
    });
  });

  it("rejects a replayed registration challenge", async () => {
    await productionEnvAsync(async () => {
      const begin = await beginPasskeyRegistration(
        deps(),
        { sessionOk: true, sessionToken },
      );
      assert.equal(begin.ok, true);
      if (!begin.ok) return;
      const first = await completePasskeyRegistration(
        deps(),
        {
          sessionOk: true,
          sessionToken,
          challengeToken: begin.challengeToken,
          response: attestation({
            testChallenge: begin.options.challenge,
            testCredentialId: "cred-1",
          }),
        },
      );
      assert.equal(first.ok, true);
      const replay = await completePasskeyRegistration(
        deps(),
        {
          sessionOk: true,
          sessionToken,
          challengeToken: begin.challengeToken,
          response: attestation({
            testChallenge: begin.options.challenge,
            testCredentialId: "cred-2",
          }),
        },
      );
      assert.equal(replay.ok, false);
      if (!replay.ok) assert.equal(replay.reason, "replayed-challenge");
    });
  });

  it("rejects an expired challenge cookie", () => {
    const { token } = createPasskeyChallengeToken(
      {
        kind: "auth",
        jti: "expired-jti",
        founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
        secret: SECRET,
      },
      NOW,
      60_000,
    );
    const expired = readPasskeyChallengeCookie(token, SECRET, NOW + 120_000);
    assert.equal(expired.ok, false);
    if (!expired.ok) assert.equal(expired.reason, "expired-challenge");
  });

  it("rejects the same jti on a second independent verifier sharing durable state", async () => {
    const shared = new Map<string, PasskeyChallengeRecord>();
    const instanceA = new InMemoryPasskeyChallengeLedger(shared, () => NOW);
    const instanceB = new InMemoryPasskeyChallengeLedger(shared, () => NOW);
    await instanceA.issue({
      jti: "shared-jti",
      purpose: "auth",
      founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
      challenge: "challenge-bytes",
      origin: CONTINUUM_PRODUCTION_WEBAUTHN_ORIGIN,
      rpId: CONTINUUM_PRODUCTION_WEBAUTHN_RP_ID,
      sessionFingerprint: null,
      expiresAt: new Date(NOW + 300_000).toISOString(),
      createdAt: new Date(NOW).toISOString(),
    });
    const first = await instanceA.consume("shared-jti");
    const second = await instanceB.consume("shared-jti");
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.reason, "replayed-challenge");
  });

  it("rejects wrong origin, wrong RP ID, unknown and revoked credentials", async () => {
    await productionEnvAsync(async () => {
      const enrolled = await enrollIphone();
      const begin = await beginPasskeyAuthentication(deps());
      assert.equal(begin.ok, true);
      if (!begin.ok) return;

      const wrongOrigin = await completePasskeyAuthentication(
        deps(),
        {
          challengeToken: begin.challengeToken,
          response: assertion("cred-iphone", {
            testOrigin: "https://evil.example",
            testChallenge: begin.options.challenge,
          }),
        },
      );
      assert.equal(wrongOrigin.ok, false);
      if (!wrongOrigin.ok) assert.equal(wrongOrigin.reason, "origin-mismatch");

      const beginRp = await beginPasskeyAuthentication(deps());
      assert.equal(beginRp.ok, true);
      if (!beginRp.ok) return;
      const wrongRp = await completePasskeyAuthentication(
        deps(),
        {
          challengeToken: beginRp.challengeToken,
          response: assertion("cred-iphone", {
            testRpId: "evil.example",
            testChallenge: beginRp.options.challenge,
          }),
        },
      );
      assert.equal(wrongRp.ok, false);
      if (!wrongRp.ok) assert.equal(wrongRp.reason, "rp-mismatch");

      const beginUnknown = await beginPasskeyAuthentication(deps());
      assert.equal(beginUnknown.ok, true);
      if (!beginUnknown.ok) return;
      const unknown = await completePasskeyAuthentication(
        deps(),
        {
          challengeToken: beginUnknown.challengeToken,
          response: assertion("missing-cred", {
            testChallenge: beginUnknown.options.challenge,
          }),
        },
      );
      assert.equal(unknown.ok, false);
      if (!unknown.ok) assert.equal(unknown.reason, "unknown-credential");

      const backupBegin = await beginPasskeyRegistration(
        deps(),
        { sessionOk: true, sessionToken },
      );
      assert.equal(backupBegin.ok, true);
      if (!backupBegin.ok) return;
      const backup = await completePasskeyRegistration(
        deps(),
        {
          sessionOk: true,
          sessionToken,
          challengeToken: backupBegin.challengeToken,
          response: attestation({
            testChallenge: backupBegin.options.challenge,
            testCredentialId: "cred-backup",
          }),
          label: "Backup",
        },
      );
      assert.equal(backup.ok, true);

      const revoked = await revokeFounderPasskey(
        { store, clock },
        { sessionOk: true, id: enrolled.id },
      );
      assert.equal(revoked.ok, true);
      const beginRevoked = await beginPasskeyAuthentication(deps());
      assert.equal(beginRevoked.ok, true);
      if (!beginRevoked.ok) return;
      const revokedAuth = await completePasskeyAuthentication(
        deps(),
        {
          challengeToken: beginRevoked.challengeToken,
          response: assertion("cred-iphone", {
            testChallenge: beginRevoked.options.challenge,
          }),
        },
      );
      assert.equal(revokedAuth.ok, false);
      if (!revokedAuth.ok) assert.equal(revokedAuth.reason, "revoked-credential");

      const stillPresent = await store.getByCredentialId("cred-iphone");
      assert.ok(stillPresent?.revokedAt);
    });
  });

  it("accepts a valid credential, updates the counter, and uses the existing session cookie helper", async () => {
    await productionEnvAsync(async () => {
      await enrollIphone();
      const begin = await beginPasskeyAuthentication(deps());
      assert.equal(begin.ok, true);
      if (!begin.ok) return;
      const done = await completePasskeyAuthentication(
        deps(),
        {
          challengeToken: begin.challengeToken,
          response: assertion("cred-iphone", {
            testChallenge: begin.options.challenge,
            testNewCounter: 4,
          }),
        },
      );
      assert.equal(done.ok, true);
      const saved = await store.getByCredentialId("cred-iphone");
      assert.equal(saved?.counter, 4);
      assert.equal(saved?.lastUsedAt, clock.nowIso());

      const cookie = buildExecutiveDashboardSessionCookie("founder", SECRET, NOW);
      assert.equal(cookie.name, EXECUTIVE_DASHBOARD_SESSION_COOKIE);
      assert.equal(cookie.options.httpOnly, true);
      assert.equal(cookie.options.sameSite, "lax");
      assert.equal(cookie.options.path, EXECUTIVE_DASHBOARD_SESSION_PATH);
      assert.equal(cookie.options.maxAge, EXECUTIVE_DASHBOARD_SESSION_MAX_AGE_SEC);
    });
  });

  it("rejects a stale authenticator counter", async () => {
    await productionEnvAsync(async () => {
      await enrollIphone();
      const firstBegin = await beginPasskeyAuthentication(deps());
      assert.equal(firstBegin.ok, true);
      if (!firstBegin.ok) return;
      const first = await completePasskeyAuthentication(
        deps(),
        {
          challengeToken: firstBegin.challengeToken,
          response: assertion("cred-iphone", {
            testChallenge: firstBegin.options.challenge,
            testNewCounter: 9,
          }),
        },
      );
      assert.equal(first.ok, true);

      const secondBegin = await beginPasskeyAuthentication(deps());
      assert.equal(secondBegin.ok, true);
      if (!secondBegin.ok) return;
      const stale = await completePasskeyAuthentication(
        deps(),
        {
          challengeToken: secondBegin.challengeToken,
          response: assertion("cred-iphone", {
            testChallenge: secondBegin.options.challenge,
            testNewCounter: 9,
          }),
        },
      );
      assert.equal(stale.ok, false);
      if (!stale.ok) assert.equal(stale.reason, "counter-invalid");
    });
  });

  it("keeps password fallback and does not share the password failure counter", () => {
    withEnv(
      {
        NODE_ENV: "development",
        EXECUTIVE_DASHBOARD_AUTH_RATE_LIMIT_DISABLED: undefined,
      },
      () => {
        const ip = "203.0.113.80";
        for (let i = 0; i < EXEC_AUTH_RATE_LIMIT_MAX; i += 1) {
          recordExecutiveDashboardLoginFailure(ip);
        }
        assert.equal(checkExecutiveDashboardLoginRateLimit(ip).allowed, false);
        assert.equal(checkPasskeyChallengeIssueRateLimit(ip), true);
        assert.equal(checkPasskeyVerifyRateLimit(ip), true);

        for (let i = 0; i < PASSKEY_VERIFY_FAILURE_MAX; i += 1) {
          recordPasskeyVerifyFailure("198.51.100.9");
        }
        assert.equal(checkPasskeyVerifyRateLimit("198.51.100.9"), false);
        assert.equal(
          checkExecutiveDashboardLoginRateLimit("198.51.100.9").allowed,
          true,
        );
        assert.ok(PASSKEY_CHALLENGE_ISSUE_MAX > EXEC_AUTH_RATE_LIMIT_MAX);
      },
    );
  });

  it("binds registration challenges to the founder session fingerprint", () => {
    const fp = sessionFingerprint(sessionToken, SECRET);
    const other = sessionFingerprint("different-session-token", SECRET);
    assert.notEqual(fp, other);
    const { token } = createPasskeyChallengeToken({
      kind: "reg",
      jti: "sfp-jti",
      founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
      sessionFingerprint: fp,
      secret: SECRET,
    }, NOW);
    const cookie = readPasskeyChallengeCookie(token, SECRET, NOW);
    assert.equal(cookie.ok, true);
    if (cookie.ok) assert.equal(cookie.payload.sfp, fp);
    assert.equal("ch" in (cookie.ok ? cookie.payload : {}), false);
  });

  it("allows multiple credentials and soft-revokes without deleting history", async () => {
    await productionEnvAsync(async () => {
      const first = await enrollIphone();
      const begin = await beginPasskeyRegistration(
        deps(),
        { sessionOk: true, sessionToken },
      );
      assert.equal(begin.ok, true);
      if (!begin.ok) return;
      const second = await completePasskeyRegistration(
        deps(),
        {
          sessionOk: true,
          sessionToken,
          challengeToken: begin.challengeToken,
          response: attestation({
            testChallenge: begin.options.challenge,
            testCredentialId: "cred-backup",
          }),
          label: "Backup",
        },
      );
      assert.equal(second.ok, true);
      await revokeFounderPasskey(
        { store, clock },
        { sessionOk: true, id: first.id },
      );
      const listed = await store.list();
      assert.equal(listed.length, 2);
      assert.ok(listed.find((row) => row.credentialId === "cred-iphone")?.revokedAt);
      assert.equal(
        listed.find((row) => row.credentialId === "cred-backup")?.revokedAt,
        null,
      );
    });
  });

  it("keeps production wiring on SimpleWebAuthn and the existing session", () => {
    const cryptoSrc = read("lib/executive-dashboard/passkeys/crypto.ts");
    const actions = read("app/executive-dashboard/actions.ts");
    const passkeyActions = read("app/executive-dashboard/passkey-actions.ts");
    const login = read("app/executive-dashboard/login/page.tsx");
    const button = read("app/executive-dashboard/passkey-login-button.tsx");
    const proxy = read("proxy.ts");
    const log = read("lib/executive-dashboard/passkeys/log.ts");
    assert.match(cryptoSrc, /@simplewebauthn\/server/);
    assert.match(cryptoSrc, /generateRegistrationOptions/);
    assert.match(cryptoSrc, /verifyAuthenticationResponse/);
    assert.match(cryptoSrc, /input.authenticatorAttachment/);
    assert.doesNotMatch(cryptoSrc, /authenticatorAttachment: "platform"/);
    const challengeSrc = read("lib/executive-dashboard/passkeys/challenges.ts");
    assert.doesNotMatch(challengeSrc, /const consumed = new Map/);
    assert.match(challengeSrc, /v: 2/);
    const sql = read("lib/supabase/continuum-founder-passkeys-schema.sql");
    assert.match(sql, /continuum_founder_webauthn_consume_challenge/);
    assert.match(actions, /loginExecutiveDashboard/);
    assert.match(actions, /issueExecutiveDashboardSession/);
    assert.match(passkeyActions, /issueExecutiveDashboardSession/);
    assert.match(passkeyActions, /EXECUTIVE_DASHBOARD_PASSKEY_AUTH_ERROR/);
    assert.match(button, /Continue with passkey/);
    assert.match(button, /Uses Face ID on iPhone/);
    assert.equal(
      EXECUTIVE_DASHBOARD_PASSKEY_AUTH_ERROR,
      "Unable to verify passkey. Try again or use your password.",
    );
    assert.match(login, /PasskeyLoginButton/);
    assert.match(login, /ExecutiveDashboardLoginForm/);
    assert.match(proxy, /isExecutiveDashboardSecurityPath/);
    assert.equal(
      isExecutiveDashboardSecurityPath("/executive-dashboard/security/passkeys"),
      true,
    );
    assert.equal(
      isExecutiveDashboardSecurityPath("/executive-dashboard/concierge"),
      false,
    );
    assert.match(log, /src: "continuum-passkey"/);
    const payload = log.slice(log.indexOf("JSON.stringify"));
    assert.doesNotMatch(payload, /challengeToken|credentialId|signature|password/);
    assert.doesNotMatch(passkeyActions, /FaceID|LocalAuthentication/);
    assert.doesNotMatch(cryptoSrc, /navigator\.serviceWorker/);
  });

  it("does not log secrets or attach passkeys to Client Memory / public APIs", () => {
    const files = walk(join(ROOT, "lib/executive-dashboard/passkeys"));
    for (const file of files) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /continuum_person_profiles|note_text|displayName/);
      if (file.endsWith("log.ts")) {
        assert.match(source, /op: event.op/);
        const payload = source.slice(source.indexOf("JSON.stringify"));
        assert.doesNotMatch(
          payload,
          /credentialId|publicKey|challengeToken|signature/,
        );
      }
    }
    const apiFiles = walk(join(ROOT, "app/api"));
    for (const file of apiFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /founder-passkey|beginPasskeyAuthentication/);
    }
    const server = read("lib/executive-dashboard/passkeys/server.ts");
    assert.match(server, /import "server-only"/);
    const encoded = Buffer.from(new Uint8Array([1, 2, 255, 0, 7])).toString(
      "base64url",
    );
    const decoded = new Uint8Array(Buffer.from(encoded, "base64url"));
    assert.deepEqual([...decoded], [1, 2, 255, 0, 7]);
  });

  async function enrollIphone(): Promise<{ id: string }> {
    const begin = await beginPasskeyRegistration(
      deps(),
      { sessionOk: true, sessionToken },
    );
    assert.equal(begin.ok, true);
    if (!begin.ok) throw new Error("begin-failed");
    const complete = await completePasskeyRegistration(
      deps(),
      {
        sessionOk: true,
        sessionToken,
        challengeToken: begin.challengeToken,
        response: attestation({
          testChallenge: begin.options.challenge,
          testCredentialId: "cred-iphone",
        }),
        label: "iPhone",
      },
    );
    assert.equal(complete.ok, true);
    if (!complete.ok) throw new Error("complete-failed");
    return { id: complete.id };
  }
});

async function productionEnvAsync(fn: () => Promise<void>): Promise<void> {
  const previous = new Map<string, string | undefined>();
  const values: Record<string, string | undefined> = {
    VERCEL_ENV: "production",
    CONTINUUM_WEBAUTHN_ORIGIN: "https://evil.vercel.app",
    CONTINUUM_WEBAUTHN_RP_ID: "evil.vercel.app",
    VERCEL_URL: "hourglass-app.vercel.app",
  };
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

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, found);
    else found.push(path);
  }
  return found;
}
