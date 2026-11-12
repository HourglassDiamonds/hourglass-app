import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stableJson } from "@/lib/continuum/sterling/fingerprint";
import { STERLING_TODAY_LEASE_KEY } from "./run-lease";

export const OPERATIONAL_SHADOW_RESULT_CONTRACT =
  "sterling-operational-shadow-v11-sanitized-result-v1" as const;
export const OPERATIONAL_SHADOW_RESULT_RETENTION_MS = 24 * 60 * 60 * 1000;
export const OPERATIONAL_SHADOW_RESULT_MAX_BYTES = 2 * 1024 * 1024;

export type OperationalShadowResultRecord = {
  executionId: string;
  runId: string;
  founderUserId: string;
  sourceSha: string;
  sourceWatermark: string;
  resultSha256: string;
  resultByteCount: number;
  terminalStatus: "completed";
  sanitizedResult: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
};

export type OperationalShadowResultStore = {
  persistCompleted(record: OperationalShadowResultRecord): Promise<"stored" | "already_stored" | "conflict" | "unavailable">;
  retrieve(input: { executionId: string; founderUserId: string; sourceSha: string; now?: Date }): Promise<OperationalShadowResultRecord | null>;
  removeExact(input: { executionId: string; founderUserId: string; sourceSha: string }): Promise<boolean>;
};

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const FORBIDDEN_KEYS = new Set([
  "body", "snippet", "address", "email", "prompt", "rawPrompt", "rawResponse",
  "accessToken", "refreshToken", "clientSecret", "secret",
]);

function containsForbiddenMaterial(value: unknown): boolean {
  if (typeof value === "string") return EMAIL.test(value);
  if (Array.isArray(value)) return value.some(containsForbiddenMaterial);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, child]) => FORBIDDEN_KEYS.has(key) || containsForbiddenMaterial(child),
  );
}

export function prepareOperationalShadowResultRecord(input: {
  executionId: string;
  runId: string;
  founderUserId: string;
  sourceSha: string;
  sourceWatermark: string;
  sanitizedResult: Record<string, unknown>;
  now?: Date;
}): OperationalShadowResultRecord {
  const result = input.sanitizedResult;
  if (result.contract !== OPERATIONAL_SHADOW_RESULT_CONTRACT ||
      result.executionId !== input.executionId || result.runId !== input.runId ||
      result.sourceCommit !== input.sourceSha || containsForbiddenMaterial(result)) {
    throw new Error("sanitized-shadow-result-invalid");
  }
  if (!/^[a-f0-9]{40}$/.test(input.sourceSha) || !/^[0-9a-f-]{36}$/.test(input.executionId) ||
      !/^[0-9a-f-]{36}$/.test(input.runId) || !/^[0-9a-f-]{36}$/.test(input.founderUserId) ||
      !input.sourceWatermark || input.sourceWatermark.length > 512) {
    throw new Error("sanitized-shadow-result-identity-invalid");
  }
  const serialized = stableJson(result);
  const resultByteCount = Buffer.byteLength(serialized, "utf8");
  if (resultByteCount < 2 || resultByteCount > OPERATIONAL_SHADOW_RESULT_MAX_BYTES) {
    throw new Error("sanitized-shadow-result-size-invalid");
  }
  const now = input.now ?? new Date();
  return {
    executionId: input.executionId, runId: input.runId,
    founderUserId: input.founderUserId, sourceSha: input.sourceSha,
    sourceWatermark: input.sourceWatermark,
    resultSha256: createHash("sha256").update(serialized).digest("hex"),
    resultByteCount, terminalStatus: "completed", sanitizedResult: result,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + OPERATIONAL_SHADOW_RESULT_RETENTION_MS).toISOString(),
  };
}

export function verifyOperationalShadowResultRecord(record: OperationalShadowResultRecord): boolean {
  try {
    const prepared = prepareOperationalShadowResultRecord({
      executionId: record.executionId, runId: record.runId,
      founderUserId: record.founderUserId, sourceSha: record.sourceSha,
      sourceWatermark: record.sourceWatermark, sanitizedResult: record.sanitizedResult,
      now: new Date(record.createdAt),
    });
    return record.terminalStatus === "completed" && prepared.resultSha256 === record.resultSha256 &&
      prepared.resultByteCount === record.resultByteCount && prepared.expiresAt === record.expiresAt;
  } catch {
    return false;
  }
}

