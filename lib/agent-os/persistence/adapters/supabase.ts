/**
 * Supabase / Postgres Agent OS persistence adapter.
 *
 * Production-durable, serverless-safe:
 * - State blob with optimistic version CAS (UPDATE … WHERE version = expected)
 * - Delivery claims with UNIQUE(idempotency_key) create-if-absent
 * - Expired `reserved` reclaim via lease_expires_at conditional UPDATE
 * - Expired `sending` → `uncertain` (never auto-reclaim for another send)
 *
 * Atomic SQL primitives (via AgentOsSupabaseDb):
 * - INSERT claim (PK conflict = exists)
 * - UPDATE … WHERE status='reserved' AND lease_expires_at < now  (reclaim)
 * - UPDATE … WHERE status='sending' AND lease_expires_at < now → uncertain
 * - UPDATE … WHERE status='failed' → reserved (retry after operator resolve)
 * - UPDATE … WHERE claim_owner / expected status (owner-sensitive transitions)
 * - UPDATE state WHERE version = expected (CAS; no overwrite on miss)
 *
 * Never stores secrets, credentials, or raw recipient addresses.
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and schema from
 * lib/supabase/agent-os-schema.sql.
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import {
  AgentOsPersistenceError,
  type AgentOsDeliveryRecord,
  type AgentOsPersistedState,
} from "../types";
import {
  createEmptyPersistedState,
  DELIVERY_CLAIM_LEASE_MS,
  type AgentOsPersistenceStore,
  type AtomicClaimDeliveryInput,
  type AtomicClaimDeliveryResult,
  type AtomicUpdateDeliveryOptions,
  type SavePersistenceOptions,
} from "../store";
import { validateAndMigrateState } from "../migrate";
import { redactSecretsAndPii } from "../../redaction";
import {
  buildExpiredSendingUncertainRecord,
  buildReclaimedReservedRecord,
  buildRetryAfterFailedRecord,
  decideClaimConflict,
} from "./claim-lease-policy";
import {
  createSupabaseAgentOsDb,
  recordToRow,
  rowToRecord,
  type AgentOsSupabaseDb,
  type ClaimRow,
} from "./supabase-db";

export type SupabasePersistenceAdapterOptions = {
  modeScope?: AgentOsPersistedState["modeScope"];
  client?: SupabaseClient;
  /** Inject DB ops for deterministic unit tests (no network). */
  db?: AgentOsSupabaseDb;
  /** Override scope key (default modeScope). */
  scope?: string;
};

export class SupabasePersistenceAdapter implements AgentOsPersistenceStore {
  readonly adapterId = "supabase" as const;
  readonly durability = "remote-durable" as const;
  readonly isDurable = true;
  readonly liveEligible = true;
  readonly fixtureEligible = false;

  private readonly scope: string;
  private readonly modeScope: AgentOsPersistedState["modeScope"];
  private readonly db: AgentOsSupabaseDb;
  private cachedVersion = 0;
  readonly instanceId = randomUUID();

  constructor(options: SupabasePersistenceAdapterOptions = {}) {
    this.modeScope = options.modeScope ?? "live";
    this.scope = options.scope ?? this.modeScope;
    if (options.db) {
      this.db = options.db;
    } else {
      const client = options.client ?? getSupabaseAdmin();
      if (!client) {
        throw new AgentOsPersistenceError(
          "unconfigured",
          "Supabase Agent OS persistence requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
        );
      }
      this.db = createSupabaseAgentOsDb(client);
    }
  }

  get version(): number {
    return this.cachedVersion;
  }

  async load(): Promise<AgentOsPersistedState> {
    let row;
    try {
      row = await this.db.selectState(this.scope);
    } catch (err) {
      throw new AgentOsPersistenceError(
        "read-failed",
        redactSecretsAndPii(err instanceof Error ? err.message : "read failed"),
      );
    }

    if (!row) {
      const empty = createEmptyPersistedState({
        adapterId: "supabase",
        durability: "remote-durable",
        modeScope: this.modeScope,
      });
      this.cachedVersion = 0;
      return empty;
    }

    this.cachedVersion = Number(row.version) || 0;
    const state = validateAndMigrateState(row.state);
    let claims: ClaimRow[];
    try {
      claims = await this.db.listClaims(100);
    } catch (err) {
      throw new AgentOsPersistenceError(
        "read-failed",
        redactSecretsAndPii(err instanceof Error ? err.message : "claims read failed"),
      );
    }
    const deliveries = { ...(state.deliveries ?? {}) };
    for (const c of claims) {
      const rec = rowToRecord(c);
      deliveries[rec.deliveryId] = rec;
    }
    return {
      ...state,
      adapterId: "supabase",
      durability: "remote-durable",
      modeScope: this.modeScope === "fixture" ? "live" : this.modeScope,
      deliveries,
    };
  }

