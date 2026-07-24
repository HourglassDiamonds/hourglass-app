/**
 * Agent OS persistence store interface and empty-state helpers.
 */

import {
  AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
  type AgentOsDeliveryRecord,
  type AgentOsPersistedState,
  type AgentOsPersistenceError,
  type PersistenceAdapterId,
  type PersistenceDurability,
} from "./types";
import { defaultCadenceDefinitions } from "./cadence";

/**
 * Default lease for reserved claims (reclaimable when expired).
 * Expired `sending` is NEVER reclaimed for send — it becomes uncertain.
 */
export const DELIVERY_CLAIM_LEASE_MS = 15 * 60 * 1000;

export type AtomicClaimDeliveryInput = {
  record: AgentOsDeliveryRecord;
  /** Non-secret instance owner token. */
  claimOwner: string;
  nowIso: string;
  leaseMs?: number;
};

export type AtomicClaimDeliveryResult =
  | { outcome: "claimed"; record: AgentOsDeliveryRecord }
  | { outcome: "exists"; record: AgentOsDeliveryRecord }
  | { outcome: "reclaimed"; record: AgentOsDeliveryRecord }
  /** Expired sending was atomically marked uncertain — auto-send blocked. */
  | { outcome: "marked-uncertain"; record: AgentOsDeliveryRecord };

export type SavePersistenceOptions = {
  /** Optimistic concurrency: reject when prior updatedAt/version mismatches. */
  expectedUpdatedAt?: string;
  expectedVersion?: number;
};

export type AtomicUpdateDeliveryOptions = {
  /** Require current claim_owner match (owner-sensitive transitions). */
  expectedClaimOwner?: string;
  /** Require current status match (e.g. uncertain → sent|failed). */
  expectedStatus?: AgentOsDeliveryRecord["status"];
};

export type AgentOsPersistenceStore = {
  readonly adapterId: PersistenceAdapterId;
  readonly durability: PersistenceDurability;
  /** True when writes survive process restart in the current environment. */
  readonly isDurable: boolean;
  /** Live mode may use this adapter only when true. */
  readonly liveEligible: boolean;
  /** Fixture/test mode eligibility. */
  readonly fixtureEligible: boolean;
  /** Optional monotonic version for remote CAS adapters. */
  readonly version?: number;

  load(): Promise<AgentOsPersistedState>;
  /**
   * Replace entire state with crash-resistant semantics for the active adapter.
   * When expectedUpdatedAt/expectedVersion is set, adapters that support CAS
   * must fail closed on mismatch (do not overwrite newer state).
   */
  save(
    state: AgentOsPersistedState,
    options?: SavePersistenceOptions,
  ): Promise<void>;
  clear?(): Promise<void>;

  /**
   * Atomic create-if-absent / expired-reserved reclaim / expired-sending→uncertain.
   * Required for multi-instance scheduled-live safety.
   */
  atomicClaimDelivery?(
    input: AtomicClaimDeliveryInput,
  ): Promise<AtomicClaimDeliveryResult>;

  /**
   * Persist delivery status transition.
   * When options.expectedClaimOwner / expectedStatus are set, update is conditional.
   */
  atomicUpdateDelivery?(
    record: AgentOsDeliveryRecord,
    options?: AtomicUpdateDeliveryOptions,
  ): Promise<AgentOsDeliveryRecord>;
};

export function createEmptyPersistedState(input: {
  adapterId: PersistenceAdapterId;
  durability: PersistenceDurability;
  modeScope: AgentOsPersistedState["modeScope"];
  nowIso?: string;
}): AgentOsPersistedState {
  const now = input.nowIso ?? new Date().toISOString();
  const cadences = Object.fromEntries(
    defaultCadenceDefinitions().map((c) => [c.cadenceId, c]),
  );
  return {
    schemaVersion: AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
    adapterId: input.adapterId,
    durability: input.durability,
    modeScope: input.modeScope,
    updatedAt: now,
    runs: [],
    findings: {},
    recommendations: {},
    cadences,
    inProgressByScope: {},
    deliveries: {},
  };
}

export function isPersistenceError(
  err: unknown,
): err is AgentOsPersistenceError {
  return (
    !!err &&
    typeof err === "object" &&
    (err as { name?: string }).name === "AgentOsPersistenceError"
  );
}

/** Cap retained run history to control storage growth. */
export const MAX_RETAINED_RUNS = 50;

/** Cap retained delivery records in the state blob. */
export const MAX_RETAINED_DELIVERIES = 100;
