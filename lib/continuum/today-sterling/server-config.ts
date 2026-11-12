import "server-only";

import {
  isVerifiedContinuumOperationalRuntime,
  resolveContinuumIsolationState,
  vercelEnvName,
} from "@/lib/continuum/runtime-env";

export const STERLING_TODAY_SEMANTIC_FLAG = "CONTINUUM_STERLING_TODAY_SEMANTIC_ENABLED" as const;
export const STERLING_TODAY_SARAH_SEMANTIC_FLAG =
  "CONTINUUM_STERLING_TODAY_SARAH_SEMANTIC_ENABLED" as const;
export const STERLING_TODAY_DURABLE_LEASE_FLAG = "CONTINUUM_STERLING_TODAY_DURABLE_LEASE_ENABLED" as const;
export const STERLING_TODAY_CONTINUITY_HMAC_ENV = "CONTINUUM_STERLING_TODAY_CONTINUITY_HMAC_KEY" as const;
export const STERLING_TODAY_PUBLISHER_FLAG = "CONTINUUM_STERLING_TODAY_PUBLISHER_ENABLED" as const;
export const CONTINUUM_TODAY_MANUAL_RECOMPUTE_FLAG =
  "CONTINUUM_TODAY_MANUAL_RECOMPUTE_ENABLED" as const;
export const STERLING_OPERATIONAL_SHADOW_FLAG =
  "CONTINUUM_STERLING_OPERATIONAL_SHADOW_ENABLED" as const;
export const STERLING_OPERATIONAL_SHADOW_EXECUTION_ID_ENV =
  "CONTINUUM_STERLING_OPERATIONAL_SHADOW_EXECUTION_ID" as const;

export function isSterlingTodaySemanticFeatureEnabled(): boolean {
  return process.env[STERLING_TODAY_SEMANTIC_FLAG]?.trim().toLowerCase() === "true";
}

export function isSterlingTodaySarahSemanticFeatureEnabled(): boolean {
  return process.env[STERLING_TODAY_SARAH_SEMANTIC_FLAG]?.trim().toLowerCase() === "true";
}

export function isSterlingTodayDurableLeaseAvailable(): boolean {
  return process.env[STERLING_TODAY_DURABLE_LEASE_FLAG]?.trim().toLowerCase() === "true";
}

/**
 * Publisher activation requires independent Vercel, Continuum, and canonical
 * Supabase Preview identity checks. A single feature flag can never activate it.
 */
export function isSterlingTodayPreviewPublisherEnabled(): boolean {
  return isVerifiedSterlingTodayPreviewRuntime() &&
    process.env[STERLING_TODAY_PUBLISHER_FLAG]?.trim().toLowerCase() === "true";
}

export function isFounderManualTodayRecomputeEnabled(): boolean {
  return isVerifiedContinuumOperationalRuntime() &&
    process.env[CONTINUUM_TODAY_MANUAL_RECOMPUTE_FLAG]?.trim().toLowerCase() === "true";
}

export function isSterlingOperationalShadowEnabled(): boolean {
  return process.env[STERLING_OPERATIONAL_SHADOW_FLAG]?.trim().toLowerCase() === "true";
}

export function getSterlingOperationalShadowExecutionId(): string | null {
  const value = process.env[STERLING_OPERATIONAL_SHADOW_EXECUTION_ID_ENV]?.trim() ?? "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase()
    : null;
}

export function isVerifiedSterlingTodayPreviewRuntime(): boolean {
  return process.env.VERCEL?.trim() === "1" &&
    vercelEnvName() === "preview" &&
    process.env.CONTINUUM_ENV?.trim().toLowerCase() === "preview" &&
    resolveContinuumIsolationState() === "preview-isolated";
}

export function getSterlingTodayContinuityHmacKey(): string | null {
  const value = process.env[STERLING_TODAY_CONTINUITY_HMAC_ENV]?.trim() ?? "";
  return Buffer.byteLength(value, "utf8") >= 32 ? value : null;
}
