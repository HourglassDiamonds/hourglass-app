/**
 * Shared in-memory backend for durable-test multi-instance concurrency.
 * Mirrors production claim lease policy (reserved reclaim / sending→uncertain).
 */

import type {
  AgentOsDeliveryRecord,
  AgentOsPersistedState,
} from "../types";
import { AgentOsPersistenceError } from "../types";
import {
  createEmptyPersistedState,
  DELIVERY_CLAIM_LEASE_MS,
  type AtomicClaimDeliveryInput,
  type AtomicClaimDeliveryResult,
  type AtomicUpdateDeliveryOptions,
} from "../store";
import { deepCloneState, validateAndMigrateState } from "../migrate";
import {
  buildExpiredSendingUncertainRecord,
  buildReclaimedReservedRecord,
  buildRetryAfterFailedRecord,
  decideClaimConflict,
} from "./claim-lease-policy";

export type SharedDurableTestBackend = {
  load(): AgentOsPersistedState;
  save(state: AgentOsPersistedState, expectedUpdatedAt?: string): void;
  atomicClaim(input: AtomicClaimDeliveryInput): AtomicClaimDeliveryResult;
  updateDelivery(
    record: AgentOsDeliveryRecord,
    options?: AtomicUpdateDeliveryOptions,
  ): AgentOsDeliveryRecord;
  clear(): void;
};

export function createSharedDurableTestBackend(options?: {
  modeScope?: AgentOsPersistedState["modeScope"];
  nowIso?: string;
}): SharedDurableTestBackend {
  let state = createEmptyPersistedState({
    adapterId: "durable-test",
    durability: "test-durable",
    modeScope: options?.modeScope ?? "test",
    nowIso: options?.nowIso,
  });
  const claims = new Map<string, AgentOsDeliveryRecord>();

  function mergeDelivery(record: AgentOsDeliveryRecord) {
    state = {
      ...deepCloneState(state),
      updatedAt: record.updatedAt,
      deliveries: {
        ...(state.deliveries ?? {}),
        [record.deliveryId]: { ...record },
      },
    };
  }

  return {
    load() {
      return deepCloneState(validateAndMigrateState(state));
    },
    save(next, expectedUpdatedAt) {
      if (
        expectedUpdatedAt != null &&
        state.updatedAt !== expectedUpdatedAt
      ) {
        throw new AgentOsPersistenceError(
          "write-failed",
          "Durable-test compare-and-swap failed: state updated concurrently",
        );
      }
      state = deepCloneState(validateAndMigrateState(next));
      for (const rec of Object.values(state.deliveries ?? {})) {
        claims.set(rec.idempotencyKey, { ...rec });
      }
    },
    atomicClaim(input) {
      const existing = claims.get(input.record.idempotencyKey);
      const leaseMs = input.leaseMs ?? DELIVERY_CLAIM_LEASE_MS;
      if (!existing) {
        const claimed: AgentOsDeliveryRecord = {
          ...input.record,
          status: "reserved",
          claimOwner: input.claimOwner,
          leaseExpiresAt: new Date(
            Date.parse(input.nowIso) + leaseMs,
          ).toISOString(),
          updatedAt: input.nowIso,
          resolutionAudit: input.record.resolutionAudit ?? [],
        };
        claims.set(claimed.idempotencyKey, claimed);
        mergeDelivery(claimed);
        return { outcome: "claimed", record: { ...claimed } };
      }

      const decision = decideClaimConflict(existing, input.nowIso, leaseMs);
      if (decision.action === "exists") {
        return { outcome: "exists", record: { ...existing } };
      }
      if (decision.action === "mark-sending-uncertain") {
        const uncertain = buildExpiredSendingUncertainRecord(
          existing,
          input.nowIso,
        );
        claims.set(uncertain.idempotencyKey, uncertain);
        mergeDelivery(uncertain);
        return { outcome: "marked-uncertain", record: { ...uncertain } };
      }
      if (decision.action === "reclaim-reserved") {
        const reclaimed = buildReclaimedReservedRecord(
          input.record,
          existing,
          input.claimOwner,
          input.nowIso,
          leaseMs,
        );
        claims.set(reclaimed.idempotencyKey, reclaimed);
        mergeDelivery(reclaimed);
        return { outcome: "reclaimed", record: { ...reclaimed } };
      }
      // retry-after-failed
      const retried = buildRetryAfterFailedRecord(
        input.record,
        existing,
        input.claimOwner,
        input.nowIso,
        leaseMs,
      );
      claims.set(retried.idempotencyKey, retried);
      mergeDelivery(retried);
      return { outcome: "claimed", record: { ...retried } };
    },
    updateDelivery(record, options) {
      const existing = claims.get(record.idempotencyKey);
      if (existing) {
        if (
          options?.expectedClaimOwner != null &&
          existing.claimOwner !== options.expectedClaimOwner
        ) {
          throw new AgentOsPersistenceError(
            "write-failed",
            "Claim-owner mismatch: delivery update rejected",
          );
        }
        if (
          options?.expectedStatus != null &&
          existing.status !== options.expectedStatus
        ) {
          throw new AgentOsPersistenceError(
            "write-failed",
            `Expected status ${options.expectedStatus}, found ${existing.status}`,
          );
        }
      }
      claims.set(record.idempotencyKey, { ...record });
      mergeDelivery(record);
      return { ...record };
    },
    clear() {
      state = createEmptyPersistedState({
        adapterId: "durable-test",
        durability: "test-durable",
        modeScope: state.modeScope,
      });
      claims.clear();
    },
  };
}
