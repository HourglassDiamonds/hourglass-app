/**
 * Continuum runtime environment isolation.
 * Fail closed for an explicit Preview sandbox. Do not change Production
 * behavior when CONTINUUM_ENV is unset.
 * Never log secrets, service-role keys, tokens, or mailbox content.
 */

import { getSupabaseUrl } from "@/lib/intelligence/env";

export const CONTINUUM_RUNTIME_ENVS = ["production", "preview", "local"] as const;
export type ContinuumRuntimeEnv = (typeof CONTINUUM_RUNTIME_ENVS)[number];

/**
 * Current Production Supabase project ref. Preview/local must never use this
 * host. Override with CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF if Production
 * ever moves. Not a secret.
 */
export const CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF =
  "bnafadfgrrriblppeubp" as const;

export const SERVER_ONLY_CONTINUUM_RUNTIME_ENV = [
  "CONTINUUM_ENV",
  "CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF",
  "CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF",
] as const;

export type ContinuumIsolationState =
  | "production"
  | "preview-isolated"
  | "preview-adjacent"
  | "local"
  | "unset";

export type ContinuumEnvBadge = {
  show: boolean;
  label: string;
  isolation: "isolated" | "adjacent" | "local";
  env: Exclude<ContinuumRuntimeEnv, "production"> | "preview";
};

