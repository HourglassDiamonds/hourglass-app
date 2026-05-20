import { isGa4OAuthConfigured } from "./google-oauth";

function optional(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

/** GA4 + Supabase — required to generate and persist a weekly report. */
export function getWeeklyPipelineEnv(): boolean {
  return isGa4OAuthConfigured() && getSupabaseEnv() !== null;
}

export function getSupabaseEnv(): {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
} | null {
  const supabaseUrl = optional("SUPABASE_URL");
  const supabaseServiceRoleKey = optional("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  return { supabaseUrl, supabaseServiceRoleKey };
}

export function getCronSecret(): string | null {
  return optional("CRON_SECRET") ?? null;
}

export function isResendConfigured(): boolean {
  return Boolean(
    optional("RESEND_API_KEY") &&
      optional("INTELLIGENCE_EMAIL_FROM") &&
      optional("INTELLIGENCE_EMAIL_TO"),
  );
}

export function isLocalDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}
