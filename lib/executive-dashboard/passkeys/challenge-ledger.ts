/**
 * Durable WebAuthn challenge ledger.
 * In-memory implementation is for tests only. Production uses Postgres
 * atomic consume so two Vercel instances cannot both accept one jti.
 */

import type {
  PasskeyChallengeIssue,
  PasskeyChallengeLedger,
  PasskeyChallengeRecord,
} from "./types";

type Row = PasskeyChallengeRecord;

export class InMemoryPasskeyChallengeLedger implements PasskeyChallengeLedger {
  constructor(
    private readonly rows: Map<string, Row> = new Map(),
    private readonly now: () => number = () => Date.now(),
  ) {}

  async issue(record: PasskeyChallengeIssue): Promise<void> {
    if (this.rows.has(record.jti)) throw new Error("duplicate-jti");
    this.rows.set(record.jti, {
      ...record,
      consumedAt: null,
    });
  }

  async consume(jti: string): Promise<
    | { ok: true; record: PasskeyChallengeRecord }
    | { ok: false; reason: "missing-challenge" | "replayed-challenge" | "expired-challenge" }
  > {
    const nowMs = this.now();
    const row = this.rows.get(jti);
    if (!row) return { ok: false, reason: "missing-challenge" };
    if (row.consumedAt) return { ok: false, reason: "replayed-challenge" };
    if (Date.parse(row.expiresAt) <= nowMs) {
      return { ok: false, reason: "expired-challenge" };
    }
    row.consumedAt = new Date(nowMs).toISOString();
    return { ok: true, record: { ...row } };
  }
}
