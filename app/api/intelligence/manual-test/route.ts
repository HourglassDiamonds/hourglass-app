import { NextResponse } from "next/server";
import { verifyCronQuerySecret } from "@/lib/intelligence/cron-auth";
import {
  getGa4PropertyId,
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleRefreshToken,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  getWeeklyPipelineEnv,
} from "@/lib/intelligence/env";
import { isGa4Configured } from "@/lib/integrations/ga4";
import { runWeeklyIntelligenceJob } from "@/lib/intelligence/weekly-report";
import { isSupabaseConfigured } from "@/lib/supabase/client";

function intelligenceEnvDebug() {
  return {
    GA4_PROPERTY_ID: !!process.env.GA4_PROPERTY_ID,
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN: !!process.env.GOOGLE_REFRESH_TOKEN,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: !!process.env.CRON_SECRET,
  };
}

/** Booleans from lib/intelligence/env getters (same path as the weekly job). */
function intelligenceGetterDebug() {
  return {
    GA4_PROPERTY_ID: !!getGa4PropertyId(),
    GOOGLE_CLIENT_ID: !!getGoogleClientId(),
    GOOGLE_CLIENT_SECRET: !!getGoogleClientSecret(),
    GOOGLE_REFRESH_TOKEN: !!getGoogleRefreshToken(),
    SUPABASE_URL: !!getSupabaseUrl(),
    SUPABASE_SERVICE_ROLE_KEY: !!getSupabaseServiceRoleKey(),
    getWeeklyPipelineEnv: getWeeklyPipelineEnv(),
    isGa4Configured: isGa4Configured(),
    isSupabaseConfigured: isSupabaseConfigured(),
  };
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

// TODO: Remove this route after production GA4 → Supabase → dashboard verification is complete.

/**
 * Browser-friendly GET smoke test — same job as POST /api/intelligence/weekly-report.
 * Auth: ?secret=<CRON_SECRET> (never commit or share the URL with the secret).
 */
export async function GET(request: Request) {
  if (!verifyCronQuerySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runWeeklyIntelligenceJob();
  const status = result.ok ? 200 : 500;
  return NextResponse.json(result, { status });
}
