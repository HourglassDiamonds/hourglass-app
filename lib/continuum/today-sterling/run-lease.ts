import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const STERLING_TODAY_LEASE_KEY = "founder-shadow-v1" as const;
export const STERLING_TODAY_LEASE_MS = 6 * 60 * 1000;

export type SterlingRunLease = {
  runId: string;
  runDigest: string;
  idempotencyKey: string;
  startedAt: string;
  expiresAt: string;
};

export type SterlingRunLeaseStore = {
  claim(lease: SterlingRunLease): Promise<"claimed" | "busy" | "unavailable">;
  finish(runId: string, state: "completed" | "failed", finishedAt: string): Promise<boolean>;
};

export function createSterlingRunLease(input: {
  now?: Date;
  mode: "semantic";
  scopeVersion: string;
}): SterlingRunLease {
  const now = input.now ?? new Date();
  const runId = randomUUID();
  const runDigest = createHash("sha256").update(`${input.mode}:${input.scopeVersion}`).digest("hex");
  const idempotencyKey = createHash("sha256").update(`${runId}:${runDigest}`).digest("hex");
  return {
    runId,
    runDigest,
    idempotencyKey,
    startedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + STERLING_TODAY_LEASE_MS).toISOString(),
  };
}

/** Calls separately authorized metadata-only RPCs; missing schema fails closed. */
export function createSupabaseSterlingRunLeaseStore(client: SupabaseClient): SterlingRunLeaseStore {
  return {
    async claim(lease) {
      const { data, error } = await client.rpc("continuum_claim_sterling_today_run", {
        p_lease_key: STERLING_TODAY_LEASE_KEY,
        p_run_id: lease.runId,
        p_run_digest: lease.runDigest,
        p_idempotency_key: lease.idempotencyKey,
        p_started_at: lease.startedAt,
        p_expires_at: lease.expiresAt,
      });
      if (error) return "unavailable";
      return data === true ? "claimed" : "busy";
    },
    async finish(runId, state, finishedAt) {
      const { data, error } = await client.rpc("continuum_finish_sterling_today_run", {
        p_lease_key: STERLING_TODAY_LEASE_KEY,
        p_run_id: runId,
        p_run_state: state,
        p_finished_at: finishedAt,
      });
      return !error && data === true;
    },
  };
}

/** Test/reference implementation. Production semantic execution must use a durable store. */
export class InMemorySterlingRunLeaseStore implements SterlingRunLeaseStore {
  private current: (SterlingRunLease & { state: "running" | "completed" | "failed" }) | null = null;

  async claim(lease: SterlingRunLease): Promise<"claimed" | "busy"> {
    if (this.current?.state === "running" && Date.parse(this.current.expiresAt) > Date.parse(lease.startedAt)) {
      return "busy";
    }
    this.current = { ...lease, state: "running" };
    return "claimed";
  }

  async finish(runId: string, state: "completed" | "failed", _finishedAt: string): Promise<boolean> {
    void _finishedAt;
    if (!this.current || this.current.runId !== runId) return false;
    if (this.current.state === state) return true;
    if (this.current.state !== "running") return false;
    this.current = { ...this.current, state };
    return true;
  }
}