function trimmed(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

export function parseContinuumEnv(
  raw = process.env.CONTINUUM_ENV,
): ContinuumRuntimeEnv | "unset" {
  const value = trimmed(raw)?.toLowerCase();
  if (value === "production" || value === "preview" || value === "local") {
    return value;
  }
  return "unset";
}

export function vercelEnvName(
  raw = process.env.VERCEL_ENV,
): "production" | "preview" | "development" | "unset" {
  const value = trimmed(raw)?.toLowerCase();
  if (value === "production" || value === "preview" || value === "development") {
    return value;
  }
  return "unset";
}

export function supabaseProjectRefFromUrl(url = getSupabaseUrl()): string | null {
  const value = trimmed(url);
  if (!value) return null;
  try {
    const host = new URL(value).hostname.toLowerCase();
    const match = host.match(/^([a-z0-9]+)\.supabase\.co$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function productionSupabaseProjectRef(
  raw = process.env.CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
): string {
  return (
    trimmed(raw)?.toLowerCase() ?? CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF
  );
}

export function previewSupabaseProjectRef(
  raw = process.env.CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
): string | null {
  const value = trimmed(raw)?.toLowerCase();
  return value || null;
}

export function isProductionSupabaseUrl(
  url = getSupabaseUrl(),
  productionRef = productionSupabaseProjectRef(),
): boolean {
  const ref = supabaseProjectRefFromUrl(url);
  return Boolean(ref && ref === productionRef);
}

export function resolveContinuumIsolationState(input?: {
  continuumEnv?: string;
  vercelEnv?: string;
  supabaseUrl?: string;
  productionRef?: string;
  previewRef?: string;
}): ContinuumIsolationState {
  const continuum = parseContinuumEnv(input?.continuumEnv ?? process.env.CONTINUUM_ENV);
  const vercel = vercelEnvName(input?.vercelEnv ?? process.env.VERCEL_ENV);
  const url = input?.supabaseUrl ?? getSupabaseUrl();
  const productionRef = productionSupabaseProjectRef(
    input?.productionRef ?? process.env.CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
  );
  const previewRef = previewSupabaseProjectRef(
    input?.previewRef ?? process.env.CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
  );
  const currentRef = supabaseProjectRefFromUrl(url);
  const usesProduction = Boolean(currentRef && currentRef === productionRef);
  const matchesPreviewAllowlist = Boolean(
    previewRef && currentRef && currentRef === previewRef && currentRef !== productionRef,
  );

  if (continuum === "production" || (continuum === "unset" && vercel === "production")) {
    return "production";
  }
  if (continuum === "local") return "local";
  if (continuum === "preview") {
    return matchesPreviewAllowlist && !usesProduction
      ? "preview-isolated"
      : "preview-adjacent";
  }
  if (vercel === "preview") {
    return usesProduction || !currentRef ? "preview-adjacent" : "preview-isolated";
  }
  return "unset";
}

export function isPreviewLikeRuntime(input?: {
  continuumEnv?: string;
  vercelEnv?: string;
}): boolean {
  const continuum = parseContinuumEnv(input?.continuumEnv ?? process.env.CONTINUUM_ENV);
  const vercel = vercelEnvName(input?.vercelEnv ?? process.env.VERCEL_ENV);
  return continuum === "preview" || vercel === "preview";
}

/**
 * Gmail incremental / operating freshness may run only when the kill switch
 * is on AND this Preview/local sandbox is not pointed at Production data.
 * Production keeps current kill-switch behavior.
 */
export function isGmailIncrementalAllowedInCurrentEnv(input?: {
  continuumEnv?: string;
  vercelEnv?: string;
  supabaseUrl?: string;
  productionRef?: string;
  previewRef?: string;
}): boolean {
  const continuum = parseContinuumEnv(input?.continuumEnv ?? process.env.CONTINUUM_ENV);
  const vercel = vercelEnvName(input?.vercelEnv ?? process.env.VERCEL_ENV);
  const usesProduction = isProductionSupabaseUrl(
    input?.supabaseUrl ?? getSupabaseUrl(),
    productionSupabaseProjectRef(
      input?.productionRef ?? process.env.CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
    ),
  );

  if (continuum === "production" || (continuum === "unset" && vercel === "production")) {
    return true;
  }
  if (continuum === "local") return !usesProduction;
  if (isPreviewLikeRuntime(input)) {
    return (
      continuum === "preview" &&
      resolveContinuumIsolationState(input) === "preview-isolated"
    );
  }
  return !usesProduction;
}

export function assertContinuumPreviewIsolation(input?: {
  continuumEnv?: string;
  vercelEnv?: string;
  supabaseUrl?: string;
  productionRef?: string;
  previewRef?: string;
}): void {
  const continuum = parseContinuumEnv(input?.continuumEnv ?? process.env.CONTINUUM_ENV);
  if (continuum !== "preview") return;

  const url = input?.supabaseUrl ?? getSupabaseUrl();
  const productionRef = productionSupabaseProjectRef(
    input?.productionRef ?? process.env.CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
  );
  const previewRef = previewSupabaseProjectRef(
    input?.previewRef ?? process.env.CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
  );
  const currentRef = supabaseProjectRefFromUrl(url);

  if (!url) {
    throw new Error(
      "[continuum:isolation] CONTINUUM_ENV=preview requires SUPABASE_URL.",
    );
  }
  if (!currentRef) {
    throw new Error(
      "[continuum:isolation] CONTINUUM_ENV=preview requires a Supabase project URL.",
    );
  }
  if (currentRef === productionRef) {
    throw new Error(
      "[continuum:isolation] Preview must not use the Production Supabase project.",
    );
  }
  if (!previewRef) {
    throw new Error(
      "[continuum:isolation] CONTINUUM_ENV=preview requires CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF.",
    );
  }
  if (currentRef !== previewRef) {
    throw new Error(
      "[continuum:isolation] Preview SUPABASE_URL does not match CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF.",
    );
  }
}

let warnedAdjacent = false;

export function validateContinuumRuntimeEnvOnStartup(): void {
  if (typeof window !== "undefined") return;
  assertContinuumPreviewIsolation();
  if (warnedAdjacent) return;
  const state = resolveContinuumIsolationState();
  if (state === "preview-adjacent") {
    warnedAdjacent = true;
    console.warn(
      "[continuum:isolation] Preview/local is using Production-adjacent Supabase. Canonical Continuum writes are not sandboxed. Gmail incremental sync stays blocked until Preview isolation is configured.",
    );
  }
}

export function continuumEnvLogLabel(): string {
  const continuum = parseContinuumEnv();
  const vercel = vercelEnvName();
  const state = resolveContinuumIsolationState();
  return `continuum_env=${continuum} vercel_env=${vercel} isolation=${state}`;
}

export function continuumEnvBadge(): ContinuumEnvBadge | null {
  const continuum = parseContinuumEnv();
  const vercel = vercelEnvName();
  const state = resolveContinuumIsolationState();
  if (continuum === "production" || (continuum === "unset" && vercel === "production")) {
    return null;
  }
  if (continuum === "local") {
    return {
      show: true,
      label: "Local",
      isolation: "local",
      env: "local",
    };
  }
  if (continuum === "preview" || vercel === "preview") {
    if (state === "preview-isolated") {
      return {
        show: true,
        label: "Preview sandbox",
        isolation: "isolated",
        env: "preview",
      };
    }
    return {
      show: true,
      label: "Preview · production data",
      isolation: "adjacent",
      env: "preview",
    };
  }
  return null;
}
