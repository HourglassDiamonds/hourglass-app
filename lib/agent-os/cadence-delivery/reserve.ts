/**
 * Durable delivery reservation / state machine for Agent OS email.
 * Prefers store.atomicClaimDelivery (UNIQUE create-if-absent /
 * expired-reserved reclaim / expired-sending→uncertain) so concurrent
 * serverless instances cannot double-send after a post-send crash.
 */

import { randomUUID } from "node:crypto";
import {
  AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
  AgentOsPersistenceError,
  type AgentOsDeliveryRecord,
  type AgentOsPersistedState,
  type DeliveryKind,
  type DeliveryStatus,
} from "../persistence/types";
import {
  DELIVERY_CLAIM_LEASE_MS,
  MAX_RETAINED_DELIVERIES,
  type AgentOsPersistenceStore,
} from "../persistence/store";
import { deepCloneState } from "../persistence/migrate";
import { redactSecretsAndPii } from "../redaction";

export type ReserveDeliveryInput = {
  store: AgentOsPersistenceStore;
  deliveryId: string;
  idempotencyKey: string;
  cadenceId: string;
  cadenceWindow: string;
  runId: string;
  briefFingerprint: string;
  recipientConfigFingerprint: string;
  kind: DeliveryKind;
  nowIso: string;
  cooldownMs?: number;
  claimOwner?: string;
};

export type ReserveDeliveryResult =
  | { outcome: "reserved"; record: AgentOsDeliveryRecord }
  | { outcome: "already-terminal"; record: AgentOsDeliveryRecord; reason: string }
  | { outcome: "suppressed"; record: AgentOsDeliveryRecord; reason: string }
  | { outcome: "blocked-uncertain"; record: AgentOsDeliveryRecord; reason: string }
  | { outcome: "contention"; reason: string };

function findByIdempotencyKey(
  state: AgentOsPersistedState,
  key: string,
): AgentOsDeliveryRecord | null {
  for (const rec of Object.values(state.deliveries ?? {})) {
    if (rec.idempotencyKey === key) return rec;
  }
  return null;
}

function findRecentSentSameFingerprint(
  state: AgentOsPersistedState,
  input: {
    kind: DeliveryKind;
    briefFingerprint: string;
    recipientConfigFingerprint: string;
    cadenceId: string;
    nowIso: string;
    cooldownMs: number;
  },
): AgentOsDeliveryRecord | null {
  const now = Date.parse(input.nowIso);
  let latest: AgentOsDeliveryRecord | null = null;
  for (const rec of Object.values(state.deliveries ?? {})) {
    // Kind separation: founder-brief cooldown never considers failure-alert
    if (rec.kind !== input.kind) continue;
    if (rec.status !== "sent") continue;
    if (rec.briefFingerprint !== input.briefFingerprint) continue;
    if (rec.recipientConfigFingerprint !== input.recipientConfigFingerprint)
      continue;
    if (rec.cadenceId !== input.cadenceId) continue;
    const sentAt = rec.sentAt ? Date.parse(rec.sentAt) : Date.parse(rec.updatedAt);
    if (Number.isNaN(sentAt) || now - sentAt > input.cooldownMs) continue;
    if (!latest || Date.parse(rec.updatedAt) > Date.parse(latest.updatedAt)) {
      latest = rec;
    }
  }
  return latest;
}

function trimDeliveries(
  deliveries: Record<string, AgentOsDeliveryRecord>,
): Record<string, AgentOsDeliveryRecord> {
  const entries = Object.entries(deliveries).sort(
    (a, b) => Date.parse(a[1].updatedAt) - Date.parse(b[1].updatedAt),
  );
  if (entries.length <= MAX_RETAINED_DELIVERIES) return deliveries;
  return Object.fromEntries(
    entries.slice(entries.length - MAX_RETAINED_DELIVERIES),
  );
}

