/**
 * Report whether the current process env is an isolated Continuum Preview.
 * Does not print secret values. Does not write. Does not enable Gmail sync.
 *
 * Usage: npx tsx scripts/continuum-preview-isolation-assert.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  continuumEnvLogLabel,
  isGmailIncrementalAllowedInCurrentEnv,
  isProductionSupabaseUrl,
  parseContinuumEnv,
  previewSupabaseProjectRef,
  productionSupabaseProjectRef,
  resolveContinuumIsolationState,
  supabaseProjectRefFromUrl,
  assertContinuumPreviewIsolation,
} from "../lib/continuum/runtime-env";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "../lib/intelligence/env";
import { isGmailIncrementalSyncEnabled } from "../lib/continuum/gmail/env";

const ALLOWED_ENV_KEYS = new Set([
  "CONTINUUM_ENV",
  "VERCEL_ENV",
  "SUPABASE_URL",
  "CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF",
  "CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF",
]);

function loadPrivilegedCredentialFromSandboxOnly(): void {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const path = resolve(process.cwd(), ".env.continuum-preview.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== "SUPABASE_SERVICE_ROLE_KEY") continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadIncrementalFlagFromSandboxOnly(): void {
  delete process.env.CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED;
  const path = resolve(process.cwd(), ".env.continuum-preview.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== "CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED") continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadAllowlistedEnvFile(
  relativePath: string,
  options?: { override?: boolean },
): void {
  const path = resolve(process.cwd(), relativePath);
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!ALLOWED_ENV_KEYS.has(key)) continue;
    if (!options?.override && process.env[key]?.trim()) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadAllowlistedEnvFile(".env");
loadAllowlistedEnvFile(".env.local");
loadAllowlistedEnvFile(".env.continuum-preview.local", { override: true });
loadIncrementalFlagFromSandboxOnly();
loadPrivilegedCredentialFromSandboxOnly();

const continuum = parseContinuumEnv();
const state = resolveContinuumIsolationState();
const ref = supabaseProjectRefFromUrl();
const gmailAllowed = isGmailIncrementalAllowedInCurrentEnv();
const gmailIncrementalSyncEnabled = isGmailIncrementalSyncEnabled();
const urlPresent = Boolean(getSupabaseUrl());
const privilegedCredentialPresent = Boolean(getSupabaseServiceRoleKey());

let previewGuardError: string | null = null;
if (continuum === "preview") {
  try {
    assertContinuumPreviewIsolation();
  } catch (error) {
    previewGuardError =
      error instanceof Error ? error.message : "preview isolation failed";
  }
}

const report = {
  ok:
    continuum !== "preview" ||
    (state === "preview-isolated" && previewGuardError === null),
  continuumEnv: continuum,
  isolation: state,
  previewRef: previewSupabaseProjectRef(),
  productionRef: productionSupabaseProjectRef(),
  supabaseUrlPresent: urlPresent,
  supabaseProjectRefPresent: Boolean(ref),
  privilegedCredentialPresent,
  usesProductionSupabase: isProductionSupabaseUrl(),
  gmailIncrementalAllowed: gmailAllowed,
  gmailIncrementalSyncEnabled,
  label: continuumEnvLogLabel(),
  ...(previewGuardError ? { isolationError: previewGuardError } : {}),
};

console.info(JSON.stringify(report, null, 2));

if (previewGuardError) {
  console.error(previewGuardError);
  process.exit(1);
}
if (continuum === "preview" && state !== "preview-isolated") {
  process.exit(1);
}
