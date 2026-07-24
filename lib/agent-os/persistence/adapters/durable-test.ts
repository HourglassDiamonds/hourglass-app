/**
 * Explicit durable-test persistence adapter.
 *
 * Test / harness only — never selected in production or scheduled-live
 * without allowDurableTest. Supports shared backend so two independent
 * adapter instances can race the same claim map (multi-instance simulation).
 */

import { randomUUID } from "node:crypto";
import type { AgentOsDeliveryRecord, AgentOsPersistedState } from "../types";
import {
  createEmptyPersistedState,
  DELIVERY_CLAIM_LEASE_MS,
  type AgentOsPersistenceStore,
  type AtomicClaimDeliveryInput,
  type AtomicClaimDeliveryResult,
  type AtomicUpdateDeliveryOptions,
  type SavePersistenceOptions,
} from "../store";
import { deepCloneState, validateAndMigrateState } from "../migrate";
import { AgentOsPersistenceError } from "../types";
import {
  createSharedDurableTestBackend,
  type SharedDurableTestBackend,
} from "./shared-durable-test-backend";
import {
  buildExpiredSendingUncertainRecord,
  buildReclaimedReservedRecord,
  buildRetryAfterFailedRecord,
  decideClaimConflict,
} from "./claim-lease-policy";

export type DurableTestAdapterOptions = {
  modeScope?: AgentOsPersistedState["modeScope"];
  initial?: AgentOsPersistedState;
  nowIso?: string;
  saveDelayMs?: number;
  /** Shared backend for multi-instance concurrency tests. */
  shared?: SharedDurableTestBackend;
};

export class DurableTestPersistenceAdapter implements AgentOsPersistenceStore {
  readonly adapterId = "durable-test" as const;
  readonly durability = "test-durable" as const;
  readonly isDurable = true;
  readonly liveEligible = true;
  readonly fixtureEligible = true;

  private state: AgentOsPersistedState;
  private readonly saveDelayMs: number;
  private lock: Promise<void> = Promise.resolve();
  private readonly shared: SharedDurableTestBackend | null;
  readonly instanceId = randomUUID();

  constructor(options: DurableTestAdapterOptions = {}) {
    this.saveDelayMs = options.saveDelayMs ?? 0;
    this.shared = options.shared ?? null;
    this.state =
      options.initial != null
        ? deepCloneState(options.initial)
        : createEmptyPersistedState({
            adapterId: "durable-test",
            durability: "test-durable",
            modeScope: options.modeScope ?? "test",
            nowIso: options.nowIso,
          });
    if (this.shared && options.initial) {
      this.shared.save(this.state);
    }
  }

  async load(): Promise<AgentOsPersistedState> {
    if (this.shared) return this.shared.load();
    return deepCloneState(validateAndMigrateState(this.state));
  }

  async save(
    state: AgentOsPersistedState,
    options?: SavePersistenceOptions,
  ): Promise<void> {
    const run = async () => {
      if (this.saveDelayMs > 0) {
        await new Promise((r) => setTimeout(r, this.saveDelayMs));
      }
      if (this.shared) {
        this.shared.save(state, options?.expectedUpdatedAt);
        return;
      }
      if (
        options?.expectedUpdatedAt != null &&
        this.state.updatedAt !== options.expectedUpdatedAt
      ) {
        throw new AgentOsPersistenceError(
          "write-failed",
          "Durable-test compare-and-swap failed: state updated concurrently",
        );
      }
      this.state = deepCloneState(validateAndMigrateState(state));
    };
    const prev = this.lock;
    let release!: () => void;
    this.lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      await run();
    } finally {
      release();
    }
  }

  async atomicClaimDelivery(
    input: AtomicClaimDeliveryInput,
  ): Promise<AtomicClaimDeliveryResult> {
    if (this.shared) {
      return this.shared.atomicClaim(input);
    }
    const prior = await this.load();
    const existing = Object.values(prior.deliveries ?? {}).find(
      (d) => d.idempotencyKey === input.record.idempotencyKey,
    );
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
      const next = {
        ...prior,
        updatedAt: input.nowIso,
        deliveries: {
          ...(prior.deliveries ?? {}),
          [claimed.deliveryId]: claimed,
        },
      };
      await this.save(next, { expectedUpdatedAt: prior.updatedAt });
      return { outcome: "claimed", record: claimed };
    }

    const decision = decideClaimConflict(existing, input.nowIso, leaseMs);
    if (decision.action === "exists") {
      return { outcome: "exists", record: existing };
    }
    if (decision.action === "mark-sending-uncertain") {
      const uncertain = buildExpiredSendingUncertainRecord(
        existing,
        input.nowIso,
      );
      const next = {
        ...prior,
        updatedAt: input.nowIso,
        deliveries: {
          ...(prior.deliveries ?? {}),
          [uncertain.deliveryId]: uncertain,
        },
      };
      await this.save(next, { expectedUpdatedAt: prior.updatedAt });
      return { outcome: "marked-uncertain", record: uncertain };
    }

    const nextRecord =
      decision.action === "reclaim-reserved"
        ? buildReclaimedReservedRecord(
            input.record,
            existing,
            input.claimOwner,
            input.nowIso,
            leaseMs,
          )
        : buildRetryAfterFailedRecord(
            input.record,
            existing,
            input.claimOwner,
            input.nowIso,
            leaseMs,
          );

    const next = {
      ...prior,
      updatedAt: input.nowIso,
      deliveries: {
        ...(prior.deliveries ?? {}),
        [nextRecord.deliveryId]: nextRecord,
      },
    };
    await this.save(next, { expectedUpdatedAt: prior.updatedAt });
    return {
      outcome:
        decision.action === "reclaim-reserved" ? "reclaimed" : "claimed",
      record: nextRecord,
    };
  }

  async atomicUpdateDelivery(
    record: AgentOsDeliveryRecord,
    options?: AtomicUpdateDeliveryOptions,
  ): Promise<AgentOsDeliveryRecord> {
    if (this.shared) return this.shared.updateDelivery(record, options);
    const prior = await this.load();
    const existing = prior.deliveries?.[record.deliveryId];
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
    const next = {
      ...prior,
      updatedAt: record.updatedAt,
      deliveries: {
        ...(prior.deliveries ?? {}),
        [record.deliveryId]: record,
      },
    };
    await this.save(next);
    return record;
  }

  async clear(): Promise<void> {
    if (this.shared) {
      this.shared.clear();
      return;
    }
    this.state = createEmptyPersistedState({
      adapterId: "durable-test",
      durability: "test-durable",
      modeScope: this.state.modeScope,
    });
  }

  snapshot(): AgentOsPersistedState {
    if (this.shared) return this.shared.load();
    return deepCloneState(this.state);
  }
}

export { createSharedDurableTestBackend };
export type { SharedDurableTestBackend };
