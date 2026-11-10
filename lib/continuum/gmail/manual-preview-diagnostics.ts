import { randomUUID } from "node:crypto";

export const MANUAL_PREVIEW_DIAGNOSTIC_EVENT =
  "continuum.gmail_manual_preview" as const;

export const MANUAL_PREVIEW_DIAGNOSTIC_STAGES = [
  "preflight",
  "lease-acquisition",
  "provider-fetch",
  "checkpoint-persistence",
  "readiness-render",
] as const;

export type ManualPreviewDiagnosticStage =
  (typeof MANUAL_PREVIEW_DIAGNOSTIC_STAGES)[number];

export type ManualPreviewDiagnosticOutcome =
  | "started"
  | "succeeded"
  | "blocked"
  | "failed";

const SAFE_CODES = new Set([
  "ok",
  "unauthorized",
  "not-preview",
  "not-beta-recovery-preview",
  "unavailable",
  "gmail-not-connected",
  "decrypt-failed",
  "token-refresh-failed",
  "refresh-token-rotated",
  "invalid_grant",
  "gmail-sync-already-running",
  "gmail-sync-failed",
  "gmail-rate-limited",
  "gmail-provider-temporary",
  "gmail-invalid-page-token",
  "gmail-database-failed",
  "gmail-provider-timeout",
  "gmail-provider-forbidden",
  "gmail-provider-unauthorized",
  "connection-inactive",
  "sync-disabled",
  "historical-incomplete",
  "history-too-old",
  "gmail-history-id-missing",
  "readiness-unavailable",
  "unexpected",
]);

export type ManualPreviewDiagnosticRecord = {
  correlationId: string;
  stage: ManualPreviewDiagnosticStage;
  outcome: ManualPreviewDiagnosticOutcome;
  code: string | null;
};

export function createManualPreviewCorrelationId(): string {
  return randomUUID();
}

export function sanitizeManualPreviewDiagnosticCode(
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  return SAFE_CODES.has(code) ? code : "unexpected";
}

export function manualPreviewStageForCode(
  code: string | null | undefined,
): ManualPreviewDiagnosticStage {
  if (
    !code ||
    code === "unauthorized" ||
    code === "not-preview" ||
    code === "not-beta-recovery-preview" ||
    code === "unavailable" ||
    code === "gmail-not-connected" ||
    code === "decrypt-failed" ||
    code === "sync-disabled"
  ) {
    return "preflight";
  }
  if (code === "gmail-sync-already-running") return "lease-acquisition";
  if (code === "gmail-database-failed") return "checkpoint-persistence";
  return "provider-fetch";
}

export function isManualPreviewCorrelationId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function sanitizeManualPreviewDiagnosticStage(
  value: string | null | undefined,
): ManualPreviewDiagnosticStage | null {
  return (MANUAL_PREVIEW_DIAGNOSTIC_STAGES as readonly string[]).includes(
    value ?? "",
  )
    ? (value as ManualPreviewDiagnosticStage)
    : null;
}

export function logManualPreviewDiagnostic(
  record: ManualPreviewDiagnosticRecord,
): void {
  console.info(
    JSON.stringify({
      event: MANUAL_PREVIEW_DIAGNOSTIC_EVENT,
      correlation_id: isManualPreviewCorrelationId(record.correlationId)
        ? record.correlationId
        : "invalid",
      stage: record.stage,
      outcome: record.outcome,
      error_code: sanitizeManualPreviewDiagnosticCode(record.code),
    }),
  );
}
