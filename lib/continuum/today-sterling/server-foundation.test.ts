import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { SourceCommunicationEvent } from "@/lib/continuum/source-events/types";
import {
  STERLING_TODAY_ACCEPTANCE_SCOPE,
  isDurablyScopedFounderCorrection,
  scopeDefinition,
  scopeMatchesIdentifierText,
  scopeMatchesText,
} from "./scope";
import {
  InMemorySterlingRunLeaseStore,
  createSterlingRunLease,
  createSupabaseSterlingRunLeaseStore,
} from "./run-lease";

const ROOT = process.cwd();
const LEASE_MIGRATION = "supabase/migrations/20261011003057_continuum_sterling_today_run_lease.sql";
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

function correction(overrides: Partial<SourceCommunicationEvent> = {}): SourceCommunicationEvent {
  return {
    sourceType: "founder_note",
    sourceRef: "founder-note:11111111-1111-4111-8111-111111111111",
    messageId: "11111111-1111-4111-8111-111111111111",
    threadId: null,
    timestamp: "2026-10-10T12:00:00.000Z",
    direction: "outbound",
    actor: "founder",
    subject: null,
    authorOwnedText: "Lucas Kinnin is resolved.",
    quotedText: "",
    attachmentFilenames: [],
    hasAttachments: false,
    cadIds: [],
    orderIds: [],
    productionJobIds: [],
    personLabel: "Lucas Kinnin",
    projectId: "22222222-2222-4222-8222-222222222222",
    workLoopId: "project:22222222-2222-4222-8222-222222222222",
    semanticClass: "founder_correction",
    evidenceExcerpt: "Lucas Kinnin is resolved.",
    workIdentityBasis: "project",
    provenance: "founder_correction",
    correction: { stage: "complete", ballHolder: "unknown", dependency: null },
    ...overrides,
  };
}

describe("Sterling server-owned acceptance scope", () => {
  it("preserves the original ten and adds Audrey plus correction assertions", () => {
    const keys = new Set<string>(STERLING_TODAY_ACCEPTANCE_SCOPE.map((row) => row.key));
    for (const key of ["abbey", "sarah", "nathan", "alex", "madi", "dylan", "grant", "pennock", "duane", "timJenn",
      "audrey", "zane", "jackie", "jamesReturning", "noiseNewsletter", "noiseSolicitation", "nivodaReturn",
      "lucasResolved", "justinIntake", "jenniferActionability"]) assert.equal(keys.has(key), true);
    assert.equal(scopeMatchesText(scopeDefinition("audrey")!, "CAD C026401"), true);
    assert.equal(scopeMatchesText(scopeDefinition("audrey")!, "Audreyy"), false);
    assert.equal(scopeMatchesIdentifierText(scopeDefinition("audrey")!, "Audrey"), false);
    assert.equal(scopeMatchesIdentifierText(scopeDefinition("audrey")!, "CAD C026401"), true);
    assert.deepEqual(scopeDefinition("zane")?.exactThreadIds,
      ["1a1212396a8ac111", "1a13660ae3fdb7ac", "1a13cc2c1f3d5951"]);
  });

  it("requires durable founder-correction identity rather than a matching name", () => {
    const lucas = scopeDefinition("lucasResolved")!;
    assert.equal(isDurablyScopedFounderCorrection(lucas, correction()), true);
    assert.equal(isDurablyScopedFounderCorrection(lucas, correction({ projectId: null, workLoopId: null, workIdentityBasis: null })), false);
    assert.equal(isDurablyScopedFounderCorrection(lucas, correction({ sourceRef: "gmail:thread-1" })), false);
  });

  it("keeps the Justin/Zane correction unresolved unless both exact terms share a durable correction", () => {
    const definition = scopeDefinition("justinIntake")!;
    const oneName = correction({ personLabel: "Justin Smith", authorOwnedText: "Justin Smith intake removed.", evidenceExcerpt: "Justin Smith intake removed." });
    assert.equal(isDurablyScopedFounderCorrection(definition, oneName), false);
    const both = correction({ personLabel: "Justin Smith", authorOwnedText: "Remove Justin Smith intake; retain Zane Kennedy.",
      evidenceExcerpt: "Remove Justin Smith intake; retain Zane Kennedy." });
    assert.equal(isDurablyScopedFounderCorrection(definition, both), true);
  });
});

