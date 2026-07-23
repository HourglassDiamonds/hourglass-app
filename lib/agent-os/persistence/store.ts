/**
 * Agent OS persistence store interface and empty-state helpers.
 */

import {
  AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
  type AgentOsPersistedState,
  type AgentOsPersistenceError,
  type PersistenceAdapterId,
  type PersistenceDurability,
} from "./types";
import { defaultCadenceDefinitions } from "./cadence";

export type AgentOsPersistenceStore = {
  readonly adapterId: PersistenceAdapterId;
  readonly durability: PersistenceDurability;
  /** True when writes survive process restart in the current environment. */
  readonly isDurable: boolean;
  /** Live mode may use this adapter only when true. */
  readonly liveEligible: boolean;
  /** Fixture/test mode eligibility. */
  readonly fixtureEligible: boolean;

  load(): Promise<AgentOsPersistedState>;
  /**
   * Replace entire state with crash-resistant semantics for the active adapter
   * (memory: in-process replace; file-local: temp + last-known-good recovery —
   * not a guarantee of single-syscall atomic rename-over on Windows).
   */
  save(state: AgentOsPersistedState): Promise<void>;
  clear?(): Promise<void>;
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