function baseRecord(input: ReserveDeliveryInput, existing?: AgentOsDeliveryRecord | null): AgentOsDeliveryRecord {
  return {
    schemaVersion: AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
    deliveryId:
      existing?.status === "failed" ? existing.deliveryId : input.deliveryId,
    idempotencyKey: input.idempotencyKey,
    cadenceId: input.cadenceId,
    cadenceWindow: input.cadenceWindow,
    runId: input.runId,
    briefFingerprint: input.briefFingerprint,
    recipientConfigFingerprint: input.recipientConfigFingerprint,
    kind: input.kind,
    status: "reserved",
    suppressionReason: null,
    providerMessageId: null,
    errorSummary: null,
    reservedAt:
      existing?.status === "failed" ? existing.reservedAt : input.nowIso,
    updatedAt: input.nowIso,
    sentAt: null,
    leaseExpiresAt: new Date(
      Date.parse(input.nowIso) + DELIVERY_CLAIM_LEASE_MS,
    ).toISOString(),
    claimOwner: input.claimOwner ?? randomUUID(),
    resolutionAudit: existing?.resolutionAudit ?? [],
  };
}

function classifyExisting(
  existing: AgentOsDeliveryRecord,
): ReserveDeliveryResult | null {
  if (existing.status === "uncertain") {
    return {
      outcome: "blocked-uncertain",
      record: existing,
      reason:
        "Prior delivery outcome is uncertain — refusing duplicate send until resolved",
    };
  }
  if (existing.status === "sent" || existing.status === "suppressed") {
    return {
      outcome: "already-terminal",
      record: existing,
      reason: `Delivery already ${existing.status} for this cadence window`,
    };
  }
  if (existing.status === "reserved" || existing.status === "sending") {
    const leaseEnd = existing.leaseExpiresAt
      ? Date.parse(existing.leaseExpiresAt)
      : null;
    // Active lease blocks. Expired reserved → reclaim via atomicClaim.
    // Expired sending → mark uncertain via atomicClaim (never auto-resend).
    if (leaseEnd == null || leaseEnd >= Date.now()) {
      return {
        outcome: "already-terminal",
        record: existing,
        reason: `Delivery already ${existing.status} (in-flight)`,
      };
    }
  }
  return null;
}

/**
 * Atomically reserve a delivery slot or return prior terminal/uncertain state.
 */
