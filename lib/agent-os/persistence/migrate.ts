/**
 * Schema validation and minimal non-destructive migration for Agent OS state.
 */

import {
  AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
  AgentOsPersistenceError,
  type AgentOsPersistedState,
  type PersistenceAdapterId,
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

const VALID_ADAPTER_IDS = new Set<PersistenceAdapterId>([
  "memory",
  "file-local",
  "unconfigured-production",
  "durable-test",
  "supabase",
]);

/** Soft upper bound on persisted state JSON (~2 MiB). Oversized → fail closed. */
export const MAX_PERSISTED_STATE_JSON_BYTES = 2 * 1024 * 1024;

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

  // Bound malformed / oversized payloads before deep walk
  try {
    const approx = JSON.stringify(raw);
    if (approx.length > MAX_PERSISTED_STATE_JSON_BYTES) {
      throw new AgentOsPersistenceError(
        "corrupted-state",
        `Persisted Agent OS state exceeds size bound (${MAX_PERSISTED_STATE_JSON_BYTES} bytes)`,
      );
    }
  } catch (err) {
    if (err instanceof AgentOsPersistenceError) throw err;
    throw new AgentOsPersistenceError(
      "corrupted-state",
      "Persisted Agent OS state is not serializable",
    );
  }

  if (typeof raw.schemaVersion !== "number") {
    throw new AgentOsPersistenceError(
      "corrupted-state",
      "Persisted state missing schemaVersion",
    );
  }

  const schemaVersion = raw.schemaVersion;

  if (schemaVersion > AGENT_OS_PERSISTENCE_SCHEMA_VERSION) {
    throw new AgentOsPersistenceError(
      "unsupported-schema",
      `Unsupported future persistence schema version ${schemaVersion} (supported ≤ ${AGENT_OS_PERSISTENCE_SCHEMA_VERSION})`,
    );
  }

  if (schemaVersion < 1) {
    throw new AgentOsPersistenceError(
      "unsupported-schema",
      `Unsupported persistence schema version ${schemaVersion}`,
    );
  }

  // Non-destructive v1 → v2: add deliveries map when missing.
  if (schemaVersion === 1) {
    if (raw.deliveries == null) {
      raw.deliveries = {};
    }
    raw.schemaVersion = 2;
  }

  if ((raw.schemaVersion as number) < AGENT_OS_PERSISTENCE_SCHEMA_VERSION) {
    throw new AgentOsPersistenceError(
      "migration-refused",
      `No automatic destructive migration from schema ${raw.schemaVersion}`,
    );
  }

  requireObjectMap(raw, "findings");
  requireObjectMap(raw, "recommendations");
  requireObjectMap(raw, "cadences");
  requireObjectMap(raw, "inProgressByScope");
  requireObjectMap(raw, "deliveries");
  if (!Array.isArray(raw.runs)) {
    throw new AgentOsPersistenceError(
      "corrupted-state",
      "Persisted state.runs must be an array",
    );
  }

  const adapterId = raw.adapterId;
  if (
    typeof adapterId !== "string" ||
    !VALID_ADAPTER_IDS.has(adapterId as PersistenceAdapterId)
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

  // Non-destructive: ensure deliveries have required v2+ fields
  for (const [id, rawDel] of Object.entries(state.deliveries ?? {})) {
    const d = rawDel as Record<string, unknown>;
    if (!Array.isArray(d.resolutionAudit)) d.resolutionAudit = [];
    if (d.leaseExpiresAt === undefined) d.leaseExpiresAt = null;
    if (d.claimOwner === undefined) d.claimOwner = null;
    state.deliveries[id] = d as unknown as (typeof state.deliveries)[string];
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
