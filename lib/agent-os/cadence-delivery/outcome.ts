/**
 * Honest delivery outcomes for Agent OS cadence HTTP/CLI responses.
 * Never treat emailSent:false as undifferentiated success.
 */

export type CadenceDeliveryOutcome =
  | "sent"
  | "skipped_with_reason"
  | "failed";

/** In-progress locks older than this are treated as crashed leftovers. */
export const STALE_IN_PROGRESS_MS = 10 * 60 * 1000;

export function isInProgressStale(
  startedAt: string | null | undefined,
  nowIso: string,
  staleMs: number = STALE_IN_PROGRESS_MS,
): boolean {
  if (!startedAt) return true;
  const started = Date.parse(startedAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(started) || !Number.isFinite(now)) return true;
  return now - started > staleMs;
}

export function isInProgressActive(
  entry: { runId: string; startedAt: string } | null | undefined,
  nowIso: string,
  staleMs: number = STALE_IN_PROGRESS_MS,
): boolean {
  if (!entry?.runId) return false;
  return !isInProgressStale(entry.startedAt, nowIso, staleMs);
}

/**
 * Map executor result fields to a durable outcome label.
 */
export function resolveCadenceDeliveryOutcome(input: {
  emailSent: boolean;
  ok: boolean;
  dryRun?: boolean;
  deliveryAction?: string | null;
  errorCode?: string | null;
  safeSummary?: string | null;
  suppressionReason?: string | null;
}): CadenceDeliveryOutcome {
  if (input.emailSent) return "sent";
  if (input.dryRun) return "skipped_with_reason";
  if (!input.ok || input.errorCode) return "failed";

  const action = input.deliveryAction ?? "";
  if (
    action === "send-nothing" ||
    action === "suppressed" ||
    action === "block"
  ) {
    // Quality-gate blocks are delivery failures for scheduled morning briefs.
    const summary = `${input.safeSummary ?? ""} ${input.suppressionReason ?? ""}`;
    if (/quality gate/i.test(summary)) return "failed";
    return "skipped_with_reason";
  }

  // ok:true + emailSent:false with a send-* action means reservation skip / no-send.
  if (
    action === "send-founder-brief" ||
    action === "send-failure-alert" ||
    action === "send-degraded-partial-brief"
  ) {
    return "skipped_with_reason";
  }

  return "skipped_with_reason";
}

/**
 * HTTP status for cadence route — never 2xx for failed delivery.
 * Intentional skips remain 200 with outcome=skipped_with_reason.
 */
export function httpStatusForCadenceOutcome(
  outcome: CadenceDeliveryOutcome,
  errorCode?: string | null,
): number {
  if (outcome === "sent" || outcome === "skipped_with_reason") return 200;
  if (errorCode === "unconfigured") return 503;
  return 500;
}

export function logCadenceDeliveryEvent(
  event: string,
  fields: Record<string, unknown>,
): void {
  // Structured, secret-free operator log line for Vercel runtime logs.
  console.info(
    JSON.stringify({
      channel: "agent-os-cadence",
      event,
      ...fields,
    }),
  );
}
