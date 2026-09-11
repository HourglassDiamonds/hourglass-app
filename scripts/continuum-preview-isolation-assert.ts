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
  resolveContinuumIsolationState,
  supabaseProjectRefFromUrl,
} from "../lib/continuum/runtime-env";
import { getSupabaseUrl } from "../lib/intelligence/env";

const ALLOWED_ENV_KEYS = new Set([
  "CONTINUUM_ENV",
  "VERCEL_ENV",
  "SUPABASE_URL",
  "CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF",
  "CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF",
]);

function loadAllowlistedEnvFile(relativePath: string): void {
  const path = resolve(process.cwd(), relativePath);
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!ALLOWED_ENV_KEYS.has(key) || process.env[key]?.trim()) continue;
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

const continuum = parseContinuumEnv();
const state = resolveContinuumIsolationState();
const ref = supabaseProjectRefFromUrl();
const gmailAllowed = isGmailIncrementalAllowedInCurrentEnv();
const urlPresent = Boolean(getSupabaseUrl());

const report = {
  ok: continuum !== "preview" || state === "preview-isolated",
  continuumEnv: continuum,
  isolation: state,
  supabaseUrlPresent: urlPresent,
  supabaseProjectRefPresent: Boolean(ref),
  usesProductionSupabase: isProductionSupabaseUrl(),
  gmailIncrementalAllowed: gmailAllowed,
  label: continuumEnvLogLabel(),
};

console.info(JSON.stringify(report, null, 2));

if (continuum === "preview" && state !== "preview-isolated") {
  process.exit(1);
}