function mapRow(row: Record<string, unknown>): OperationalShadowResultRecord {
  return {
    executionId: String(row.execution_id), runId: String(row.run_id),
    founderUserId: String(row.founder_user_id), sourceSha: String(row.source_sha),
    sourceWatermark: String(row.source_watermark), resultSha256: String(row.result_sha256),
    resultByteCount: Number(row.result_byte_count), terminalStatus: "completed",
    sanitizedResult: row.sanitized_result as Record<string, unknown>,
    createdAt: String(row.created_at), expiresAt: String(row.expires_at),
  };
}

export function createSupabaseOperationalShadowResultStore(client: SupabaseClient): OperationalShadowResultStore {
  return {
    async persistCompleted(record) {
      const { data, error } = await client.rpc("continuum_persist_sterling_operational_shadow_result", {
        p_lease_key: STERLING_TODAY_LEASE_KEY,
        p_execution_id: record.executionId, p_run_id: record.runId,
        p_founder_user_id: record.founderUserId, p_source_sha: record.sourceSha,
        p_source_watermark: record.sourceWatermark, p_result_sha256: record.resultSha256,
        p_result_byte_count: record.resultByteCount, p_sanitized_result: record.sanitizedResult,
        p_created_at: record.createdAt, p_expires_at: record.expiresAt,
      });
      if (error) return error.message?.includes("sterling_shadow_result_conflict") ? "conflict" : "unavailable";
      return data === "stored" || data === "already_stored" ? data : "unavailable";
    },
    async retrieve(input) {
      const { data, error } = await client.from("continuum_sterling_operational_shadow_results")
        .select("execution_id,run_id,founder_user_id,source_sha,source_watermark,result_sha256,result_byte_count,terminal_status,sanitized_result,created_at,expires_at")
        .eq("execution_id", input.executionId).eq("founder_user_id", input.founderUserId)
        .eq("source_sha", input.sourceSha).maybeSingle();
      if (error || !data) return null;
      const mapped = mapRow(data as Record<string, unknown>);
      if (Date.parse(mapped.expiresAt) <= (input.now ?? new Date()).getTime()) return null;
      return verifyOperationalShadowResultRecord(mapped) ? mapped : null;
    },
    async removeExact(input) {
      const { data, error } = await client.from("continuum_sterling_operational_shadow_results")
        .delete().eq("execution_id", input.executionId).eq("founder_user_id", input.founderUserId)
        .eq("source_sha", input.sourceSha).select("execution_id");
      return !error && Array.isArray(data) && data.length === 1;
    },
  };
}

export class InMemoryOperationalShadowResultStore implements OperationalShadowResultStore {
  private readonly rows = new Map<string, OperationalShadowResultRecord>();
  constructor(private readonly interruptBeforeCommit = false) {}
  async persistCompleted(record: OperationalShadowResultRecord) {
    if (this.interruptBeforeCommit) return "unavailable" as const;
    const current = this.rows.get(record.executionId);
    if (current) return current.resultSha256 === record.resultSha256 && current.runId === record.runId
      ? "already_stored" as const : "conflict" as const;
    this.rows.set(record.executionId, structuredClone(record));
    return "stored" as const;
  }
  async retrieve(input: { executionId: string; founderUserId: string; sourceSha: string; now?: Date }) {
    const row = this.rows.get(input.executionId);
    if (!row || row.founderUserId !== input.founderUserId || row.sourceSha !== input.sourceSha ||
        Date.parse(row.expiresAt) <= (input.now ?? new Date()).getTime() ||
        !verifyOperationalShadowResultRecord(row)) return null;
    return structuredClone(row);
  }
  async removeExact(input: { executionId: string; founderUserId: string; sourceSha: string }) {
    const row = this.rows.get(input.executionId);
    if (!row || row.founderUserId !== input.founderUserId || row.sourceSha !== input.sourceSha) return false;
    return this.rows.delete(input.executionId);
  }
}