export async function reserveDelivery(
  input: ReserveDeliveryInput,
): Promise<ReserveDeliveryResult> {
  const prior = await input.store.load();
  const existing = findByIdempotencyKey(prior, input.idempotencyKey);
  if (existing) {
    const classified = classifyExisting(existing);
    if (classified) return classified;
    // failed or stale in-flight → continue to claim/retry
  }

  const cooldownMs =
    input.cooldownMs ??
    (input.kind === "failure-alert"
      ? 6 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000);

  const recent = findRecentSentSameFingerprint(prior, {
    kind: input.kind,
    briefFingerprint: input.briefFingerprint,
    recipientConfigFingerprint: input.recipientConfigFingerprint,
    cadenceId: input.cadenceId,
    nowIso: input.nowIso,
    cooldownMs,
  });

  if (recent) {
    const suppressed = baseRecord(input, existing);
    suppressed.status = "suppressed";
    suppressed.suppressionReason =
      input.kind === "failure-alert"
        ? "failure-alert-cooldown: identical failure alert within cooldown"
        : "unchanged-priorities-cooldown: materially unchanged founder priorities within cooldown";

    if (typeof input.store.atomicClaimDelivery === "function") {
      // Claim under suppressed status via normal claim then update — or CAS save
      const claim = await input.store.atomicClaimDelivery({
        record: { ...suppressed, status: "reserved" },
        claimOwner: suppressed.claimOwner!,
        nowIso: input.nowIso,
      });
      if (claim.outcome === "exists") {
        const c = classifyExisting(claim.record);
        if (c) return c;
      }
      const updated = await transitionDeliveryStatus({
        store: input.store,
        deliveryId: claim.record.deliveryId,
        status: "suppressed",
        nowIso: input.nowIso,
        suppressionReason: suppressed.suppressionReason,
        expectedStatus: "reserved",
        expectedClaimOwner: claim.record.claimOwner ?? undefined,
      });
      return {
        outcome: "suppressed",
        record: updated,
        reason: suppressed.suppressionReason,
      };
    }

    const deliveries = {
      ...(prior.deliveries ?? {}),
      [suppressed.deliveryId]: suppressed,
    };
    try {
      await input.store.save(
        {
          ...deepCloneState(prior),
          updatedAt: input.nowIso,
          deliveries: trimDeliveries(deliveries),
        },
        { expectedUpdatedAt: prior.updatedAt },
      );
    } catch (err) {
      if (
        err instanceof AgentOsPersistenceError &&
        err.code === "write-failed"
      ) {
        return { outcome: "contention", reason: redactSecretsAndPii(err.message) };
      }
      throw err;
    }
    return {
      outcome: "suppressed",
      record: suppressed,
      reason: suppressed.suppressionReason!,
    };
  }

  // Uncertain for same cadence window + kind blocks
  for (const rec of Object.values(prior.deliveries ?? {})) {
    if (
      rec.cadenceId === input.cadenceId &&
      rec.cadenceWindow === input.cadenceWindow &&
      rec.kind === input.kind &&
      rec.status === "uncertain"
    ) {
      return {
        outcome: "blocked-uncertain",
        record: rec,
        reason:
          "Uncertain prior send for this cadence window — refusing duplicate",
      };
    }
  }

  const reserved = baseRecord(input, existing);

  if (typeof input.store.atomicClaimDelivery === "function") {
    try {
      const claim = await input.store.atomicClaimDelivery({
        record: reserved,
        claimOwner: reserved.claimOwner!,
        nowIso: input.nowIso,
      });
      if (claim.outcome === "marked-uncertain") {
        await mirrorClaimToState(input.store, claim.record, input.nowIso);
        return {
          outcome: "blocked-uncertain",
          record: claim.record,
          reason:
            "Expired sending claim marked uncertain — refusing automatic resend",
        };
      }
      if (claim.outcome === "claimed" || claim.outcome === "reclaimed") {
        // Mirror into state blob (best-effort; claim table is SoT for supabase)
        await mirrorClaimToState(input.store, claim.record, input.nowIso);
        return { outcome: "reserved", record: claim.record };
      }
      if (claim.record.status === "uncertain") {
        return {
          outcome: "blocked-uncertain",
          record: claim.record,
          reason:
            "Prior delivery outcome is uncertain — refusing duplicate send until resolved",
        };
      }
      const classified = classifyExisting(claim.record);
      if (classified) return classified;
      if (claim.record.status === "failed") {
        // retry path already attempted reclaim via atomicClaim — treat as contention
        return {
          outcome: "contention",
          reason: "Claim exists in failed state without reclaim",
        };
      }
      return {
        outcome: "already-terminal",
        record: claim.record,
        reason: `Delivery claim exists (${claim.record.status})`,
      };
    } catch (err) {
      if (
        err instanceof AgentOsPersistenceError &&
        err.code === "write-failed"
      ) {
        return { outcome: "contention", reason: redactSecretsAndPii(err.message) };
      }
      throw err;
    }
  }

  // Fallback CAS save (single-writer adapters without atomicClaim)
  const deliveries = {
    ...(prior.deliveries ?? {}),
    [reserved.deliveryId]: reserved,
  };
  try {
    await input.store.save(
      {
        ...deepCloneState(prior),
        updatedAt: input.nowIso,
        deliveries: trimDeliveries(deliveries),
      },
      { expectedUpdatedAt: prior.updatedAt },
    );
  } catch (err) {
    if (err instanceof AgentOsPersistenceError && err.code === "write-failed") {
      return { outcome: "contention", reason: redactSecretsAndPii(err.message) };
    }
    throw err;
  }
  return { outcome: "reserved", record: reserved };
}

async function mirrorClaimToState(
  store: AgentOsPersistenceStore,
  record: AgentOsDeliveryRecord,
  nowIso: string,
): Promise<void> {
  try {
    const latest = await store.load();
    await store.save(
      {
        ...deepCloneState(latest),
        updatedAt: nowIso,
        deliveries: trimDeliveries({
          ...(latest.deliveries ?? {}),
          [record.deliveryId]: record,
        }),
      },
      { expectedUpdatedAt: latest.updatedAt },
    );
  } catch {
    // Claim already durable; state mirror can retry later
  }
}

