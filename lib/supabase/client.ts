/**
 * Supabase admin client — SERVER ONLY.
 * Uses SUPABASE_SERVICE_ROLE_KEY (never NEXT_PUBLIC_*).
 * Import only from API routes, server components, or lib/intelligence jobs.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/intelligence/env";
import { assertNoPrefixedServerSecrets } from "@/lib/intelligence/validate-env";

let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  assertNoPrefixedServerSecrets();  if (admin) return admin;
  const env = getSupabaseEnv();
  if (!env) return null;
  admin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null;
}
