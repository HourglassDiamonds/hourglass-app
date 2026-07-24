/**
 * Delivery claim lease policy — crash-safe reclaim rules.
 *
 * - Expired `reserved` → reclaimable for another send attempt
 * - Expired `sending` → MUST become `uncertain` (never auto-reclaim for send)
 * - `uncertain` blocks automatic retry until operator resolves to `failed`
 * - Resolve to `sent` permanently suppresses resend
 */

import type {
  AgentOsDeliveryRecord,
  DeliveryResolutionAuditEntry,
  DeliveryStatus,
} from "../types";
import { DELIVERY_CLAIM_LEASE_MS } from "../store";

export function isLeaseExpired(
  record: Pick<AgentOsDeliveryRecord, "leaseExpiresAt" | "updatedAt">,
  nowIso: string,
  leaseMs = DELIVERY_CLAIM_LEASE_MS,
): boolean {
  const now = Date.parse(nowIso);
  const leaseEnd = record.leaseExpiresAt
    ? Date.parse(record.leaseExpiresAt)
    : Date.parse(record.updatedAt) + leaseMs;
  return !Number.isNaN(leaseEnd) && leaseEnd < now;
}

export function appendAudit(
  existing: DeliveryResolutionAuditEntry[] | undefined,
  entry: DeliveryResolutionAuditEntry,
): DeliveryResolutionAuditEntry[] {
  return [...(existing ?? []), entry];
}

/**
 * Decide how an existing claim should be handled on a new claim attempt.
 * Pure policy — adapters apply the corresponding conditional DB / map update.
 */
export type ClaimConflictDecision =
  | { action: "reclaim-reserved" }
  | { action: "mark-sending-uncertain" }
  | { action: "retry-after-failed" }
  | { action: "exists" };

export function decideClaimConflict(
  existing: AgentOsDeliveryRecord,
  nowIso: string,
  leaseMs = DELIVERY_CLAIM_LEASE_MS,
): ClaimConflictDecision {
  if (existing.status === "failed") {
    return { action: "retry-after-failed" };
  }
  if (existing.status === "reserved" && isLeaseExpired(existing, nowIso, leaseMs)) {
    return { action: "reclaim-reserved" };
  }
  if (existing.status === "sending" && isLeaseExpired(existing, nowIso, leaseMs)) {
    return { action: "mark-sending-uncertain" };
  }
  return { action: "exists" };
}

export function buildExpiredSendingUncertainRecord(
  existing: AgentOsDeliveryRecord,
  nowIso: string,
): AgentOsDeliveryRecord {
  return {
    ...existing,
    status: "uncertain",
    updatedAt: nowIso,
    errorSummary:
      existing.errorSummary ??
      "Lease expired while status=sending — outcome uncertain (possible post-send crash)",
    resolutionAudit: appendAudit(existing.resolutionAudit, {
      at: nowIso,
      action: "expired-sending-to-uncertain",
      fromStatus: "sending",
      toStatus: "uncertain",
      note: "Expired sending claim treated as uncertain; automatic resend blocked",
    }),
  };
}

export function buildReclaimedReservedRecord(
  input: AgentOsDeliveryRecord,
  existing: AgentOsDeliveryRecord,
  claimOwner: string,
  nowIso: string,
  leaseMs: number,
): AgentOsDeliveryRecord {
  return {
    ...input,
    status: "reserved",
    claimOwner,
    leaseExpiresAt: new Date(Date.parse(nowIso) + leaseMs).toISOString(),
    reservedAt: existing.reservedAt,
    updatedAt: nowIso,
    sentAt: null,
    providerMessageId: null,
    errorSummary: null,
    suppressionReason: null,
    resolutionAudit: appendAudit(existing.resolutionAudit, {
      at: nowIso,
      action: "stale-lease-reclaim",
      fromStatus: "reserved",
      toStatus: "reserved",
      note: "Expired reserved claim reclaimed atomically",
    }),
  };
}

export function buildRetryAfterFailedRecord(
  input: AgentOsDeliveryRecord,
  existing: AgentOsDeliveryRecord,
  claimOwner: string,
  nowIso: string,
  leaseMs: number,
): AgentOsDeliveryRecord {
  return {
    ...input,
    deliveryId: existing.deliveryId,
    status: "reserved",
    claimOwner,
    leaseExpiresAt: new Date(Date.parse(nowIso) + leaseMs).toISOString(),
    reservedAt: nowIso,
    updatedAt: nowIso,
    sentAt: null,
    providerMessageId: null,
    errorSummary: null,
    suppressionReason: null,
    resolutionAudit: appendAudit(existing.resolutionAudit, {
      at: nowIso,
      action: "retry-after-failed",
      fromStatus: "failed",
      toStatus: "reserved",
      note: "Retry after intentional failed / operator-resolved outcome",
    }),
  };
}

/** Statuses that may never be auto-reclaimed for another send. */
export const NON_RECLAIMABLE_SEND_STATUSES: readonly DeliveryStatus[] = [
  "sending",
  "sent",
  "uncertain",
  "suppressed",
] as const;