export async function transitionDeliveryStatus(input: {
  store: AgentOsPersistenceStore;
  deliveryId: string;
  status: DeliveryStatus;
  nowIso: string;
  providerMessageId?: string | null;
  errorSummary?: string | null;
  suppressionReason?: string | null;
  auditAction?: string;
  auditNote?: string | null;
  /** When set, conditional update requires matching claim owner. */
  expectedClaimOwner?: string;
  /** When set, conditional update requires matching current status. */
  expectedStatus?: DeliveryStatus;
}): Promise<AgentOsDeliveryRecord> {
  const prior = await input.store.load();
  const existing = prior.deliveries?.[input.deliveryId];
  if (!existing) {
    throw new AgentOsPersistenceError(
      "corrupted-state",
      `Delivery ${input.deliveryId} not found for status transition`,
    );
  }
  if (
    input.expectedStatus != null &&
    existing.status !== input.expectedStatus
  ) {
    throw new AgentOsPersistenceError(
      "write-failed",
      `Expected status ${input.expectedStatus}, found ${existing.status}`,
    );
  }
  if (
    input.expectedClaimOwner != null &&
    existing.claimOwner !== input.expectedClaimOwner
  ) {
    throw new AgentOsPersistenceError(
      "write-failed",
      "Claim-owner mismatch: delivery transition rejected",
    );
  }
  const updated: AgentOsDeliveryRecord = {
    ...existing,
    status: input.status,
    updatedAt: input.nowIso,
    providerMessageId:
      input.providerMessageId !== undefined
        ? input.providerMessageId
        : existing.providerMessageId,
    errorSummary:
      input.errorSummary !== undefined
        ? input.errorSummary
          ? redactSecretsAndPii(input.errorSummary).slice(0, 400)
          : null
        : existing.errorSummary,
    suppressionReason:
      input.suppressionReason !== undefined
        ? input.suppressionReason
        : existing.suppressionReason,
    sentAt: input.status === "sent" ? input.nowIso : existing.sentAt,
    resolutionAudit: [
      ...(existing.resolutionAudit ?? []),
      {
        at: input.nowIso,
        action: input.auditAction ?? "system-transition",
        fromStatus: existing.status,
        toStatus: input.status,
        note: input.auditNote
          ? redactSecretsAndPii(input.auditNote).slice(0, 240)
          : null,
      },
    ],
  };

  if (typeof input.store.atomicUpdateDelivery === "function") {
    await input.store.atomicUpdateDelivery(updated, {
      expectedClaimOwner: input.expectedClaimOwner,
      expectedStatus: input.expectedStatus ?? existing.status,
    });
  }

  const deliveries = {
    ...(prior.deliveries ?? {}),
    [updated.deliveryId]: updated,
  };
  await input.store.save({
    ...deepCloneState(prior),
    updatedAt: input.nowIso,
    deliveries: trimDeliveries(deliveries),
  });
  return updated;
}

/**
 * Operator recovery: resolve uncertain → sent|failed with audit trail.
 * Retry/send is only allowed after intentional resolve to failed.
 */
export async function resolveUncertainDelivery(input: {
  store: AgentOsPersistenceStore;
  deliveryId?: string;
  cadenceId?: string;
  cadenceWindow?: string;
  kind?: DeliveryKind;
  resolveAs: "sent" | "failed";
  nowIso: string;
  note?: string;
}): Promise<AgentOsDeliveryRecord> {
  const state = await input.store.load();
  let target: AgentOsDeliveryRecord | undefined;
  if (input.deliveryId) {
    target = state.deliveries?.[input.deliveryId];
  } else if (input.cadenceId && input.cadenceWindow) {
    target = Object.values(state.deliveries ?? {}).find(
      (d) =>
        d.cadenceId === input.cadenceId &&
        d.cadenceWindow === input.cadenceWindow &&
        d.status === "uncertain" &&
        (!input.kind || d.kind === input.kind),
    );
  }
  if (!target) {
    throw new AgentOsPersistenceError(
      "corrupted-state",
      "Uncertain delivery not found for recovery",
    );
  }
  if (target.status !== "uncertain") {
    throw new AgentOsPersistenceError(
      "mode-mismatch",
      `Delivery ${target.deliveryId} is ${target.status}, not uncertain`,
    );
  }
  return transitionDeliveryStatus({
    store: input.store,
    deliveryId: target.deliveryId,
    status: input.resolveAs,
    nowIso: input.nowIso,
    expectedStatus: "uncertain",
    auditAction:
      input.resolveAs === "sent" ? "resolve-sent" : "resolve-failed",
    auditNote:
      input.note ??
      "Operator resolved uncertain provider outcome via secure CLI",
  });
}
