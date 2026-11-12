import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  InMemoryOperationalShadowResultStore,
  prepareOperationalShadowResultRecord,
} from "./operational-shadow-result-store";
import { persistCompletedOperationalShadowResult } from "./operational-shadow-review";

const executionId = "72000000-0000-4000-8000-000000000001";
const runId = "72000000-0000-4000-8000-000000000002";
const founderUserId = "8f3c1d2e-9a70-4b5e-8c11-00c0711aa001";
const sourceSha = "c".repeat(40);

function result(extra: Record<string, unknown> = {}) {
  return {
    contract: "sterling-operational-shadow-v11-sanitized-result-v1",
    verdict: "GENERATED_WITH_BLOCKS",
    executionId, runId, sourceCommit: sourceSha,
    generatedBoard: [{ workUnitId: "opaque:one", owner: "founder" }],
    comparator: { passed: false, missedMaterialObligations: 1 },
    evidence: [{ threadId: "thread-opaque", status: "complete_live" }],
    ...extra,
  };
}

function input(store: InMemoryOperationalShadowResultStore, sanitized = result()) {
  return { store, result: sanitized, executionId, runId, founderUserId,
    sourceSha, sourceWatermark: "watermark-1", now: new Date("2026-11-12T20:30:00.000Z") };
}

describe("durable operational shadow result", () => {
  it("recovers a completed sanitized result after the initial response is deliberately dropped", async () => {
    const store = new InMemoryOperationalShadowResultStore();
    await persistCompletedOperationalShadowResult(input(store));
    // Simulate the HTTP response disappearing after persistence: discard the return entirely.
    const recovered = await store.retrieve({ executionId, founderUserId, sourceSha,
      now: new Date("2026-11-12T20:31:00.000Z") });
    assert.equal(recovered?.terminalStatus, "completed");
    assert.equal(recovered?.sanitizedResult.contract, "sterling-operational-shadow-v11-sanitized-result-v1");
    assert.match(recovered?.resultSha256 ?? "", /^[a-f0-9]{64}$/);
  });

  it("denies cross-founder and wrong-source retrieval", async () => {
    const store = new InMemoryOperationalShadowResultStore();
    await persistCompletedOperationalShadowResult(input(store));
    assert.equal(await store.retrieve({ executionId,
      founderUserId: "82000000-0000-4000-8000-000000000099", sourceSha }), null);
    assert.equal(await store.retrieve({ executionId, founderUserId, sourceSha: "d".repeat(40) }), null);
  });

  it("never labels interrupted persistence successful", async () => {
    const store = new InMemoryOperationalShadowResultStore(true);
    await assert.rejects(() => persistCompletedOperationalShadowResult(input(store)), /shadow-result-unavailable/);
    assert.equal(await store.retrieve({ executionId, founderUserId, sourceSha }), null);
  });

  it("makes an exact duplicate idempotent and a conflicting duplicate fail", async () => {
    const store = new InMemoryOperationalShadowResultStore();
    await persistCompletedOperationalShadowResult(input(store));
    await persistCompletedOperationalShadowResult(input(store));
    await assert.rejects(() => persistCompletedOperationalShadowResult(input(store,
      result({ generatedBoard: [{ workUnitId: "opaque:changed" }] }))), /shadow-result-conflict/);
  });

  it("requires exact cleanup ownership and enforces the 24-hour retrieval bound", async () => {
    const store = new InMemoryOperationalShadowResultStore();
    await persistCompletedOperationalShadowResult(input(store));
    assert.equal(await store.removeExact({ executionId,
      founderUserId: "82000000-0000-4000-8000-000000000099", sourceSha }), false);
    assert.equal(await store.retrieve({ executionId, founderUserId, sourceSha,
      now: new Date("2026-11-13T20:30:00.001Z") }), null);
    assert.equal(await store.removeExact({ executionId, founderUserId, sourceSha }), true);
    assert.equal(await store.retrieve({ executionId, founderUserId, sourceSha }), null);
  });

  it("rejects correspondence, prompt, credential, and email-bearing material before persistence", () => {
    for (const unsafe of [
      { body: "customer words" }, { snippet: "customer words" },
      { prompt: "raw prompt" }, { accessToken: "token" }, { note: "client@example.com" },
    ]) {
      assert.throws(() => prepareOperationalShadowResultRecord({
        executionId, runId, founderUserId, sourceSha, sourceWatermark: "watermark-1",
        sanitizedResult: result(unsafe),
      }), /sanitized-shadow-result-invalid/);
    }
  });

  it("ships a least-privilege atomic schema without overloading the lease", () => {
    const sql = readFileSync("supabase/migrations/20261112201551_sterling_operational_shadow_results.sql", "utf8");
    assert.match(sql, /create table public\.continuum_sterling_operational_shadow_results/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /revoke all[\s\S]*from public, anon, authenticated, service_role/);
    assert.match(sql, /grant select, insert, delete[\s\S]*to service_role/);
    assert.doesNotMatch(sql, /grant[\s\S]{0,80}update[\s\S]{0,80}operational_shadow_results/i);
    assert.match(sql, /security invoker[\s\S]*set search_path = ''/);
    assert.match(sql, /for update[\s\S]*insert into public\.continuum_sterling_operational_shadow_results[\s\S]*update public\.continuum_sterling_today_run_leases/);
    assert.match(sql, /expires_at <= created_at \+ interval '24 hours'/);
  });
});
