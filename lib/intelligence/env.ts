/**
 * Server-only env — static process.env.* access (required for Next/Vercel server bundles).
 * Do not use dynamic process.env[name]; do not read from .env.local here.
 */
function trimmed(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v || undefined;
}

export function getSupabaseUrl(): string | undefined {
  return trimmed(process.env.SUPABASE_URL);
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return trimmed(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getGoogleClientId(): string | undefined {
  return trimmed(process.env.GOOGLE_CLIENT_ID);
}

export function getGoogleClientSecret(): string | undefined {
  return trimmed(process.env.GOOGLE_CLIENT_SECRET);
}

export function getGoogleRefreshToken(): string | undefined {
  return trimmed(process.env.GOOGLE_REFRESH_TOKEN);
}

export function getGa4PropertyId(): string | undefined {
  return trimmed(process.env.GA4_PROPERTY_ID);
}

export function getGoogleOAuthRedirectUri(): string | undefined {
  return trimmed(process.env.GOOGLE_OAUTH_REDIRECT_URI);
}

export function getCronSecret(): string | null {
  return trimmed(process.env.CRON_SECRET) ?? null;
}

export function getResendApiKey(): string | undefined {
  return trimmed(process.env.RESEND_API_KEY);
}

export function getIntelligenceEmailFrom(): string | undefined {
  return trimmed(process.env.INTELLIGENCE_EMAIL_FROM);
}

export function getIntelligenceEmailTo(): string | undefined {
  return trimmed(process.env.INTELLIGENCE_EMAIL_TO);
}

function isGa4OAuthEnvComplete(): boolean {
  return Boolean(
    getGoogleClientId() &&
      getGoogleClientSecret() &&
      getGoogleRefreshToken() &&
      getGa4PropertyId(),
  );
}

/** GA4 + Supabase — required to generate and persist a weekly report. */
export function getWeeklyPipelineEnv(): boolean {
  return isGa4OAuthEnvComplete() && getSupabaseEnv() !== null;
}

export function getSupabaseEnv(): {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
} | null {
  const supabaseUrl = getSupabaseUrl();
  const supabaseServiceRoleKey = getSupabaseServiceRoleKey();
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  return { supabaseUrl, supabaseServiceRoleKey };
}

export function isResendConfigured(): boolean {
  return Boolean(
    getResendApiKey() &&
      getIntelligenceEmailFrom() &&
      getIntelligenceEmailTo(),
  );
}

export function isLocalDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}
