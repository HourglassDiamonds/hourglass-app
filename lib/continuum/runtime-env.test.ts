import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
  CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
  SERVER_ONLY_CONTINUUM_RUNTIME_ENV,
  assertContinuumPreviewIsolation,
  continuumEnvBadge,
  continuumEnvLogLabel,
  isGmailIncrementalAllowedInCurrentEnv,
  isPreviewLikeRuntime,
  isPrivilegedSupabaseServerCredential,
  isProductionSupabaseUrl,
  parseContinuumEnv,
  resolveContinuumIsolationState,
  supabaseProjectRefFromUrl,
} from "./runtime-env";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PROD_URL = `https://${CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`;
const PREVIEW_REF = "continuumpreviewxxxx";
const PREVIEW_URL = `https://${PREVIEW_REF}.supabase.co`;
const CANONICAL_PREVIEW_URL = `https://${CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF}.supabase.co`;
const FAKE_SECRET = "sb_secret_test_preview_credential_not_real";
const FAKE_LEGACY = "eyJtest_legacy_preview_credential_not_a_real_jwt";
const FAKE_PUBLISHABLE = "sb_publishable_test_not_a_privileged_key";

function previewIsolationInput(
  overrides: {
    continuumEnv?: string;
    vercelEnv?: string;
    supabaseUrl?: string;
    productionRef?: string;
    previewRef?: string;
    serviceRoleKey?: string;
  } = {},
) {
  return {
    continuumEnv: "preview",
    supabaseUrl: CANONICAL_PREVIEW_URL,
    previewRef: CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
    productionRef: CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
    serviceRoleKey: FAKE_SECRET,
    ...overrides,
  };
}

