import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { hashAbuseBucketKey } from "@/lib/security/abuse-key";
import {
  createMemoryAbuseRateLimitStore,
  setAbuseRateLimitStoreForTests,
  type AbuseRateLimitConsumeInput,
  type AbuseRateLimitStore,
} from "@/lib/security/abuse-rate-limit-store";
import {
  CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
  CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
} from "@/lib/continuum/runtime-env";
import {
  FOUNDER_AUTH_RATE_LIMIT_NAMESPACES,
  FOUNDER_AUTH_RATE_LIMIT_WINDOW_NAME,
  isDurableFounderAuthRateLimitEnabled,
} from "./durable-auth-limit";
import {
  checkExecutiveDashboardLoginRateLimit,
  EXEC_AUTH_RATE_LIMIT_MAX,
  EXEC_AUTH_RATE_LIMIT_WINDOW_MS,
  getExecutiveDashboardAuthClientIp,
  recordExecutiveDashboardLoginFailure,
  resetExecutiveDashboardLoginRateLimits,
} from "./rate-limit";
import {
  checkPasskeyChallengeIssueRateLimit,
  checkPasskeyPairingClaimRateLimit,
  checkPasskeyVerifyRateLimit,
  PASSKEY_CHALLENGE_ISSUE_MAX,
  PASSKEY_PAIRING_CLAIM_MAX,
  PASSKEY_RATE_LIMIT_WINDOW_MS,
  PASSKEY_VERIFY_FAILURE_MAX,
  recordPasskeyVerifyFailure,
  resetPasskeyRateLimits,
} from "./passkeys/rate-limit";

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
  EXECUTIVE_DASHBOARD_AUTH_RATE_LIMIT_DISABLED: undefined,
} as const;

const PRODUCTION_ENV = {
  CONTINUUM_ENV: "production",
  VERCEL_ENV: "production",
  VERCEL: "1",
  CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
  CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
  SUPABASE_URL: PRODUCTION_URL,
  NODE_ENV: "production",
  EXECUTIVE_DASHBOARD_AUTH_RATE_LIMIT_DISABLED: undefined,
} as const;

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

function createTrackingStore(): {
  store: AbuseRateLimitStore;
  consumes: AbuseRateLimitConsumeInput[];
} {
  const inner = createMemoryAbuseRateLimitStore();
  const consumes: AbuseRateLimitConsumeInput[] = [];
  return {
    consumes,
    store: {
      async consume(input) {
        consumes.push({ ...input });
        return inner.consume(input);
      },
      debugBucketKeys: () => inner.debugBucketKeys?.() ?? [],
      clear: () => inner.clear?.(),
    },
  };
}

