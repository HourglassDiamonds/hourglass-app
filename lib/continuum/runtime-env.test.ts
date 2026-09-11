import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
  SERVER_ONLY_CONTINUUM_RUNTIME_ENV,
  assertContinuumPreviewIsolation,
  continuumEnvBadge,
  continuumEnvLogLabel,
  isGmailIncrementalAllowedInCurrentEnv,
  isPreviewLikeRuntime,
  isProductionSupabaseUrl,
  parseContinuumEnv,
  resolveContinuumIsolationState,
  supabaseProjectRefFromUrl,
} from "./runtime-env";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PROD_URL = `https://${CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`;
const PREVIEW_REF = "continuumpreviewxxxx";
const PREVIEW_URL = `https://${PREVIEW_REF}.supabase.co`;

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
      () =>
        assertContinuumPreviewIsolation({
          continuumEnv: "preview",
          supabaseUrl: PROD_URL,
          previewRef: PREVIEW_REF,
        }),
      /must not use the Production Supabase project/,
    );
    assert.throws(
      () =>
        assertContinuumPreviewIsolation({
          continuumEnv: "preview",
          supabaseUrl: PREVIEW_URL,
        }),
      /CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF/,
    );
    assert.doesNotThrow(() =>
      assertContinuumPreviewIsolation({
        continuumEnv: "preview",
        supabaseUrl: PREVIEW_URL,
        previewRef: PREVIEW_REF,
      }),
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
    assert.equal(isPreviewLikeRuntime({ vercelEnv: "preview" }), true);
  });
});
