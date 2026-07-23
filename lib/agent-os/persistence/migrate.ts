/**
 * Schema validation and minimal non-destructive migration for Agent OS state.
 */

import {
  AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
  AgentOsPersistenceError,
  type AgentOsPersistedState,
} from "./types";
import { defaultCadenceDefinitions } from "./cadence";

export function deepCloneState(
  state: AgentOsPersistedState,
): AgentOsPersistedState {
  return JSON.parse(JSON.stringify(state)) as AgentOsPersistedState;
}

export function serializePersistedState(state: AgentOsPersistedState): string {
  const validated = validateAndMigrateState(state);
  return `${JSON.stringify(validated, null, 2)}\n`;
}

export function parsePersistedStateJson(raw: string): AgentOsPersistedState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new AgentOsPersistenceError(
      "corrupted-state",
      "Persisted Agent OS state is not valid JSON",
      err instanceof Error ? err.message : String(err),
    );
  }
  return validateAndMigrateState(parsed);
}

export function validateAndMigrateState(
  input: unknown,
): AgentOsPersistedState {
  if (!input || typeof input !== "object") {
    throw new AgentOsPersistenceError(
      "corrupted-state",
      "Persisted Agent OS state must be an object",
    );
  }
  const raw = input as Record<string, unknown>;

  if (typeof raw.schemaVersion !== "number") {
    throw new AgentOsPersistenceError(
      "corrupted-state",
      "Persisted state missing schemaVersion",
    );
  }

  if (raw.schemaVersion > AGENT_OS_PERSISTENCE_SCHEMA_VERSION) {
    throw new AgentOsPersistenceError(
      "unsupported-schema",
      `Unsupported future persistence schema version ${raw.schemaVersion} (supported ≤ ${AGENT_OS_PERSISTENCE_SCHEMA_VERSION})`,
    );
  }

  if (raw.schemaVersion < 1) {
    throw new AgentOsPersistenceError(
      "unsupported-schema",
      `Unsupported persistence schema version ${raw.schemaVersion}`,
    );
  }

  // Minimal migration path: v1 → current (currently identity).
  // Never destructive — only fills missing cadence defaults.
  if (raw.schemaVersion < AGENT_OS_PERSISTENCE_SCHEMA_VERSION) {
    // No older versions yet; refuse silent destructive upgrades.
    throw new AgentOsPersistenceError(
      "migration-refused",
      `No automatic destructive migration from schema ${raw.schemaVersion}`,
    );
  }

  requireObjectMap(raw, "findings");
  requireObjectMap(raw, "recommendations");
  requireObjectMap(raw, "cadences");
  requireObjectMap(raw, "inProgressByScope");
  if (!Array.isArray(raw.runs)) {
    throw new AgentOsPersistenceError(
      "corrupted-state",
      "Persisted state.runs must be an array",
    );
  }

  const adapterId = raw.adapterId;
  if (
    adapterId !== "memory" &&
    adapterId !== "file-local" &&
    adapterId !== "unconfigured-production"
  ) {
    throw new AgentOsPersistenceError(
      "corrupted-state",
      "Persisted state has invalid adapterId",
    );
  }

  const state = raw as unknown as AgentOsPersistedState;

  // Non-destructive: ensure default cadences exist without wiping user fields.
  const defaults = defaultCadenceDefinitions();
  for (const def of defaults) {
    if (!state.cadences[def.cadenceId]) {
      state.cadences[def.cadenceId] = def;
    }
  }

  state.schemaVersion = AGENT_OS_PERSISTENCE_SCHEMA_VERSION;
  return state;
}

function requireObjectMap(raw: Record<string, unknown>, key: string): void {
  if (!raw[key] || typeof raw[key] !== "object" || Array.isArray(raw[key])) {
    throw new AgentOsPersistenceError(
      "corrupted-state",
      `Persisted state.${key} must be an object map`,
    );
  }
}
