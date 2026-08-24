/**
 * In-memory iPhone pairing store. Tests only.
 * Production uses Postgres atomic claim/transition RPCs.
 */

import { randomUUID } from "node:crypto";
import type {
  PasskeyPairingInsert,
  PasskeyPairingRecord,
  PasskeyPairingStore,
} from "./types";

function clone(row: PasskeyPairingRecord): PasskeyPairingRecord {
  return { ...row };
}

export class InMemoryPasskeyPairingStore implements PasskeyPairingStore {
  constructor(
    private readonly rows: Map<string, PasskeyPairingRecord> = new Map(),
    private readonly now: () => number = () => Date.now(),
  ) {}

  async insert(record: PasskeyPairingInsert): Promise<PasskeyPairingRecord> {
    const saved: PasskeyPairingRecord = {
      id: randomUUID(),
      founderUserId: record.founderUserId,
      tokenHash: record.tokenHash,
      status: "pending",
      matchCode: record.matchCode,
      deviceHint: null,
      claimedSessionHash: null,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      claimedAt: null,
      approvedAt: null,
      completedAt: null,
    };
    this.rows.set(saved.id, saved);
    return clone(saved);
  }

  async getById(id: string): Promise<PasskeyPairingRecord | null> {
    const row = this.rows.get(id);
    return row ? clone(row) : null;
  }

  async claim(input: {
    tokenHash: string;
    claimedSessionHash: string;
    deviceHint: string | null;
  }): Promise<
    | { ok: true; record: PasskeyPairingRecord }
    | { ok: false; reason: "invalid-pairing" | "already-claimed" | "pairing-expired" }
  > {
    const nowMs = this.now();
    let found: PasskeyPairingRecord | undefined;
    for (const row of this.rows.values()) {
      if (row.tokenHash === input.tokenHash) {
        found = row;
        break;
      }
    }
    if (!found) return { ok: false, reason: "invalid-pairing" };
    if (Date.parse(found.expiresAt) <= nowMs) {
      return { ok: false, reason: "pairing-expired" };
    }
    if (found.status !== "pending") {
      return { ok: false, reason: "already-claimed" };
    }
    found.status = "claimed";
    found.claimedSessionHash = input.claimedSessionHash;
    found.deviceHint = input.deviceHint;
    found.claimedAt = new Date(nowMs).toISOString();
    return { ok: true, record: clone(found) };
  }

  async transition(
    id: string,
    from: "claimed" | "approved",
    to: "approved" | "completed",
  ): Promise<
    | { ok: true; record: PasskeyPairingRecord }
    | { ok: false; reason: "pairing-not-usable" }
  > {
    const nowMs = this.now();
    const row = this.rows.get(id);
    if (!row) return { ok: false, reason: "pairing-not-usable" };
    if (Date.parse(row.expiresAt) <= nowMs) {
      return { ok: false, reason: "pairing-not-usable" };
    }
    if (row.status !== from) return { ok: false, reason: "pairing-not-usable" };
    if (
      !(
        (from === "claimed" && to === "approved") ||
        (from === "approved" && to === "completed")
      )
    ) {
      return { ok: false, reason: "pairing-not-usable" };
    }
    row.status = to;
    if (to === "approved") row.approvedAt = new Date(nowMs).toISOString();
    if (to === "completed") row.completedAt = new Date(nowMs).toISOString();
    return { ok: true, record: clone(row) };
  }

  async cancel(id: string): Promise<
    | { ok: true; record: PasskeyPairingRecord }
    | { ok: false; reason: "pairing-not-usable" }
  > {
    const row = this.rows.get(id);
    if (!row) return { ok: false, reason: "pairing-not-usable" };
    if (
      row.status !== "pending" &&
      row.status !== "claimed" &&
      row.status !== "approved"
    ) {
      return { ok: false, reason: "pairing-not-usable" };
    }
    row.status = "cancelled";
    return { ok: true, record: clone(row) };
  }
}
