import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  isExecutiveDashboardConciergePath,
  isExecutiveDashboardPasskeyPairPath,
  isExecutiveDashboardSecurityPath,
  EXECUTIVE_DASHBOARD_CONCIERGE_PATH,
  EXECUTIVE_DASHBOARD_PASSKEY_PAIR_PATH,
  EXECUTIVE_DASHBOARD_PASSKEYS_PATH,
} from "../access";
import { createExecutiveDashboardSessionToken } from "../session";
import { InMemoryPasskeyChallengeLedger } from "./challenge-ledger";
import {
  CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
  CONTINUUM_PRODUCTION_WEBAUTHN_ORIGIN,
  getContinuumWebAuthnRelyingParty,
  PASSKEY_PAIRING_COOKIE,
  PASSKEY_PAIRING_TTL_SEC,
} from "./config";
import type { PasskeyCrypto } from "./crypto";
import {
  approveIphonePairing,
  beginIphonePairingRegistration,
  cancelIphonePairing,
  claimIphonePairing,
  completeIphonePairingRegistration,
  createIphonePairing,
  readIphonePairingForDesktop,
  readIphonePairingForPhone,
} from "./pairing";
import { InMemoryPasskeyPairingStore } from "./pairing-store";
import { formatMatchCode, readPairingTokenFromHash } from "./pairing-format";
import {
  hashPairingToken,
  newPairingToken,
  pairingDeviceHint,
  pairingPageUrl,
  passkeyPairingCookieOptions,
  hashPairingSession,
} from "./pairing-token";
import {
  beginPasskeyRegistration,
  completePasskeyRegistration,
} from "./register";
import { InMemoryFounderPasskeyStore } from "./store";
import type { FounderPasskeyInsert, PasskeyPairingRecord } from "./types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SECRET = "test-session-secret-32chars-minimum!!";
const NOW = Date.parse("2026-08-24T12:00:00.000Z");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

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

type TestAttestation = RegistrationResponseJSON & {
  testOrigin?: string;
  testRpId?: string;
  testChallenge?: string;
  testCredentialId?: string;
};

function attestation(overrides: Partial<TestAttestation> = {}): TestAttestation {
  const id = overrides.testCredentialId ?? overrides.id ?? "cred-iphone-pair";
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
    testRpId: "hourglassdiamonds.com",
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
    async generateAuthenticationOptions() {
      throw new Error("auth-not-used");
    },
    async verifyAuthenticationResponse() {
      return { verified: false, reason: "verify-failed" };
    },
  };
}