describe("Sterling metadata-only run lease contract", () => {
  it("atomically lets only one of two simultaneous acquisitions succeed", async () => {
    const store = new InMemorySterlingRunLeaseStore();
    const now = new Date("2026-10-10T12:00:00Z");
    const first = createSterlingRunLease({ mode: "semantic", scopeVersion: "v1", now });
    const second = createSterlingRunLease({ mode: "semantic", scopeVersion: "v1", now });
    const outcomes = await Promise.all([store.claim(first), store.claim(second)]);
    assert.equal(outcomes.filter((outcome) => outcome === "claimed").length, 1);
    assert.equal(outcomes.filter((outcome) => outcome === "busy").length, 1);
  });

  it("returns busy while active and permits crash recovery after expiration", async () => {
    const store = new InMemorySterlingRunLeaseStore();
    const first = createSterlingRunLease({ mode: "semantic", scopeVersion: "v1", now: new Date("2026-10-10T12:00:00Z") });
    const concurrent = createSterlingRunLease({ mode: "semantic", scopeVersion: "v1", now: new Date("2026-10-10T12:01:00Z") });
    const expired = createSterlingRunLease({ mode: "semantic", scopeVersion: "v1", now: new Date("2026-10-10T12:07:00Z") });
    assert.equal(await store.claim(first), "claimed");
    assert.equal(await store.claim(concurrent), "busy");
    assert.equal(await store.claim(expired), "claimed");
  });

  it("only lets the owning run finish", async () => {
    const store = new InMemorySterlingRunLeaseStore();
    const lease = createSterlingRunLease({ mode: "semantic", scopeVersion: "v1", now: new Date("2026-10-10T12:00:00Z") });
    assert.equal(await store.claim(lease), "claimed");
    assert.equal(await store.finish("00000000-0000-4000-8000-000000000000", "completed", "2026-10-10T12:01:00Z"), false);
    assert.equal(await store.finish(lease.runId, "completed", "2026-10-10T12:01:00Z"), true);
  });

  it("does not let a stale holder release its successor", async () => {
    const store = new InMemorySterlingRunLeaseStore();
    const stale = createSterlingRunLease({ mode: "semantic", scopeVersion: "v1", now: new Date("2026-10-10T12:00:00Z") });
    const successor = createSterlingRunLease({ mode: "semantic", scopeVersion: "v1", now: new Date("2026-10-10T12:07:00Z") });
    assert.equal(await store.claim(stale), "claimed");
    assert.equal(await store.claim(successor), "claimed");
    assert.equal(await store.finish(stale.runId, "completed", "2026-10-10T12:08:00Z"), false);
    assert.equal(await store.finish(successor.runId, "completed", "2026-10-10T12:08:00Z"), true);
  });

  it("makes an exact release replay idempotent without changing terminal state", async () => {
    const store = new InMemorySterlingRunLeaseStore();
    const lease = createSterlingRunLease({ mode: "semantic", scopeVersion: "v1", now: new Date("2026-10-10T12:00:00Z") });
    assert.equal(await store.claim(lease), "claimed");
    assert.equal(await store.finish(lease.runId, "completed", "2026-10-10T12:01:00Z"), true);
    assert.equal(await store.finish(lease.runId, "completed", "2026-10-10T12:02:00Z"), true);
    assert.equal(await store.finish(lease.runId, "failed", "2026-10-10T12:02:00Z"), false);
  });

  it("defines one additive service-role-only metadata lease and atomic RPCs", () => {
    const sql = read(LEASE_MIGRATION);
    assert.match(sql, /create table public\.continuum_sterling_today_run_leases/i);
    assert.match(sql, /check \(lease_key = 'founder-shadow-v1'\)/i);
    assert.match(sql, /on conflict \(lease_key\) do update[\s\S]*expires_at <= clock_timestamp\(\)/i);
    assert.match(sql, /and run_id = p_run_id[\s\S]*and run_state = 'running'/i);
    assert.match(sql, /return coalesce\(current_run_id = p_run_id and current_state = p_run_state, false\)/i);
    assert.match(sql, /security invoker[\s\S]*set search_path = ''/i);
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /revoke all on table[\s\S]*from public, anon, authenticated/i);
    assert.match(sql, /grant select, insert, update on table[\s\S]*to service_role/i);
    assert.match(sql, /revoke all on function public\.continuum_claim_sterling_today_run[\s\S]*from public, anon, authenticated/i);
    assert.match(sql, /grant execute on function public\.continuum_claim_sterling_today_run[\s\S]*to service_role/i);
    assert.match(sql, /revoke all on function public\.continuum_finish_sterling_today_run[\s\S]*from public, anon, authenticated/i);
    assert.match(sql, /grant execute on function public\.continuum_finish_sterling_today_run[\s\S]*to service_role/i);
    assert.doesNotMatch(sql, /create policy|grant delete|grant .* to (?:anon|authenticated)/i);
    assert.doesNotMatch(sql, /continuum_(?:project|person|client|performance|today_snapshot|gmail_)/i);
  });

  it("stores no evidence, prompt, model output, identity, or client content", () => {
    const sql = read(LEASE_MIGRATION);
    const table = sql.slice(sql.indexOf("create table"), sql.indexOf("alter table"));
    assert.doesNotMatch(table, /evidence|gmail|prompt|model_output|subject|message|person|project|client|payload|jsonb/i);
    assert.match(table, /run_id uuid/);
    assert.match(table, /run_digest text/);
    assert.match(table, /idempotency_key text/);
    assert.match(table, /started_at timestamptz/);
    assert.match(table, /expires_at timestamptz/);
  });

  it("fails closed when the lease RPC infrastructure is absent", async () => {
    const client = {
      rpc: async () => ({ data: null, error: { code: "PGRST202" } }),
    };
    const store = createSupabaseSterlingRunLeaseStore(client as never);
    const lease = createSterlingRunLease({ mode: "semantic", scopeVersion: "v1" });
    assert.equal(await store.claim(lease), "unavailable");
    assert.equal(await store.finish(lease.runId, "failed", new Date().toISOString()), false);
  });
});

