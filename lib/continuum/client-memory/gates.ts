/**
 * Apply-path safety gates. Missing any gate → fail closed.
 * --apply alone is never sufficient.
 */

export const APPLY_ENV_FLAG = "CONTINUUM_CLIENT_MEMORY_IMPORT_ENABLED";

export type ApplyTarget = "memory" | "supabase";

export type ApplyIntent = {
  apply: boolean;
  confirmProductionClientImport: boolean;
  envEnabled: boolean;
  target: ApplyTarget | null;
  fingerprintMatch: boolean;
};

export type ApplyGateFailure = {
  ok: false;
  reason:
    | "APPLY_FLAG_REQUIRED"
    | "APPLY_REQUIRES_CONFIRMATION"
    | "APPLY_REQUIRES_ENV_FLAG"
    | "WORKBOOK_FINGERPRINT_MISMATCH"
    | "APPLY_TARGET_REQUIRED"
    | "SUPABASE_APPLY_REQUIRES_EXPLICIT_TARGET";
};

export type ApplyGateSuccess = { ok: true; target: ApplyTarget };

export function evaluateApplyGates(intent: ApplyIntent): ApplyGateFailure | ApplyGateSuccess {
  if (!intent.apply) {
    return { ok: false, reason: "APPLY_FLAG_REQUIRED" };
  }
  if (!intent.confirmProductionClientImport) {
    return { ok: false, reason: "APPLY_REQUIRES_CONFIRMATION" };
  }
  if (!intent.envEnabled) {
    return { ok: false, reason: "APPLY_REQUIRES_ENV_FLAG" };
  }
  if (!intent.fingerprintMatch) {
    return { ok: false, reason: "WORKBOOK_FINGERPRINT_MISMATCH" };
  }
  if (intent.target == null) {
    return { ok: false, reason: "APPLY_TARGET_REQUIRED" };
  }
  if (intent.target !== "memory" && intent.target !== "supabase") {
    return { ok: false, reason: "APPLY_TARGET_REQUIRED" };
  }
  return { ok: true, target: intent.target };
}

export function envImportEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env[APPLY_ENV_FLAG] === "true";
}