function assertErrorDoesNotRevealSecret(
  error: unknown,
  secret: string,
): void {
  assert.ok(error instanceof Error);
  assert.doesNotMatch(error.message, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(error.message, /sb_secret_[A-Za-z0-9_]+/);
  assert.doesNotMatch(error.message, /sb_publishable_[A-Za-z0-9_]+/);
}

const ENV_KEYS = [
  "CONTINUUM_ENV",
  "VERCEL_ENV",
  "SUPABASE_URL",
  "CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF",
  "CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF",
] as const;

function snapshotEnv(): Record<(typeof ENV_KEYS)[number], string | undefined> {
  return {
    CONTINUUM_ENV: process.env.CONTINUUM_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    SUPABASE_URL: process.env.SUPABASE_URL,
    CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF:
      process.env.CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
    CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF:
      process.env.CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
  };
}

function restoreEnv(
  prior: Record<(typeof ENV_KEYS)[number], string | undefined>,
): void {
  for (const key of ENV_KEYS) {
    const value = prior[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("Continuum runtime isolation", () => {
  it("parses CONTINUUM_ENV and extracts a Supabase project ref", () => {
    assert.equal(parseContinuumEnv("preview"), "preview");
    assert.equal(parseContinuumEnv("PRODUCTION"), "production");
    assert.equal(parseContinuumEnv(""), "unset");
    assert.equal(
      supabaseProjectRefFromUrl(PROD_URL),
      CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
    );
    assert.equal(isProductionSupabaseUrl(PROD_URL), true);
    assert.equal(isProductionSupabaseUrl(PREVIEW_URL), false);
  });

  it("does not treat unset Preview-like Vercel as isolated Production", () => {
    assert.equal(
      resolveContinuumIsolationState({
        continuumEnv: "",
        vercelEnv: "preview",
        supabaseUrl: PROD_URL,
      }),
      "preview-adjacent",
    );
    assert.equal(
      resolveContinuumIsolationState({
        continuumEnv: "preview",
        vercelEnv: "preview",
        supabaseUrl: PREVIEW_URL,
        previewRef: PREVIEW_REF,
      }),
      "preview-isolated",
    );
    assert.equal(
      resolveContinuumIsolationState({
        continuumEnv: "",
        vercelEnv: "production",
        supabaseUrl: PROD_URL,
      }),
      "production",
    );
  });

  it("fails closed when CONTINUUM_ENV=preview still points at Production", () => {
    assert.throws(
      () => assertContinuumPreviewIsolation(previewIsolationInput({ supabaseUrl: PROD_URL })),
      /must not use the Production Supabase project/,
    );
    assert.throws(
      () =>
        assertContinuumPreviewIsolation(
          previewIsolationInput({ previewRef: "" }),
        ),
      /CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF/,
    );
    assert.doesNotThrow(() =>
      assertContinuumPreviewIsolation(previewIsolationInput()),
    );
    assert.doesNotThrow(() =>
      assertContinuumPreviewIsolation({
        continuumEnv: "unset",
        vercelEnv: "preview",
        supabaseUrl: PROD_URL,
      }),
    );
  });

  it("blocks Gmail incremental in Preview until isolation is proven", () => {
    assert.equal(
      isGmailIncrementalAllowedInCurrentEnv({
        continuumEnv: "",
        vercelEnv: "production",
        supabaseUrl: PROD_URL,
      }),
      true,
    );
    assert.equal(
      isGmailIncrementalAllowedInCurrentEnv({
        continuumEnv: "",
        vercelEnv: "preview",
        supabaseUrl: PROD_URL,
      }),
      false,
    );
    assert.equal(
      isGmailIncrementalAllowedInCurrentEnv({
        continuumEnv: "preview",
        vercelEnv: "preview",
        supabaseUrl: PROD_URL,
        previewRef: PREVIEW_REF,
      }),
      false,
    );
    assert.equal(
      isGmailIncrementalAllowedInCurrentEnv({
        continuumEnv: "preview",
        vercelEnv: "preview",
        supabaseUrl: PREVIEW_URL,
        previewRef: PREVIEW_REF,
      }),
      true,
    );
    assert.equal(
      isGmailIncrementalAllowedInCurrentEnv({
        continuumEnv: "local",
        vercelEnv: "",
        supabaseUrl: PROD_URL,
      }),
      false,
    );
    assert.equal(
      isGmailIncrementalAllowedInCurrentEnv({
        continuumEnv: "local",
        vercelEnv: "",
        supabaseUrl: PREVIEW_URL,
      }),
      true,
    );
  });

  it("shows a non-production badge without exposing secrets", () => {
    const prior = snapshotEnv();
    try {
      process.env.CONTINUUM_ENV = "preview";
      process.env.VERCEL_ENV = "preview";
      process.env.SUPABASE_URL = PROD_URL;
      delete process.env.CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF;
      const adjacent = continuumEnvBadge();
      assert.equal(adjacent?.show, true);
      assert.equal(adjacent?.isolation, "adjacent");
      assert.match(adjacent?.label ?? "", /production data/);
      process.env.SUPABASE_URL = PREVIEW_URL;
      process.env.CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF = PREVIEW_REF;
      const isolated = continuumEnvBadge();
      assert.equal(isolated?.label, "Preview sandbox");
      assert.equal(isolated?.isolation, "isolated");
      process.env.CONTINUUM_ENV = "production";
      process.env.VERCEL_ENV = "production";
      assert.equal(continuumEnvBadge(), null);
      process.env.CONTINUUM_ENV = "local";
      delete process.env.VERCEL_ENV;
      assert.equal(continuumEnvBadge()?.label, "Local");
      const label = continuumEnvLogLabel();
      assert.match(label, /continuum_env=/);
      assert.doesNotMatch(label, /service_role|eyJ|sk_|sb_secret/i);
    } finally {
      restoreEnv(prior);
    }
  });

  it("keeps runtime env names server-only and wired into Preview guards", () => {
    const source = readFileSync(join(ROOT, "lib/continuum/runtime-env.ts"), "utf8");
    const env = readFileSync(join(ROOT, "lib/continuum/gmail/env.ts"), "utf8");
    const client = readFileSync(join(ROOT, "lib/supabase/client.ts"), "utf8");
    const instrumentation = readFileSync(join(ROOT, "instrumentation.ts"), "utf8");
    const cron = readFileSync(
      join(ROOT, "app/api/cron/continuum-gmail-freshness/route.ts"),
      "utf8",
    );
    const layout = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/layout.tsx"),
      "utf8",
    );
    const example = readFileSync(join(ROOT, ".env.example"), "utf8");
    assert.deepEqual(SERVER_ONLY_CONTINUUM_RUNTIME_ENV, [
      "CONTINUUM_ENV",
      "CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF",
      "CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF",
    ]);
    assert.match(source, /CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF/);
    assert.match(env, /isGmailIncrementalAllowedInCurrentEnv/);
    assert.match(client, /assertContinuumPreviewIsolation/);
    assert.match(instrumentation, /validateContinuumRuntimeEnvOnStartup/);
    assert.match(cron, /continuumEnvLogLabel/);
    assert.match(layout, /ContinuumEnvBadge/);
    assert.match(example, /CONTINUUM_ENV=preview/);
    assert.match(example, /\.env\.continuum-preview\.local/);
    assert.equal(isPreviewLikeRuntime({ vercelEnv: "preview" }), true);
    const isolationAssert = readFileSync(
      join(ROOT, "scripts/continuum-preview-isolation-assert.ts"),
      "utf8",
    );
    const launcher = readFileSync(
      join(ROOT, "scripts/continuum-preview-dev.mjs"),
      "utf8",
    );
    assert.match(isolationAssert, /\.env\.continuum-preview\.local/);
    assert.match(isolationAssert, /override: true/);
    assert.match(isolationAssert, /previewRef/);
    assert.match(isolationAssert, /gmailIncrementalSyncEnabled/);
    assert.match(isolationAssert, /loadIncrementalFlagFromSandboxOnly/);
    assert.match(launcher, /hrmpzplffuhhvbtxxhnt/);
    assert.match(launcher, /bnafadfgrrriblppeubp/);
    assert.match(launcher, /NEVER_INHERIT/);
    assert.match(launcher, /PREVIEW_OWNED_AUTH_KEYS/);
    assert.match(launcher, /EXECUTIVE_DASHBOARD_USERNAME/);
    assert.match(launcher, /EXECUTIVE_DASHBOARD_PASSWORD_HASH/);
    assert.match(launcher, /applyPreviewOwnedAuthFromSandbox/);
    assert.match(launcher, /assertSandboxDashboardAuth/);
    assert.match(launcher, /continuum-preview-pin-auth\.cjs/);
    assert.match(launcher, /--require/);
    const pinAuth = readFileSync(
      join(ROOT, "scripts/continuum-preview-pin-auth.cjs"),
      "utf8",
    );
    assert.match(pinAuth, /EXECUTIVE_DASHBOARD_USERNAME/);
    assert.match(pinAuth, /EXECUTIVE_DASHBOARD_PASSWORD_HASH/);
    assert.match(pinAuth, /\.env\.development\.local/);
    assert.doesNotMatch(pinAuth, /console\.(log|info|error|warn)/);
    assert.match(launcher, /delete process\.env\.CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED/);
    assert.match(launcher, /for \(const key of PREVIEW_OWNED_AUTH_KEYS\) delete process\.env\[key\]/);
    assert.match(launcher, /CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED/);
    assert.doesNotMatch(
      launcher,
      /must stay unset for this local sandbox/,
    );
    assert.match(
      launcher,
      /must be true, 1, or unset/,
    );
    assert.doesNotMatch(launcher, /console\.(log|info|error|warn)\([^)]*SERVICE_ROLE/);
    assert.doesNotMatch(launcher, /console\.(log|info|error|warn)\([^)]*TOKEN_KEK/);
    assert.doesNotMatch(launcher, /console\.(log|info|error|warn)\([^)]*PASSWORD_HASH/);
    assert.doesNotMatch(launcher, /decodeJwtPayload|JSON\.parse\(json\)|base64url/);
    assert.doesNotMatch(launcher, /recognizable Supabase JWT|payload\?\.ref|role !== "service_role"/);
    assert.doesNotMatch(source, /decodeJwt|jwt\.decode|payload\.ref/);
    assert.doesNotMatch(isolationAssert, /decodeJwt|JSON\.parse\([^)]*base64/);
    assert.match(source, /isPrivilegedSupabaseServerCredential/);
    assert.match(source, /sb_secret_/);
    assert.match(source, /sb_publishable_/);
    assert.match(launcher, /sb_secret_/);
    assert.match(launcher, /sb_publishable_/);
    assert.match(isolationAssert, /privilegedCredentialPresent/);
    assert.match(isolationAssert, /loadPrivilegedCredentialFromSandboxOnly/);
    assert.match(isolationAssert, /assertContinuumPreviewIsolation/);
    assert.doesNotMatch(
      isolationAssert,
      /console\.(info|error|warn)\([^)]*getSupabaseServiceRoleKey\(\)/,
    );
  });
});

describe("Continuum Preview privileged credential isolation", () => {
  it("treats sb_secret_ as an opaque privileged credential and rejects publishable keys", () => {
    assert.equal(isPrivilegedSupabaseServerCredential(FAKE_SECRET), true);
    assert.equal(isPrivilegedSupabaseServerCredential(FAKE_LEGACY), true);
    assert.equal(isPrivilegedSupabaseServerCredential(FAKE_PUBLISHABLE), false);
    assert.equal(isPrivilegedSupabaseServerCredential(""), false);
    assert.equal(isPrivilegedSupabaseServerCredential("sb_secret_"), false);
    assert.equal(isPrivilegedSupabaseServerCredential("not-a-secret"), false);
  });

  it("passes Preview isolation with a fake sb_secret_ credential", () => {
    assert.doesNotThrow(() =>
      assertContinuumPreviewIsolation(previewIsolationInput()),
    );
  });

  it("retains opaque legacy-shaped credentials without JWT decoding", () => {
    assert.doesNotThrow(() =>
      assertContinuumPreviewIsolation(
        previewIsolationInput({ serviceRoleKey: FAKE_LEGACY }),
      ),
    );
  });

  it("fails closed when Preview still points at the Production URL", () => {
    try {
      assertContinuumPreviewIsolation(
        previewIsolationInput({ supabaseUrl: PROD_URL }),
      );
      assert.fail("expected Production URL to fail closed");
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.match(error.message, /must not use the Production Supabase project/);
      assertErrorDoesNotRevealSecret(error, FAKE_SECRET);
    }
  });

  it("fails closed when Preview and Production refs are the same", () => {
    try {
      assertContinuumPreviewIsolation(
        previewIsolationInput({
          previewRef: CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
          productionRef: CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
        }),
      );
      assert.fail("expected equal refs to fail closed");
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.match(error.message, /must not be the same/);
      assertErrorDoesNotRevealSecret(error, FAKE_SECRET);
    }
  });

  it("fails closed when the Preview ref is missing", () => {
    assert.throws(
      () =>
        assertContinuumPreviewIsolation(
          previewIsolationInput({ previewRef: "" }),
        ),
      /CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF/,
    );
  });

  it("fails closed when the Production ref is missing", () => {
    assert.throws(
      () =>
        assertContinuumPreviewIsolation(
          previewIsolationInput({ productionRef: "" }),
        ),
      /CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF/,
    );
  });

  it("fails closed when the privileged credential is missing", () => {
    try {
      assertContinuumPreviewIsolation(
        previewIsolationInput({ serviceRoleKey: "" }),
      );
      assert.fail("expected missing privileged credential to fail closed");
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.match(error.message, /privileged Supabase server credential/);
      assertErrorDoesNotRevealSecret(error, FAKE_SECRET);
    }
  });

  it("fails closed when a publishable client key is used as the privileged credential", () => {
    try {
      assertContinuumPreviewIsolation(
        previewIsolationInput({ serviceRoleKey: FAKE_PUBLISHABLE }),
      );
      assert.fail("expected publishable key to fail closed");
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.match(error.message, /must not be a publishable client key/);
      assertErrorDoesNotRevealSecret(error, FAKE_PUBLISHABLE);
    }
  });

  it("rejects a URL that only contains the Preview ref as a substring", () => {
    assert.throws(
      () =>
        assertContinuumPreviewIsolation(
          previewIsolationInput({
            supabaseUrl: `https://example.invalid/?next=${CANONICAL_PREVIEW_URL}`,
          }),
        ),
      /requires a Supabase project URL/,
    );
  });

  it("stays inert when CONTINUUM_ENV is not preview", () => {
    assert.doesNotThrow(() =>
      assertContinuumPreviewIsolation({
        continuumEnv: "production",
        supabaseUrl: PROD_URL,
        serviceRoleKey: FAKE_PUBLISHABLE,
      }),
    );
    assert.doesNotThrow(() =>
      assertContinuumPreviewIsolation({
        continuumEnv: "unset",
        supabaseUrl: PROD_URL,
        serviceRoleKey: "",
      }),
    );
  });

  it("does not put the privileged credential into diagnostic labels", () => {
    const priorKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const prior = snapshotEnv();
    try {
      process.env.CONTINUUM_ENV = "preview";
      process.env.SUPABASE_URL = CANONICAL_PREVIEW_URL;
      process.env.CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF =
        CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF;
      process.env.CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF =
        CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF;
      process.env.SUPABASE_SERVICE_ROLE_KEY = FAKE_SECRET;
      const label = continuumEnvLogLabel();
      assert.match(label, /continuum_env=preview/);
      assert.doesNotMatch(label, /sb_secret_test_preview_credential_not_real/);
      assert.doesNotMatch(label, /service_role|eyJ|sk_|sb_secret/i);
    } finally {
      restoreEnv(prior);
      if (priorKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = priorKey;
    }
  });

  it("does not require JWT parsing in Preview isolation source", () => {
    const source = readFileSync(join(ROOT, "lib/continuum/runtime-env.ts"), "utf8");
    const launcher = readFileSync(
      join(ROOT, "scripts/continuum-preview-dev.mjs"),
      "utf8",
    );
    assert.doesNotMatch(source, /split\("\."\)|base64url|payload\?\.role/);
    assert.doesNotMatch(launcher, /decodeJwtPayload|parts\[1\]|payload\?\.ref/);
  });
});
