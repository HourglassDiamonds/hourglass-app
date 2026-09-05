/**
 * Safe Gmail activation telemetry.
 * Allowlisted fields only. No subject, addresses, hashes, thread ids,
 * bodies, snippets, filenames, tokens, or auth codes.
 */

export const GMAIL_SAFE_TELEMETRY_EVENTS = [
  "gmail-sync-page-ok",
  "gmail-sync-failed",
  "gmail-incremental-ok",
  "gmail-incremental-failed",
  "gmail-oauth-ok",
  "gmail-oauth-failed",
  "gmail-connection",
] as const;

export type GmailSafeTelemetryEventName =
  (typeof GMAIL_SAFE_TELEMETRY_EVENTS)[number];

export type GmailSafeTelemetryEvent = {
  event: GmailSafeTelemetryEventName;
  indexed_count?: number;
  status?: string;
  job_key?: string;
  error_code?: string;
};

const ALLOWED_KEYS = new Set([
  "event",
  "indexed_count",
  "status",
  "job_key",
  "error_code",
]);

export type GmailTelemetrySink = (event: GmailSafeTelemetryEvent) => void;

export const noopGmailTelemetry: GmailTelemetrySink = () => {};

export function gmailSafeTelemetry(
  event: GmailSafeTelemetryEvent,
): GmailSafeTelemetryEvent {
  for (const key of Object.keys(event)) {
    if (!ALLOWED_KEYS.has(key)) throw new Error("gmail-telemetry-forbidden");
  }
  if (!(GMAIL_SAFE_TELEMETRY_EVENTS as readonly string[]).includes(event.event)) {
    throw new Error("gmail-telemetry-event-invalid");
  }
  const sanitized: GmailSafeTelemetryEvent = { event: event.event };
  if (event.indexed_count != null) sanitized.indexed_count = event.indexed_count;
  if (event.status != null) sanitized.status = event.status;
  if (event.job_key != null) sanitized.job_key = event.job_key;
  if (event.error_code != null) sanitized.error_code = event.error_code;
  return sanitized;
}

export function emitGmailTelemetry(
  sink: GmailTelemetrySink,
  event: GmailSafeTelemetryEvent,
): void {
  sink(gmailSafeTelemetry(event));
}
