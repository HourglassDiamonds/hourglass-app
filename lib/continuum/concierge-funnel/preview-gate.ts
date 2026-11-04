import {
  CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
  parseContinuumEnv,
  previewSupabaseProjectRef,
  resolveContinuumIsolationState,
  supabaseProjectRefFromUrl,
  vercelEnvName,
} from "../runtime-env";

export const CONCIERGE_PREVIEW_INTEGRATION_FLAG =
  "CONTINUUM_CONCIERGE_PREVIEW_INTEGRATION_ENABLED" as const;
export const CONCIERGE_PREVIEW_ACCEPTANCE_FLAG =
  "CONTINUUM_CONCIERGE_PREVIEW_SYNTHETIC_ACCEPTANCE_ENABLED" as const;

type PreviewGateEnv = Record<string, string | undefined>;

/** Fail-closed hosted gate; local test suites call the pure application seam. */
export function conciergePreviewAcceptanceEnabled(
  env: PreviewGateEnv = process.env,
): boolean {
  if (env[CONCIERGE_PREVIEW_INTEGRATION_FLAG]?.trim() !== "true") return false;
  if (env[CONCIERGE_PREVIEW_ACCEPTANCE_FLAG]?.trim() !== "true") return false;
  if (parseContinuumEnv(env.CONTINUUM_ENV) !== "preview") return false;
  if (vercelEnvName(env.VERCEL_ENV) !== "preview") return false;
  if (
    previewSupabaseProjectRef(env.CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF) !==
    CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF
  ) {
    return false;
  }
  if (
    supabaseProjectRefFromUrl(env.SUPABASE_URL) !==
    CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF
  ) {
    return false;
  }
  return (
    resolveContinuumIsolationState({
      continuumEnv: env.CONTINUUM_ENV,
      vercelEnv: env.VERCEL_ENV,
      supabaseUrl: env.SUPABASE_URL,
      productionRef: env.CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
      previewRef: env.CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
    }) === "preview-isolated"
  );
}
