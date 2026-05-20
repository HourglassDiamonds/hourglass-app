/**
 * Server-only intelligence env hygiene.
 * Called from instrumentation.ts on Node startup — never import from client components.
 */

import { isGa4OAuthConfigured } from "./google-oauth";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/** Must NEVER use a NEXT_PUBLIC_ prefix. */
export const SERVER_ONLY_INTELLIGENCE_ENV = [
  "GA4_PROPERTY_ID",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "INTELLIGENCE_EMAIL_FROM",
  "INTELLIGENCE_EMAIL_TO",
  "CRON_SECRET",
] as const;

/** Also server-only (existing app routes) — not for client bundles. */
export const SERVER_ONLY_APP_ENV = [
  "HUBSPOT_ACCESS_TOKEN",
  "HUBSPOT_PRIVATE_APP_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
] as const;

/** Safe to expose in the browser. */
export const CLIENT_SAFE_PUBLIC_ENV = ["NEXT_PUBLIC_GA_ID"] as const;

let warnedMissing = false;

function isServerRuntime(): boolean {
  return typeof window === "undefined";
}

function missingGa4OAuthVars(): string[] {
  const names = [
    "GA4_PROPERTY_ID",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
  ] as const;
  return names.filter((name) => !optional(name));
}

function missingIntelligenceVars(): string[] {
  const missing: string[] = [];
  if (!isGa4OAuthConfigured()) {
    missing.push(...missingGa4OAuthVars());
  }
  if (!isSupabaseConfigured()) {
    missing.push("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!optional("RESEND_API_KEY")) missing.push("RESEND_API_KEY");
  if (!optional("INTELLIGENCE_EMAIL_FROM")) missing.push("INTELLIGENCE_EMAIL_FROM");
  if (!optional("INTELLIGENCE_EMAIL_TO")) missing.push("INTELLIGENCE_EMAIL_TO");
  if (!optional("CRON_SECRET")) missing.push("CRON_SECRET");
  return missing;
}

function optional(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

/** Warn once if intelligence cron/dashboard persistence env is incomplete. */
export function validateIntelligenceEnvOnStartup(): void {
  if (!isServerRuntime() || warnedMissing) return;
  warnedMissing = true;

  assertNoPrefixedServerSecrets();

  const missing = missingIntelligenceVars();
  const ga4Ready = isGa4OAuthConfigured();
  const supabaseReady = isSupabaseConfigured();

  if (!ga4Ready && !supabaseReady) {
    console.warn(
      "[hourglass:intelligence] Intelligence env not configured (weekly cron and live dashboard snapshots disabled). See docs/intelligence-engine-setup.md",
    );
    return;
  }

  if (!ga4Ready) {
    console.warn(
      "[hourglass:intelligence] GA4 OAuth not configured — set GA4_PROPERTY_ID and Google OAuth vars. GET /api/intelligence/google-auth-url for setup.",
    );
  }

  if (missing.length > 0) {
    console.warn(
      `[hourglass:intelligence] Partial intelligence config — missing: ${missing.join(", ")}`,
    );
  }
}

/**
 * Fail fast if a server secret is mistakenly exposed via NEXT_PUBLIC_*.
 */
export function assertNoPrefixedServerSecrets(): void {
  if (!isServerRuntime()) return;

  const forbiddenPrefixes = [
    ...SERVER_ONLY_INTELLIGENCE_ENV,
    ...SERVER_ONLY_APP_ENV,
    "GOOGLE_OAUTH_REDIRECT_URI",
  ];

  for (const name of forbiddenPrefixes) {
    const exposed = process.env[`NEXT_PUBLIC_${name}`];
    if (exposed?.trim()) {
      throw new Error(
        `[hourglass:security] ${name} must not use NEXT_PUBLIC_ — server-only.`,
      );
    }
  }
}