  async save(
    state: AgentOsPersistedState,
    options?: SavePersistenceOptions,
  ): Promise<void> {
    const validated = validateAndMigrateState({
      ...state,
      adapterId: "supabase",
      durability: "remote-durable",
    });

    const expectedVersion =
      options?.expectedVersion ??
      (options?.expectedUpdatedAt != null ? this.cachedVersion : null);

    if (expectedVersion == null || expectedVersion === 0) {
      const existing = await this.db.selectState(this.scope);
      if (!existing) {
        const inserted = await this.db.insertState({
          scope: this.scope,
          state: validated,
          version: 1,
          updated_at: validated.updatedAt,
        });
        if (!inserted.ok) {
          throw new AgentOsPersistenceError(
            "write-failed",
            `Supabase state insert failed (CAS): ${redactSecretsAndPii(inserted.message)}`,
          );
        }
        this.cachedVersion = 1;
        return;
      }
    }

    const fromVersion = expectedVersion ?? this.cachedVersion;
    const nextVersion = fromVersion + 1;
    let data: Awaited<ReturnType<AgentOsSupabaseDb["updateStateCas"]>>;
    try {
      data = await this.db.updateStateCas({
        scope: this.scope,
        expectedVersion: fromVersion,
        nextVersion,
        state: validated,
        updatedAt: validated.updatedAt,
      });
    } catch (err) {
      throw new AgentOsPersistenceError(
        "write-failed",
        redactSecretsAndPii(err instanceof Error ? err.message : "CAS failed"),
      );
    }
    if (!data) {
      throw new AgentOsPersistenceError(
        "write-failed",
        "Supabase compare-and-swap failed: state version updated concurrently",
      );
    }
    this.cachedVersion = nextVersion;
  }

  /**
   * Atomic create-if-absent on idempotency_key.
   * Expired reserved → reclaim; expired sending → uncertain (no auto-resend).
   */
  async atomicClaimDelivery(
    input: AtomicClaimDeliveryInput,
  ): Promise<AtomicClaimDeliveryResult> {
    const leaseMs = input.leaseMs ?? DELIVERY_CLAIM_LEASE_MS;
    const record: AgentOsDeliveryRecord = {
      ...input.record,
      status: "reserved",
      claimOwner: input.claimOwner,
      leaseExpiresAt: new Date(
        Date.parse(input.nowIso) + leaseMs,
      ).toISOString(),
      updatedAt: input.nowIso,
      resolutionAudit: input.record.resolutionAudit ?? [],
    };
    const row = recordToRow(record);

    const inserted = await this.db.insertClaim(row);
    if (inserted) {
      return { outcome: "claimed", record: rowToRecord(inserted) };
    }

    const existingPre = await this.db.selectClaim(record.idempotencyKey);
    if (!existingPre) {
      throw new AgentOsPersistenceError(
        "write-failed",
        "atomic claim failed without existing row",
      );
    }
    const existing = rowToRecord(existingPre);
    const decision = decideClaimConflict(existing, input.nowIso, leaseMs);

    if (decision.action === "mark-sending-uncertain") {
      const uncertain = buildExpiredSendingUncertainRecord(
        existing,
        input.nowIso,
      );
      const updated = await this.db.updateClaimWhere({
        idempotencyKey: record.idempotencyKey,
        match: {
          statusEq: "sending",
          leaseExpiredBefore: input.nowIso,
        },
        patch: recordToRow(uncertain),
      });
      if (updated) {
        return {
          outcome: "marked-uncertain",
          record: rowToRecord(updated),
        };
      }
      // Lost race — re-read
      const again = await this.db.selectClaim(record.idempotencyKey);
      return {
        outcome: "exists",
        record: again ? rowToRecord(again) : existing,
      };
    }

    if (decision.action === "reclaim-reserved") {
      const reclaimed = buildReclaimedReservedRecord(
        input.record,
        existing,
        input.claimOwner,
        input.nowIso,
        leaseMs,
      );
      const updated = await this.db.updateClaimWhere({
        idempotencyKey: record.idempotencyKey,
        match: {
          statusEq: "reserved",
          leaseExpiredBefore: input.nowIso,
        },
        patch: recordToRow(reclaimed),
      });
      if (updated) {
        return { outcome: "reclaimed", record: rowToRecord(updated) };
      }
      const again = await this.db.selectClaim(record.idempotencyKey);
      return {
        outcome: "exists",
        record: again ? rowToRecord(again) : existing,
      };
    }

    if (decision.action === "retry-after-failed") {
      const retried = buildRetryAfterFailedRecord(
        input.record,
        existing,
        input.claimOwner,
        input.nowIso,
        leaseMs,
      );
      const updated = await this.db.updateClaimWhere({
        idempotencyKey: record.idempotencyKey,
        match: { statusEq: "failed" },
        patch: recordToRow(retried),
      });
      if (updated) {
        return { outcome: "claimed", record: rowToRecord(updated) };
      }
      const again = await this.db.selectClaim(record.idempotencyKey);
      return {
        outcome: "exists",
        record: again ? rowToRecord(again) : existing,
      };
    }

    return { outcome: "exists", record: existing };
  }

  async atomicUpdateDelivery(
    record: AgentOsDeliveryRecord,
    options?: AtomicUpdateDeliveryOptions,
  ): Promise<AgentOsDeliveryRecord> {
    const row = recordToRow(record);
    const match: {
      statusEq?: string;
      claimOwner?: string;
    } = {};
    if (options?.expectedStatus) match.statusEq = options.expectedStatus;
    if (options?.expectedClaimOwner) match.claimOwner = options.expectedClaimOwner;

    const updated = await this.db.updateClaimWhere({
      idempotencyKey: record.idempotencyKey,
      match,
      patch: row,
    });
    if (!updated) {
      throw new AgentOsPersistenceError(
        "write-failed",
        "Conditional delivery update failed (owner/status mismatch or missing row)",
      );
    }
    return rowToRecord(updated);
  }
}

export function tryCreateSupabasePersistenceAdapter(
  options?: SupabasePersistenceAdapterOptions,
): SupabasePersistenceAdapter | null {
  try {
    if (!options?.db && !options?.client && !getSupabaseAdmin()) return null;
    return new SupabasePersistenceAdapter(options);
  } catch {
    return null;
  }
}

export type { AgentOsSupabaseDb } from "./supabase-db";
export {
  createFakeAgentOsSupabaseDb,
  createSupabaseAgentOsDb,
} from "./supabase-db";
