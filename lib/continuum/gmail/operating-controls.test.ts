import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
  CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
  isVerifiedContinuumOperationalRuntime,
  isVerifiedContinuumProductionStagingRuntime,
  isVerifiedDurableFounderRuntime,
} from "@/lib/continuum/runtime-env";
import {
  isGmailManualRefreshEnabled,
  isGmailRecurringSyncEnabled,
} from "./env";

const PROD_URL = `https://${CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`;
const PREVIEW_URL = `https://${CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF}.supabase.co`;
const KEYS = [
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_PROJECT_ID",
  "VERCEL_GIT_COMMIT_SHA",
  "CONTINUUM_ENV",
  "CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF",
  "CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF",
  "CONTINUUM_PRODUCTION_STAGING_ENABLED",
  "CONTINUUM_PRODUCTION_STAGING_PROJECT_ID",
  "CONTINUUM_PRODUCTION_STAGING_COMMIT_SHA",
  "CONTINUUM_GMAIL_RECURRING_SYNC_ENABLED",
  "CONTINUUM_GMAIL_MANUAL_REFRESH_ENABLED",
  "CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED",
  "SUPABASE_URL",
] as const;

const previous = new Map<string, string | undefined>();

function setEnv(values: Record<string, string | undefined>): void {
  for (const key of KEYS) {
    if (!previous.has(key)) previous.set(key, process.env[key]);
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function production(overrides: Record<string, string | undefined> = {}) {
  setEnv({
    VERCEL: "1",
    VERCEL_ENV: "production",
    CONTINUUM_ENV: "production",
    CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
    CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
    SUPABASE_URL: PROD_URL,
    ...overrides,
  });
}

afterEach(() => {
  for (const [key, value] of previous) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  previous.clear();
});

describe("Continuum Gmail operating controls", { concurrency: false }, () => {
  it("keeps every new control default off and ignores the retired shared flag", () => {
    production({ CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED: "true" });
    assert.equal(isVerifiedContinuumOperationalRuntime(), true);
    assert.equal(isGmailRecurringSyncEnabled(), false);
    assert.equal(isGmailManualRefreshEnabled(), false);
  });

  it("allows founder-manual refresh while recurring cron remains off", () => {
    production({
      CONTINUUM_GMAIL_RECURRING_SYNC_ENABLED: "false",
      CONTINUUM_GMAIL_MANUAL_REFRESH_ENABLED: "true",
    });
    assert.equal(isGmailManualRefreshEnabled(), true);
    assert.equal(isGmailRecurringSyncEnabled(), false);
  });

  it("allows recurring cron without implicitly authorizing founder-manual refresh", () => {
    production({
      CONTINUUM_GMAIL_RECURRING_SYNC_ENABLED: "true",
      CONTINUUM_GMAIL_MANUAL_REFRESH_ENABLED: "false",
    });
    assert.equal(isGmailRecurringSyncEnabled(), true);
    assert.equal(isGmailManualRefreshEnabled(), false);
  });

  it("fails closed for the wrong database or Vercel environment identity", () => {
    production({
      SUPABASE_URL: PREVIEW_URL,
      CONTINUUM_GMAIL_RECURRING_SYNC_ENABLED: "true",
      CONTINUUM_GMAIL_MANUAL_REFRESH_ENABLED: "true",
    });
    assert.equal(isVerifiedContinuumOperationalRuntime(), false);
    assert.equal(isGmailRecurringSyncEnabled(), false);
    assert.equal(isGmailManualRefreshEnabled(), false);

    production({ VERCEL_ENV: "preview", CONTINUUM_GMAIL_MANUAL_REFRESH_ENABLED: "true" });
    assert.equal(isVerifiedContinuumOperationalRuntime(), false);
    assert.equal(isGmailManualRefreshEnabled(), false);
  });

  it("retains isolated Preview operation behind the caller-specific switches", () => {
    setEnv({
      VERCEL: "1",
      VERCEL_ENV: "preview",
      CONTINUUM_ENV: "preview",
      CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
      CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
      SUPABASE_URL: PREVIEW_URL,
      CONTINUUM_GMAIL_RECURRING_SYNC_ENABLED: "false",
      CONTINUUM_GMAIL_MANUAL_REFRESH_ENABLED: "true",
    });
    assert.equal(isVerifiedContinuumOperationalRuntime(), true);
    assert.equal(isGmailManualRefreshEnabled(), true);
    assert.equal(isGmailRecurringSyncEnabled(), false);
  });

  it("permits an exact pinned Production staging identity for durable auth only", () => {
    production({
      VERCEL_ENV: "preview",
      VERCEL_PROJECT_ID: "prj_stage",
      VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
      CONTINUUM_PRODUCTION_STAGING_ENABLED: "true",
      CONTINUUM_PRODUCTION_STAGING_PROJECT_ID: "prj_stage",
      CONTINUUM_PRODUCTION_STAGING_COMMIT_SHA: "a".repeat(40),
      CONTINUUM_GMAIL_MANUAL_REFRESH_ENABLED: "true",
      CONTINUUM_GMAIL_RECURRING_SYNC_ENABLED: "true",
    });
    assert.equal(isVerifiedContinuumProductionStagingRuntime(), true);
    assert.equal(isVerifiedDurableFounderRuntime(), true);
    assert.equal(isVerifiedContinuumOperationalRuntime(), false);
    assert.equal(isGmailManualRefreshEnabled(), false);
    assert.equal(isGmailRecurringSyncEnabled(), false);

    process.env.VERCEL_GIT_COMMIT_SHA = "b".repeat(40);
    assert.equal(isVerifiedContinuumProductionStagingRuntime(), false);
    assert.equal(isVerifiedDurableFounderRuntime(), false);
  });
});