describe("Preview durable founder-auth rate limiting", () => {
  afterEach(() => {
    setAbuseRateLimitStoreForTests(null);
    resetExecutiveDashboardLoginRateLimits();
    resetPasskeyRateLimits();
  });

  it("A/B: Preview password failures persist in the durable store across a fresh in-memory Map", async () => {
    const { store, consumes } = createTrackingStore();
    await withEnv({ ...PREVIEW_ISOLATED_ENV }, async () => {
      assert.equal(isDurableFounderAuthRateLimitEnabled(), true);
      const ip = "203.0.113.40";
      for (let i = 0; i < EXEC_AUTH_RATE_LIMIT_MAX; i += 1) {
        assert.equal(
          (await checkExecutiveDashboardLoginRateLimit(ip, Date.now(), store))
            .allowed,
          true,
        );
        await recordExecutiveDashboardLoginFailure(ip);
      }
      assert.equal(
        (await checkExecutiveDashboardLoginRateLimit(ip, Date.now(), store))
          .allowed,
        false,
      );
      assert.equal(consumes.length, EXEC_AUTH_RATE_LIMIT_MAX + 1);

      resetExecutiveDashboardLoginRateLimits();
      const afterFreshMap = await checkExecutiveDashboardLoginRateLimit(
        ip,
        Date.now(),
        store,
      );
      assert.equal(afterFreshMap.allowed, false);
    });
  });

  it("C/M: Production and non-Preview keep in-memory behavior and never call the durable store", async () => {
    const { store, consumes } = createTrackingStore();
    const ip = "198.51.100.40";

    await withEnv({ ...PRODUCTION_ENV }, async () => {
      assert.equal(isDurableFounderAuthRateLimitEnabled(), false);
      for (let i = 0; i < EXEC_AUTH_RATE_LIMIT_MAX; i += 1) {
        assert.equal(
          (await checkExecutiveDashboardLoginRateLimit(ip, Date.now(), store))
            .allowed,
          true,
        );
        await recordExecutiveDashboardLoginFailure(ip);
      }
      assert.equal(
        (await checkExecutiveDashboardLoginRateLimit(ip, Date.now(), store))
          .allowed,
        false,
      );
      assert.equal(await checkPasskeyChallengeIssueRateLimit(ip, Date.now(), store), true);
      assert.equal(await checkPasskeyVerifyRateLimit(ip, Date.now(), store), true);
      assert.equal(await checkPasskeyPairingClaimRateLimit(ip, Date.now(), store), true);
      assert.equal(consumes.length, 0);
    });

    resetExecutiveDashboardLoginRateLimits();
    resetPasskeyRateLimits();

    await withEnv(
      {
        ...PREVIEW_ISOLATED_ENV,
        CONTINUUM_ENV: "preview",
        SUPABASE_URL: PRODUCTION_URL,
      },
      async () => {
        assert.equal(isDurableFounderAuthRateLimitEnabled(), false);
        assert.equal(
          (await checkExecutiveDashboardLoginRateLimit(ip, Date.now(), store))
            .allowed,
          true,
        );
        assert.equal(consumes.length, 0);
      },
    );

    resetExecutiveDashboardLoginRateLimits();
    resetPasskeyRateLimits();

    await withEnv(
      {
        CONTINUUM_ENV: undefined,
        VERCEL_ENV: "preview",
        SUPABASE_URL: PREVIEW_URL,
        CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
        CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
      },
      async () => {
        assert.equal(isDurableFounderAuthRateLimitEnabled(), false);
        await checkExecutiveDashboardLoginRateLimit(ip, Date.now(), store);
        assert.equal(consumes.length, 0);
      },
    );
  });

  it("D: Preview passkey challenge issuance uses the durable store", async () => {
    const { store, consumes } = createTrackingStore();
    await withEnv({ ...PREVIEW_ISOLATED_ENV }, async () => {
      const ip = "203.0.113.41";
      for (let i = 0; i < PASSKEY_CHALLENGE_ISSUE_MAX; i += 1) {
        assert.equal(
          await checkPasskeyChallengeIssueRateLimit(ip, Date.now(), store),
          true,
        );
      }
      assert.equal(
        await checkPasskeyChallengeIssueRateLimit(ip, Date.now(), store),
        false,
      );
      assert.equal(consumes.length, PASSKEY_CHALLENGE_ISSUE_MAX + 1);
      assert.ok(
        consumes.every((row) => /^[a-f0-9]{64}$/.test(row.bucketKey)),
      );
    });
  });

  it("E: Preview passkey verification uses the durable store for the verify namespace", async () => {
    const { store, consumes } = createTrackingStore();
    await withEnv({ ...PREVIEW_ISOLATED_ENV }, async () => {
      const ip = "203.0.113.42";
      for (let i = 0; i < PASSKEY_VERIFY_FAILURE_MAX; i += 1) {
        assert.equal(
          await checkPasskeyVerifyRateLimit(ip, Date.now(), store),
          true,
        );
        await recordPasskeyVerifyFailure(ip);
      }
      assert.equal(
        await checkPasskeyVerifyRateLimit(ip, Date.now(), store),
        false,
      );
      assert.equal(consumes.length, PASSKEY_VERIFY_FAILURE_MAX + 1);
      resetPasskeyRateLimits();
      assert.equal(
        await checkPasskeyVerifyRateLimit(ip, Date.now(), store),
        false,
      );
    });
  });

  it("F: Preview pairing claim is durable-limited; Production pairing claim stays unlimited", async () => {
    const { store, consumes } = createTrackingStore();
    await withEnv({ ...PREVIEW_ISOLATED_ENV }, async () => {
      const ip = "203.0.113.43";
      for (let i = 0; i < PASSKEY_PAIRING_CLAIM_MAX; i += 1) {
        assert.equal(
          await checkPasskeyPairingClaimRateLimit(ip, Date.now(), store),
          true,
        );
      }
      assert.equal(
        await checkPasskeyPairingClaimRateLimit(ip, Date.now(), store),
        false,
      );
    });
    const previewConsumes = consumes.length;
    assert.equal(previewConsumes, PASSKEY_PAIRING_CLAIM_MAX + 1);

    await withEnv({ ...PRODUCTION_ENV }, async () => {
      for (let i = 0; i < PASSKEY_PAIRING_CLAIM_MAX + 5; i += 1) {
        assert.equal(
          await checkPasskeyPairingClaimRateLimit(
            "203.0.113.43",
            Date.now(),
            store,
          ),
          true,
        );
      }
      assert.equal(consumes.length, previewConsumes);
    });
  });

  it("G: pairing claim limiter is surrounding-only and does not weaken token/CAS/session protections", () => {
    const claimAction = readFileSync(
      join(ROOT, "app/executive-dashboard/security/passkeys/pair/actions.ts"),
      "utf8",
    );
    const pairing = readFileSync(
      join(ROOT, "lib/executive-dashboard/passkeys/pairing.ts"),
      "utf8",
    );
    const token = readFileSync(
      join(ROOT, "lib/executive-dashboard/passkeys/pairing-token.ts"),
      "utf8",
    );
    const config = readFileSync(
      join(ROOT, "lib/executive-dashboard/passkeys/config.ts"),
      "utf8",
    );
    assert.match(claimAction, /checkPasskeyPairingClaimRateLimit/);
    assert.match(claimAction, /claimIphonePairing\(/);
    assert.doesNotMatch(pairing, /checkPasskeyPairingClaimRateLimit|consumeFounderAuthRateLimit|consumeRateLimitWindows/);
    assert.match(pairing, /hashPairingToken\(input\.rawToken\)/);
    assert.match(pairing, /deps\.pairings\.claim\(/);
    assert.match(token, /randomBytes\(PASSKEY_PAIRING_TOKEN_BYTES\)/);
    assert.match(config, /PASSKEY_PAIRING_TOKEN_BYTES = 32/);
    assert.match(config, /PASSKEY_PAIRING_TTL_MS = 5 \* 60 \* 1000/);
  });

  it("H/L: durable buckets hash the hardened client-IP identity only", async () => {
    const { store, consumes } = createTrackingStore();
    const username = "founder@hourglass.example";
    const email = "founder@hourglass.example";
    const password = "hunter2-not-a-real-secret";
    const token = "pairing-token-raw-value";
    const credentialId = "cred-id-aabbcc";
    await withEnv({ ...PREVIEW_ISOLATED_ENV }, async () => {
      const ip = getExecutiveDashboardAuthClientIp(
        new Headers({ "x-forwarded-for": "203.0.113.44" }),
      );
      assert.equal(ip, "203.0.113.44");
      await checkExecutiveDashboardLoginRateLimit(ip, Date.now(), store);
    });
    assert.equal(consumes.length, 1);
    const bucketKey = consumes[0]?.bucketKey ?? "";
    assert.match(bucketKey, /^[a-f0-9]{64}$/);
    assert.equal(
      bucketKey,
      hashAbuseBucketKey({
        namespace: FOUNDER_AUTH_RATE_LIMIT_NAMESPACES.password,
        windowName: FOUNDER_AUTH_RATE_LIMIT_WINDOW_NAME,
        identity: "203.0.113.44",
      }),
    );
    for (const material of [
      "203.0.113.44",
      username,
      email,
      password,
      token,
      credentialId,
    ]) {
      assert.equal(bucketKey.includes(material), false);
    }
    assert.equal(EXEC_AUTH_RATE_LIMIT_WINDOW_MS, PASSKEY_RATE_LIMIT_WINDOW_MS);
  });

  it("I: missing trusted Vercel IP fails closed on Preview durable without a shared unknown bucket", async () => {
    const { store, consumes } = createTrackingStore();
    await withEnv(
      { ...PREVIEW_ISOLATED_ENV, VERCEL: "1", VERCEL_ENV: "preview" },
      async () => {
        const ip = getExecutiveDashboardAuthClientIp(new Headers());
        assert.equal(ip, "");
        const denied = await checkExecutiveDashboardLoginRateLimit(
          ip,
          Date.now(),
          store,
        );
        assert.equal(denied.allowed, false);
        if (!denied.allowed) {
          assert.equal(denied.retryAfterSeconds, 30);
        }
        assert.equal(consumes.length, 0);
        assert.equal(
          await checkPasskeyPairingClaimRateLimit(ip, Date.now(), store),
          false,
        );
        assert.equal(consumes.length, 0);
      },
    );
  });

  it("J: Preview durable-store errors fail closed without leaking DB details", async () => {
    const leak = "relation public.abuse_rate_limits does not exist";
    const store: AbuseRateLimitStore = {
      async consume() {
        throw new Error(leak);
      },
    };
    await withEnv({ ...PREVIEW_ISOLATED_ENV }, async () => {
      const result = await checkExecutiveDashboardLoginRateLimit(
        "203.0.113.45",
        Date.now(),
        store,
      );
      assert.equal(result.allowed, false);
      if (!result.allowed) {
        assert.equal(result.retryAfterSeconds, 30);
      }
      assert.equal(JSON.stringify(result).includes(leak), false);
      assert.equal("error" in result, false);
    });
  });

  it("K: namespaces cannot collide across founder-auth endpoints", async () => {
    const { store } = createTrackingStore();
    await withEnv({ ...PREVIEW_ISOLATED_ENV }, async () => {
      const ip = "203.0.113.46";
      for (let i = 0; i < EXEC_AUTH_RATE_LIMIT_MAX; i += 1) {
        assert.equal(
          (await checkExecutiveDashboardLoginRateLimit(ip, Date.now(), store))
            .allowed,
          true,
        );
      }
      assert.equal(
        (await checkExecutiveDashboardLoginRateLimit(ip, Date.now(), store))
          .allowed,
        false,
      );
      assert.equal(
        await checkPasskeyChallengeIssueRateLimit(ip, Date.now(), store),
        true,
      );
      assert.equal(await checkPasskeyVerifyRateLimit(ip, Date.now(), store), true);
      assert.equal(
        await checkPasskeyPairingClaimRateLimit(ip, Date.now(), store),
        true,
      );

      const passwordKey = hashAbuseBucketKey({
        namespace: FOUNDER_AUTH_RATE_LIMIT_NAMESPACES.password,
        windowName: FOUNDER_AUTH_RATE_LIMIT_WINDOW_NAME,
        identity: ip,
      });
      const issueKey = hashAbuseBucketKey({
        namespace: FOUNDER_AUTH_RATE_LIMIT_NAMESPACES.passkeyIssue,
        windowName: FOUNDER_AUTH_RATE_LIMIT_WINDOW_NAME,
        identity: ip,
      });
      const verifyKey = hashAbuseBucketKey({
        namespace: FOUNDER_AUTH_RATE_LIMIT_NAMESPACES.passkeyVerify,
        windowName: FOUNDER_AUTH_RATE_LIMIT_WINDOW_NAME,
        identity: ip,
      });
      const claimKey = hashAbuseBucketKey({
        namespace: FOUNDER_AUTH_RATE_LIMIT_NAMESPACES.pairingClaim,
        windowName: FOUNDER_AUTH_RATE_LIMIT_WINDOW_NAME,
        identity: ip,
      });
      assert.equal(new Set([passwordKey, issueKey, verifyKey, claimKey]).size, 4);
    });
  });

  it("reuses consumeRateLimitWindows and does not add a second limiter framework", () => {
    const durable = readFileSync(
      join(ROOT, "lib/executive-dashboard/durable-auth-limit.ts"),
      "utf8",
    );
    const password = readFileSync(
      join(ROOT, "lib/executive-dashboard/rate-limit.ts"),
      "utf8",
    );
    const passkeys = readFileSync(
      join(ROOT, "lib/executive-dashboard/passkeys/rate-limit.ts"),
      "utf8",
    );
    assert.match(durable, /consumeRateLimitWindows/);
    assert.match(durable, /parseContinuumEnv\(\) !== "preview"/);
    assert.match(durable, /preview-isolated/);
    assert.match(durable, /CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF/);
    assert.match(durable, /CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF/);
    assert.doesNotMatch(durable, /create table|consume_abuse_rate_limit/);
    assert.match(password, /FOUNDER_AUTH_RATE_LIMIT_NAMESPACES\.password/);
    assert.match(passkeys, /FOUNDER_AUTH_RATE_LIMIT_NAMESPACES\.passkeyIssue/);
    assert.match(passkeys, /FOUNDER_AUTH_RATE_LIMIT_NAMESPACES\.passkeyVerify/);
    assert.match(passkeys, /FOUNDER_AUTH_RATE_LIMIT_NAMESPACES\.pairingClaim/);
    assert.equal(
      FOUNDER_AUTH_RATE_LIMIT_NAMESPACES.password,
      "continuum:founder:password",
    );
    assert.equal(
      FOUNDER_AUTH_RATE_LIMIT_NAMESPACES.passkeyIssue,
      "continuum:founder:passkey-issue",
    );
    assert.equal(
      FOUNDER_AUTH_RATE_LIMIT_NAMESPACES.passkeyVerify,
      "continuum:founder:passkey-verify",
    );
    assert.equal(
      FOUNDER_AUTH_RATE_LIMIT_NAMESPACES.pairingClaim,
      "continuum:founder:pairing-claim",
    );
  });
});