describe("iphone passkey pairing", () => {
  let now = NOW;
  let store: InMemoryFounderPasskeyStore;
  let challenges: InMemoryPasskeyChallengeLedger;
  let pairings: InMemoryPasskeyPairingStore;
  let pairingRows: Map<string, PasskeyPairingRecord>;
  let crypto: PasskeyCrypto;
  const sessionToken = createExecutiveDashboardSessionToken(
    "founder",
    SECRET,
    NOW,
  );
  const clock = {
    now: () => now,
    nowIso: () => new Date(now).toISOString(),
  };

  function deps() {
    return { store, challenges, pairings, crypto, secret: SECRET, clock };
  }

  beforeEach(() => {
    now = NOW;
    store = new InMemoryFounderPasskeyStore();
    challenges = new InMemoryPasskeyChallengeLedger(new Map(), () => now);
    pairingRows = new Map();
    pairings = new InMemoryPasskeyPairingStore(pairingRows, () => now, store);
    crypto = createTestCrypto();
  });

  it("rejects unauthenticated desktop pairing create", async () => {
    await productionEnvAsync(async () => {
      const created = await createIphonePairing(deps(), { sessionOk: false });
      assert.equal(created.ok, false);
      if (!created.ok) assert.equal(created.reason, "unauthenticated");
    });
  });

  it("lets a founder create a hashed one-time pairing", async () => {
    await productionEnvAsync(async () => {
      const created = await createIphonePairing(deps(), { sessionOk: true });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      assert.match(created.pairUrl, /^https:\/\/www\.hourglassdiamonds\.com\/executive-dashboard\/security\/passkeys\/pair#t=/);
      assert.equal(created.rawToken.length >= 32, true);
      assert.equal(created.matchCode.length, 6);
      const row = [...pairingRows.values()][0];
      assert.ok(row);
      assert.equal(row.tokenHash, hashPairingToken(created.rawToken));
      assert.notEqual(row.tokenHash, created.rawToken);
      assert.equal(row.status, "pending");
      assert.doesNotMatch(JSON.stringify(row), new RegExp(created.rawToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    });
  });

  it("expires unused pairings after five minutes", async () => {
    await productionEnvAsync(async () => {
      const created = await createIphonePairing(deps(), { sessionOk: true });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      now = NOW + 5 * 60 * 1000 + 1;
      const claimed = await claimIphonePairing(deps(), {
        rawToken: created.rawToken,
        userAgent: "Mozilla/5.0 (iPhone) Safari",
      });
      assert.equal(claimed.ok, false);
      if (!claimed.ok) assert.equal(claimed.reason, "pairing-expired");
    });
  });

  it("claims the QR token once and rejects a second device", async () => {
    await productionEnvAsync(async () => {
      const created = await createIphonePairing(deps(), { sessionOk: true });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      const first = await claimIphonePairing(deps(), {
        rawToken: created.rawToken,
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari",
      });
      const second = await claimIphonePairing(deps(), {
        rawToken: created.rawToken,
        userAgent: "Mozilla/5.0 (iPhone) Safari",
      });
      assert.equal(first.ok, true);
      assert.equal(second.ok, false);
      if (!second.ok) assert.equal(second.reason, "already-claimed");
      if (first.ok) {
        assert.equal(first.pairing.status, "claimed");
        assert.match(first.pairing.deviceHint ?? "", /iPhone \/ Safari/);
      }
    });
  });

  it("does not let two stores sharing durable pairing state both claim", async () => {
    await productionEnvAsync(async () => {
      const created = await createIphonePairing(deps(), { sessionOk: true });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      const instanceA = new InMemoryPasskeyPairingStore(pairingRows, () => now, store);
      const instanceB = new InMemoryPasskeyPairingStore(pairingRows, () => now, store);
      const sharedDepsA = { ...deps(), pairings: instanceA };
      const sharedDepsB = { ...deps(), pairings: instanceB };
      const first = await claimIphonePairing(sharedDepsA, {
        rawToken: created.rawToken,
      });
      const second = await claimIphonePairing(sharedDepsB, {
        rawToken: created.rawToken,
      });
      assert.equal(first.ok, true);
      assert.equal(second.ok, false);
    });
  });

  it("does not treat a claimed pairing cookie as Concierge or founder access", async () => {
    await productionEnvAsync(async () => {
      const created = await createIphonePairing(deps(), { sessionOk: true });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      const claimed = await claimIphonePairing(deps(), {
        rawToken: created.rawToken,
      });
      assert.equal(claimed.ok, true);
      if (!claimed.ok) return;
      const begin = await beginPasskeyRegistration(deps(), {
        sessionOk: false,
        sessionToken: claimed.pairingCookie,
      });
      assert.equal(begin.ok, false);
      assert.equal(
        isExecutiveDashboardConciergePath(EXECUTIVE_DASHBOARD_CONCIERGE_PATH),
        true,
      );
      assert.equal(
        isExecutiveDashboardPasskeyPairPath(EXECUTIVE_DASHBOARD_CONCIERGE_PATH),
        false,
      );
      const unapproved = await beginIphonePairingRegistration(deps(), {
        pairingCookie: claimed.pairingCookie,
      });
      assert.equal(unapproved.ok, false);
      if (!unapproved.ok) assert.equal(unapproved.reason, "pairing-not-approved");
    });
  });

  it("lets only the founder desktop approve, not the phone cookie", async () => {
    await productionEnvAsync(async () => {
      const created = await createIphonePairing(deps(), { sessionOk: true });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      const claimed = await claimIphonePairing(deps(), {
        rawToken: created.rawToken,
      });
      assert.equal(claimed.ok, true);
      if (!claimed.ok) return;
      const selfApprove = await approveIphonePairing(deps(), {
        founderSessionOk: false,
        pairingId: created.pairingId,
      });
      assert.equal(selfApprove.ok, false);
      if (!selfApprove.ok) assert.equal(selfApprove.reason, "unauthenticated");
      const approved = await approveIphonePairing(deps(), {
        founderSessionOk: true,
        pairingId: created.pairingId,
      });
      assert.equal(approved.ok, true);
      if (approved.ok) assert.equal(approved.pairing.status, "approved");
    });
  });

  it("blocks registration after cancel or expiry", async () => {
    await productionEnvAsync(async () => {
      const created = await createIphonePairing(deps(), { sessionOk: true });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      const claimed = await claimIphonePairing(deps(), {
        rawToken: created.rawToken,
      });
      assert.equal(claimed.ok, true);
      if (!claimed.ok) return;
      await approveIphonePairing(deps(), {
        founderSessionOk: true,
        pairingId: created.pairingId,
      });
      const cancelled = await cancelIphonePairing(deps(), {
        founderSessionOk: true,
        pairingId: created.pairingId,
      });
      assert.equal(cancelled.ok, true);
      const begin = await beginIphonePairingRegistration(deps(), {
        pairingCookie: claimed.pairingCookie,
      });
      assert.equal(begin.ok, false);

      now = NOW;
      const created2 = await createIphonePairing(deps(), { sessionOk: true });
      assert.equal(created2.ok, true);
      if (!created2.ok) return;
      const claimed2 = await claimIphonePairing(deps(), {
        rawToken: created2.rawToken,
      });
      assert.equal(claimed2.ok, true);
      if (!claimed2.ok) return;
      await approveIphonePairing(deps(), {
        founderSessionOk: true,
        pairingId: created2.pairingId,
      });
      now = NOW + 5 * 60 * 1000 + 1;
      const expiredBegin = await beginIphonePairingRegistration(deps(), {
        pairingCookie: claimed2.pairingCookie,
      });
      assert.equal(expiredBegin.ok, false);
    });
  });

  it("starts platform WebAuthn only after approval and reuses the durable challenge ledger", async () => {
    await productionEnvAsync(async () => {
      const created = await createIphonePairing(deps(), { sessionOk: true });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      const claimed = await claimIphonePairing(deps(), {
        rawToken: created.rawToken,
        userAgent: "Mozilla/5.0 (iPhone) Safari",
      });
      assert.equal(claimed.ok, true);
      if (!claimed.ok) return;
      await approveIphonePairing(deps(), {
        founderSessionOk: true,
        pairingId: created.pairingId,
      });
      const begin = await beginIphonePairingRegistration(deps(), {
        pairingCookie: claimed.pairingCookie,
      });
      assert.equal(begin.ok, true);
      if (!begin.ok) return;
      assert.equal(
        begin.options.authenticatorSelection?.authenticatorAttachment,
        "platform",
      );
      assert.equal(begin.options.authenticatorSelection?.userVerification, "required");
      const rp = getContinuumWebAuthnRelyingParty();
      assert.equal(rp.ok, true);
      if (rp.ok) {
        assert.equal(rp.origin, CONTINUUM_PRODUCTION_WEBAUTHN_ORIGIN);
        assert.equal(rp.rpID, "hourglassdiamonds.com");
      }
      const complete = await completeIphonePairingRegistration(deps(), {
        pairingCookie: claimed.pairingCookie,
        challengeToken: begin.challengeToken,
        response: attestation({
          testChallenge: begin.options.challenge,
          testCredentialId: "cred-iphone-pair",
        }),
      });
      assert.equal(complete.ok, true);
      if (!complete.ok) return;
      assert.equal(complete.issueFounderSession, true);
      const saved = await store.getByCredentialId("cred-iphone-pair");
      assert.ok(saved);
      assert.equal(saved?.founderUserId, CONTINUUM_FOUNDER_WEBAUTHN_USER_ID);
      assert.equal(saved?.label, "iPhone");
      const listed = await store.list();
      assert.equal(listed.filter((row) => row.revokedAt == null).length, 1);

      const again = await beginIphonePairingRegistration(deps(), {
        pairingCookie: claimed.pairingCookie,
      });
      assert.equal(again.ok, false);

      const desktop = await beginPasskeyRegistration(deps(), {
        sessionOk: true,
        sessionToken,
      });
      assert.equal(desktop.ok, true);
      if (desktop.ok) {
        assert.equal(
          desktop.options.authenticatorSelection?.authenticatorAttachment,
          undefined,
        );
      }
    });
  });

  it("issues founder session only after verified registration", async () => {
    await productionEnvAsync(async () => {
      const created = await createIphonePairing(deps(), { sessionOk: true });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      const claimed = await claimIphonePairing(deps(), {
        rawToken: created.rawToken,
      });
      assert.equal(claimed.ok, true);
      if (!claimed.ok) return;
      await approveIphonePairing(deps(), {
        founderSessionOk: true,
        pairingId: created.pairingId,
      });
      const failed = await completeIphonePairingRegistration(deps(), {
        pairingCookie: claimed.pairingCookie,
        challengeToken: undefined,
        response: attestation(),
      });
      assert.equal(failed.ok, false);
      assert.equal("issueFounderSession" in failed, false);
      const listed = await store.list();
      assert.equal(listed.length, 0);
    });
  });

  it("formats a match code without storing the raw QR token", () => {
    assert.equal(formatMatchCode("482731"), "482 731");
    const token = newPairingToken();
    assert.equal(token.length >= 43, true);
    assert.notEqual(hashPairingToken(token), token);
    assert.equal(pairingDeviceHint("Mozilla/5.0 (iPhone) Safari"), "iPhone / Safari");
  });

  it("keeps pair routing narrow and password / passkey login unchanged", () => {
    assert.equal(
      isExecutiveDashboardPasskeyPairPath(EXECUTIVE_DASHBOARD_PASSKEY_PAIR_PATH),
      true,
    );
    assert.equal(
      isExecutiveDashboardPasskeyPairPath(EXECUTIVE_DASHBOARD_PASSKEYS_PATH),
      false,
    );
    assert.equal(
      isExecutiveDashboardSecurityPath(EXECUTIVE_DASHBOARD_PASSKEY_PAIR_PATH),
      true,
    );
    const proxy = read("proxy.ts");
    assert.match(proxy, /isExecutiveDashboardPasskeyPairPath/);
    assert.match(proxy, /if \(isPair\)/);
    assert.match(proxy, /Referrer-Policy.*no-referrer/);
    const layout = read("app/executive-dashboard/security/layout.tsx");
    assert.match(layout, /isExecutiveDashboardPasskeyPairPath/);
    const concierge = read("app/executive-dashboard/concierge/layout.tsx");
    assert.match(concierge, /requireInternalClientMemorySession/);
    const loginActions = read("app/executive-dashboard/actions.ts");
    assert.match(loginActions, /loginExecutiveDashboard/);
    assert.match(loginActions, /issueExecutiveDashboardSession/);
    const passkeyLogin = read("app/executive-dashboard/passkey-login-button.tsx");
    assert.match(passkeyLogin, /Continue with passkey/);
    const pairActions = read(
      "app/executive-dashboard/security/passkeys/pair/actions.ts",
    );
    const desktopActions = read(
      "app/executive-dashboard/security/passkeys/pairing-actions.ts",
    );
    assert.match(pairActions, /claimIphonePairingFromTokenAction/);
    assert.match(pairActions, /issueExecutiveDashboardSession/);
    assert.match(pairActions, /completeIphonePairingRegistration/);
    assert.doesNotMatch(pairActions, /searchParams/);
    const pairPage = read("app/executive-dashboard/security/passkeys/pair/page.tsx");
    assert.doesNotMatch(pairPage, /searchParams|\?t=/);
    assert.match(
      read("app/executive-dashboard/security/passkeys/pair/pair-phone.tsx"),
      /readPairingTokenFromHash/,
    );
    assert.match(
      read("app/executive-dashboard/security/passkeys/pair/pair-phone.tsx"),
      /history\.replaceState/,
    );
    assert.match(
      read("lib/executive-dashboard/passkeys/pairing-token.ts"),
      /#t=/,
    );
    assert.doesNotMatch(
      read("lib/executive-dashboard/passkeys/pairing-token.ts"),
      /\?t=/,
    );
    assert.match(desktopActions, /readFounderPasskeySession/);
    assert.doesNotMatch(pairActions, /approveIphonePairing\(/);
    assert.doesNotMatch(desktopActions, /console\.(log|info|debug).*pairUrl/);
    assert.doesNotMatch(desktopActions, /rawToken/);
    assert.match(
      read("app/executive-dashboard/security/passkeys/iphone-setup.tsx"),
      /react-qr-code/,
    );
    assert.match(
      read("app/executive-dashboard/security/passkeys/iphone-setup.tsx"),
      /Set up iPhone/,
    );
    assert.doesNotMatch(
      read("app/executive-dashboard/security/passkeys/iphone-setup.tsx"),
      /localStorage|sessionStorage/,
    );
    assert.doesNotMatch(
      read("app/executive-dashboard/security/passkeys/pair/pair-phone.tsx"),
      /localStorage|sessionStorage/,
    );
    assert.match(proxy, /Referrer-Policy.*no-referrer/);
    const pairingFlow = read("lib/executive-dashboard/passkeys/pairing.ts");
    assert.match(pairingFlow, /authenticatorAttachment: "platform"/);
    assert.match(pairingFlow, /beginPasskeyRegistration/);
    assert.match(pairingFlow, /verifyPasskeyRegistration/);
    assert.match(pairingFlow, /pairings\.finalize/);
    assert.doesNotMatch(pairingFlow, /from "\.\/password"|passwordHash/);
    assert.match(read("lib/executive-dashboard/passkeys/log.ts"), /pairingId/);
    const payload = read("lib/executive-dashboard/passkeys/log.ts").slice(
      read("lib/executive-dashboard/passkeys/log.ts").indexOf("JSON.stringify"),
    );
    assert.doesNotMatch(payload, /rawToken|pairUrl|challengeToken|password/);
  });

  it("does not mutate Client Memory in pairing code", () => {
    const files = walk(join(ROOT, "lib/executive-dashboard/passkeys"));
    for (const file of files) {
      if (!/pairing/.test(file) || file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(
        source,
        /continuum_person_profiles|continuum_source_notes|note_text/,
      );
    }
    const sql = read(
      "lib/supabase/continuum-founder-passkey-pairings-schema.sql",
    );
    assert.doesNotMatch(sql, /continuum_person_profiles|note_text/);
  });

  it("lets the desktop read claimed pairing status without the raw token", async () => {
    await productionEnvAsync(async () => {
      const created = await createIphonePairing(deps(), { sessionOk: true });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      const claimed = await claimIphonePairing(deps(), {
        rawToken: created.rawToken,
      });
      assert.equal(claimed.ok, true);
      const desktop = await readIphonePairingForDesktop(deps(), {
        sessionOk: true,
        pairingId: created.pairingId,
      });
      assert.equal(desktop.ok, true);
      if (desktop.ok) {
        assert.equal(desktop.pairing.status, "claimed");
        assert.equal("tokenHash" in desktop.pairing, false);
        assert.equal("rawToken" in desktop.pairing, false);
      }
      const unauth = await readIphonePairingForDesktop(deps(), {
        sessionOk: false,
        pairingId: created.pairingId,
      });
      assert.equal(unauth.ok, false);
      if (claimed.ok) {
        const phone = await readIphonePairingForPhone(deps(), {
          pairingCookie: claimed.pairingCookie,
        });
        assert.equal(phone.ok, true);
      }
    });
  });

  it("does not complete founder desktop enrollment through the pairing cookie", async () => {
    await productionEnvAsync(async () => {
      const created = await createIphonePairing(deps(), { sessionOk: true });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      const claimed = await claimIphonePairing(deps(), {
        rawToken: created.rawToken,
      });
      assert.equal(claimed.ok, true);
      if (!claimed.ok) return;
      const complete = await completePasskeyRegistration(deps(), {
        sessionOk: true,
        sessionToken: claimed.pairingCookie,
        challengeToken: "nope",
        response: attestation(),
      });
      assert.equal(complete.ok, false);
    });
  });

  function credentialInsert(credentialId: string): FounderPasskeyInsert {
    return {
      founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
      credentialId,
      publicKey: new Uint8Array([1, 2, 3, 4]),
      counter: 0,
      transports: ["internal"],
      deviceType: "singleDevice",
      backedUp: false,
      label: "iPhone",
      createdAt: clock.nowIso(),
    };
  }

  async function approvedPairingRow() {
    const created = await createIphonePairing(deps(), { sessionOk: true });
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error("create");
    const claimed = await claimIphonePairing(deps(), {
      rawToken: created.rawToken,
    });
    assert.equal(claimed.ok, true);
    if (!claimed.ok) throw new Error("claim");
    const approved = await approveIphonePairing(deps(), {
      founderSessionOk: true,
      pairingId: created.pairingId,
    });
    assert.equal(approved.ok, true);
    const row = pairingRows.get(created.pairingId);
    if (!row?.claimedSessionHash) throw new Error("claimed-hash");
    return { created, claimed, row };
  }

  it("commits credential and completed pairing together", async () => {
    await productionEnvAsync(async () => {
      const { row } = await approvedPairingRow();
      const finished = await pairings.finalize({
        pairingId: row.id,
        founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
        claimedSessionHash: row.claimedSessionHash as string,
        credential: credentialInsert("cred-atomic-ok"),
      });
      assert.equal(finished.ok, true);
      if (!finished.ok) return;
      assert.equal(finished.pairing.status, "completed");
      assert.equal(finished.credential.credentialId, "cred-atomic-ok");
      assert.equal((await store.list()).length, 1);
    });
  });

  it("rolls back pairing completion when credential id already exists", async () => {
    await productionEnvAsync(async () => {
      await store.insert(credentialInsert("cred-dup"));
      const { row } = await approvedPairingRow();
      const finished = await pairings.finalize({
        pairingId: row.id,
        founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
        claimedSessionHash: row.claimedSessionHash as string,
        credential: credentialInsert("cred-dup"),
      });
      assert.equal(finished.ok, false);
      if (!finished.ok) assert.equal(finished.reason, "store-failed");
      assert.equal(pairingRows.get(row.id)?.status, "approved");
      assert.equal((await store.list()).length, 1);
    });
  });

  it("does not insert a credential for expired or unapproved pairings", async () => {
    await productionEnvAsync(async () => {
      const created = await createIphonePairing(deps(), { sessionOk: true });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      const claimed = await claimIphonePairing(deps(), {
        rawToken: created.rawToken,
      });
      assert.equal(claimed.ok, true);
      const row = pairingRows.get(created.pairingId);
      const unapproved = await pairings.finalize({
        pairingId: created.pairingId,
        founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
        claimedSessionHash: row?.claimedSessionHash ?? "x",
        credential: credentialInsert("cred-unapproved"),
      });
      assert.equal(unapproved.ok, false);
      assert.equal((await store.list()).length, 0);

      const { row: approved } = await approvedPairingRow();
      now = NOW + 5 * 60 * 1000 + 1;
      const expired = await pairings.finalize({
        pairingId: approved.id,
        founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
        claimedSessionHash: approved.claimedSessionHash as string,
        credential: credentialInsert("cred-expired"),
      });
      assert.equal(expired.ok, false);
      assert.equal((await store.list()).length, 0);
      assert.equal(pairingRows.get(approved.id)?.status, "approved");
    });
  });

  it("rejects finalize with the wrong claimed session hash", async () => {
    await productionEnvAsync(async () => {
      const { row } = await approvedPairingRow();
      const finished = await pairings.finalize({
        pairingId: row.id,
        founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
        claimedSessionHash: hashPairingSession("other-phone-nonce"),
        credential: credentialInsert("cred-wrong-hash"),
      });
      assert.equal(finished.ok, false);
      assert.equal((await store.list()).length, 0);
      assert.equal(pairingRows.get(row.id)?.status, "approved");
    });
  });

  it("allows only one of two simultaneous finalize attempts to persist", async () => {
    await productionEnvAsync(async () => {
      const { row } = await approvedPairingRow();
      const instanceA = new InMemoryPasskeyPairingStore(pairingRows, () => now, store);
      const instanceB = new InMemoryPasskeyPairingStore(pairingRows, () => now, store);
      const [first, second] = await Promise.all([
        instanceA.finalize({
          pairingId: row.id,
          founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
          claimedSessionHash: row.claimedSessionHash as string,
          credential: credentialInsert("cred-race-a"),
        }),
        instanceB.finalize({
          pairingId: row.id,
          founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
          claimedSessionHash: row.claimedSessionHash as string,
          credential: credentialInsert("cred-race-b"),
        }),
      ]);
      const wins = [first, second].filter((item) => item.ok);
      const losses = [first, second].filter((item) => !item.ok);
      assert.equal(wins.length, 1);
      assert.equal(losses.length, 1);
      assert.equal((await store.list()).length, 1);
      assert.equal(pairingRows.get(row.id)?.status, "completed");
    });
  });

  it("does not issue a founder session when finalization fails", async () => {
    await productionEnvAsync(async () => {
      const { claimed, created } = await approvedPairingRow();
      await store.insert(credentialInsert("cred-iphone-pair"));
      const begin = await beginIphonePairingRegistration(deps(), {
        pairingCookie: claimed.pairingCookie,
      });
      assert.equal(begin.ok, true);
      if (!begin.ok) return;
      const complete = await completeIphonePairingRegistration(deps(), {
        pairingCookie: claimed.pairingCookie,
        challengeToken: begin.challengeToken,
        response: attestation({
          testChallenge: begin.options.challenge,
          testCredentialId: "cred-iphone-pair",
        }),
      });
      assert.equal(complete.ok, false);
      assert.equal("issueFounderSession" in complete, false);
      assert.equal(pairingRows.get(created.pairingId)?.status, "approved");
    });
  });

  it("keeps the pairing token in the URL fragment, not the request query", () => {
    const url = pairingPageUrl(
      "https://www.hourglassdiamonds.com",
      "opaque-token",
    );
    assert.equal(
      url,
      "https://www.hourglassdiamonds.com/executive-dashboard/security/passkeys/pair#t=opaque-token",
    );
    assert.equal(readPairingTokenFromHash("#t=opaque-token"), "opaque-token");
    assert.equal(readPairingTokenFromHash(""), null);
    const cookie = passkeyPairingCookieOptions(true, 180);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.secure, true);
    assert.equal(cookie.sameSite, "lax");
    assert.equal(cookie.path, EXECUTIVE_DASHBOARD_PASSKEY_PAIR_PATH);
    assert.equal(cookie.maxAge, 180);
    assert.equal(PASSKEY_PAIRING_COOKIE, "hgd_ed_pk_pair");
    assert.equal(
      passkeyPairingCookieOptions(true, 10_000).maxAge,
      PASSKEY_PAIRING_TTL_SEC,
    );
  });
});
