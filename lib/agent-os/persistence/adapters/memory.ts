/**
 * In-memory Agent OS persistence adapter.
 * Ephemeral — does not survive process restart.
 * Suitable for tests and explicit non-durable local runs.
 */

import type { AgentOsPersistedState } from "../types";
import {
  createEmptyPersistedState,
  type AgentOsPersistenceStore,
} from "../store";
import { deepCloneState, validateAndMigrateState } from "../migrate";

export type MemoryAdapterOptions = {
  modeScope?: AgentOsPersistedState["modeScope"];
  /** Seed state (cloned). */
  initial?: AgentOsPersistedState;
  nowIso?: string;
};

export class InMemoryPersistenceAdapter implements AgentOsPersistenceStore {
  readonly adapterId = "memory" as const;
  readonly durability = "ephemeral" as const;
  readonly isDurable = false;
  readonly liveEligible = false;
  readonly fixtureEligible = true;

  private state: AgentOsPersistedState;

  constructor(options: MemoryAdapterOptions = {}) {
    this.state =
      options.initial != null
        ? deepCloneState(options.initial)
        : createEmptyPersistedState({
            adapterId: "memory",
            durability: "ephemeral",
            modeScope: options.modeScope ?? "test",
            nowIso: options.nowIso,
          });
  }

  async load(): Promise<AgentOsPersistedState> {
    return deepCloneState(validateAndMigrateState(this.state));
  }

  async save(state: AgentOsPersistedState): Promise<void> {
    this.state = deepCloneState(validateAndMigrateState(state));
  }

  async clear(): Promise<void> {
    this.state = createEmptyPersistedState({
      adapterId: "memory",
      durability: "ephemeral",
      modeScope: this.state.modeScope,
    });
  }

  /** Test helper — inspect without clone validation side effects. */
  snapshot(): AgentOsPersistedState {
    return deepCloneState(this.state);
  }
}