describe("Sterling server execution boundaries", () => {
  it("keeps the reusable runner free of production writers and approval execution", () => {
    const source = read("lib/continuum/today-sterling/server-runner.ts");
    assert.doesNotMatch(source, /today-snapshot-store|commitComposedLoop|refreshTodayAfterFounderMutation/);
    assert.doesNotMatch(source, /load-writer|SterlingApprovalService|reconcileConditionalHolds/);
    assert.doesNotMatch(source, /gmail\/(?:incremental|history-run|freshness-run)/);
    assert.match(source, /evaluateSterlingEvidenceCompleteness/);
    assert.match(source, /executeSterlingEvidenceGatedRequest/);
    assert.match(source, /validateSterlingTodayProposal/);
    assert.match(source, /selectSterlingPortfolio/);
    assert.match(source, /loadIndexedTodayThreadContext\(portfolio\.candidates/);
    assert.doesNotMatch(source, /acceptanceThreadIds\(\)/);
    assert.doesNotMatch(source, /scopedProjects|scopedCandidates|scopedJobs/);
    assert.doesNotMatch(source, /explicitEvidenceGroups:/);
    assert.doesNotMatch(source, /definitionMatchesStableInput\(definition, person\.displayName\)/);
  });

  it("keeps the CLI as a thin adapter to the shared runner", () => {
    const source = read("scripts/continuum-sterling-today-shadow.ts");
    assert.match(source, /assembleSterlingTodayShadow/);
    assert.match(source, /executeSterlingTodaySemantic/);
    assert.doesNotMatch(source, /loadLiveTodayOperationalFacts|loadFounderCorrectionEvents|buildSterlingTodayWorkingSet/);
  });

  it("requires founder authentication and exposes no public diagnostic route", () => {
    const action = read("app/executive-dashboard/concierge/sterling-today-actions.ts");
    const runtime = read("lib/continuum/today-sterling/action-runtime.ts");
    const page = read("app/executive-dashboard/concierge/sterling-today/page.tsx");
    const control = read("app/executive-dashboard/concierge/components/sterling-today-shadow-control.tsx");
    assert.match(action, /^"use server";/);
    assert.match(runtime, /getAuthenticatedGmailHistoryStores/);
    assert.doesNotMatch(action, /getSupabaseAdmin|SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(action, /threadId|projectId|targetCase|request\.json/);
    assert.match(control, /<form action=\{assemblyAction\}/);
    assert.match(control, /<form action=\{semanticAction\}/);
    assert.doesNotMatch(control, /fetch\(|axios|XMLHttpRequest/);
    assert.match(page, /isSterlingTodaySemanticFeatureEnabled/);
    assert.match(page, /export const maxDuration = 300/);
    assert.equal(existsSync(join(ROOT, "app/api/sterling-today/route.ts")), false);
  });

  it("fails semantic execution closed before evidence assembly", () => {
    const runtime = read("lib/continuum/today-sterling/action-runtime.ts");
    const semantic = runtime.slice(runtime.indexOf("export async function runAuthenticatedSterlingTodaySemantic"));
    assert.match(semantic, /semantic-feature-disabled/);
    assert.match(semantic, /durable-lease-unavailable/);
    assert.ok(semantic.indexOf("semantic-feature-disabled") < semantic.indexOf("assembleSterlingTodayShadow"));
    assert.ok(semantic.indexOf("durable-lease-unavailable") < semantic.indexOf("assembleSterlingTodayShadow"));
    assert.match(semantic, /claim === "unavailable"/);
    assert.ok(semantic.indexOf("claim === \"unavailable\"") < semantic.indexOf("assembleSterlingTodayShadow"));
  });

  it("returns privacy-safe aggregate and opaque per-unit diagnostics", () => {
    const action = read("app/executive-dashboard/concierge/sterling-today-actions.ts");
    const control = read("app/executive-dashboard/concierge/components/sterling-today-shadow-control.tsx");
    for (const source of [action, control]) {
      assert.doesNotMatch(source, /subject|snippet|participants|filename|attachmentFilenames|messageId|accessToken|refreshToken/);
    }
    assert.match(control, /Work units/);
    assert.match(control, /Input tokens/);
    assert.match(control, /Validation errors/);
    assert.match(control, /Per-work-unit evidence coverage/);
    assert.match(control, /Named-case acceptance coverage/);
    assert.match(control, /Not requested — budget exhausted/);
    assert.match(control, /Provider rate-limited/);
    assert.doesNotMatch(control, /threadId|messageId|sourceRef|evidenceRef|excerpt/);
  });
});
