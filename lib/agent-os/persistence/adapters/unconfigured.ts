/**
 * Unconfigured production persistence adapter.
 * Explicitly fails reads/writes — never silently falls back to fixtures or memory.
 */

import {
  AgentOsPersistenceError,
  type AgentOsPersistedState,
} from "../types";
import type { AgentOsPersistenceStore } from "../store";

export class UnconfiguredProductionAdapter implements AgentOsPersistenceStore {
  readonly adapterId = "unconfigured-production" as const;
  readonly durability = "none" as const;
  readonly isDurable = false;
  readonly liveEligible = false;
  readonly fixtureEligible = false;

  async load(): Promise<AgentOsPersistedState> {
    throw new AgentOsPersistenceError(
      "unconfigured",
      "Agent OS durable persistence is not configured for production/serverless. " +
        "Use an explicit local adapter for manual runs, or configure a future production store. " +
        "In-memory and fixture adapters must not be used implicitly in live mode.",
    );
  }

  async save(_state: AgentOsPersistedState): Promise<void> {
    void _state;
    throw new AgentOsPersistenceError(
      "unconfigured",
      "Agent OS durable persistence is not configured — refusing write. " +
        "Local filesystem persistence is not production-safe on serverless infrastructure.",
    );
  }
}
