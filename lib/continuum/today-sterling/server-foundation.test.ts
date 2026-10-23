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
import {
  InMemorySarahSemanticAuthorizationStore,
  createSarahSemanticAuthorizationClaim,
  createSupabaseSarahSemanticAuthorizationStore,
} from "./sarah-semantic-authorization";
import { validateSarahSemanticAssembly } from "./sarah-semantic";
import type { SterlingTodayAssembly } from "./server-runner";
import { buildSterlingTodayTargetWorkingSet } from "./target";
import { createSterlingEvidenceHandleMap } from "./evidence-handles";
import type { SterlingTodayWorkingSet } from "./types";

const ROOT = process.cwd();
const LEASE_MIGRATION = "supabase/migrations/20261011003057_continuum_sterling_today_run_lease.sql";
const SARAH_AUTHORIZATION_MIGRATION =
  "supabase/migrations/20261023010612_continuum_sterling_today_sarah_semantic_one_shot.sql";
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
    assert.equal(scopeDefinition("SARAH/C026143")?.key, "sarah");
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

describe("Sterling Sarah one-shot semantic authorization", () => {
  it("atomically permits only one concurrent claim", async () => {
    const store = new InMemorySarahSemanticAuthorizationStore();
    const now = new Date("2026-10-23T01:10:00Z");
    const claims = await Promise.all([
      store.claim(createSarahSemanticAuthorizationClaim(now)),
      store.claim(createSarahSemanticAuthorizationClaim(now)),
    ]);
    assert.equal(claims.filter((value) => value === "acquired").length, 1);
    assert.equal(claims.filter((value) => value === "claimed").length, 1);
  });

  it("rejects every replay after success, failure, or an expired ambiguous claim", async () => {
    for (const terminal of ["completed", "failed"] as const) {
      const store = new InMemorySarahSemanticAuthorizationStore();
      const claim = createSarahSemanticAuthorizationClaim(new Date("2026-10-23T01:10:00Z"));
      assert.equal(await store.claim(claim), "acquired");
      assert.equal(await store.finish(claim.claimId, terminal, "2026-10-23T01:11:00Z"), true);
      assert.equal(await store.claim(createSarahSemanticAuthorizationClaim(new Date("2026-10-23T01:12:00Z"))), terminal);
    }
    const ambiguous = new InMemorySarahSemanticAuthorizationStore();
    assert.equal(await ambiguous.claim(createSarahSemanticAuthorizationClaim(new Date("2026-10-23T01:10:00Z"))), "acquired");
    assert.equal(await ambiguous.claim(createSarahSemanticAuthorizationClaim(new Date("2026-10-23T01:17:00Z"))),
      "outcome_unknown");
  });

  it("fails closed when authorization RPCs are absent", async () => {
    const store = createSupabaseSarahSemanticAuthorizationStore({
      rpc: async () => ({ data: null, error: { code: "PGRST202" } }),
    } as never);
    const claim = createSarahSemanticAuthorizationClaim();
    assert.equal(await store.claim(claim), "unavailable");
    assert.equal(await store.finish(claim.claimId, "failed", new Date().toISOString()), false);
  });

  it("defines one additive, pre-authorized, service-role-only metadata contract", () => {
    const sql = read(SARAH_AUTHORIZATION_MIGRATION);
    assert.match(sql, /^-- One-shot authorization metadata[\s\S]*begin;/i);
    assert.match(sql, /create table public\.continuum_sterling_today_semantic_authorizations/i);
    assert.match(sql, /authorization_state in \('available', 'claimed', 'completed', 'failed', 'outcome_unknown'\)/i);
    assert.match(sql, /and authorization_state = 'available'[\s\S]*and claim_id is null/i);
    assert.match(sql, /return 'acquired'/i);
    assert.match(sql, /current_state = 'claimed' and current_expires_at <= clock_timestamp\(\)[\s\S]*return 'outcome_unknown'/i);
    assert.match(sql, /and claim_id = p_claim_id[\s\S]*and authorization_state = 'claimed'/i);
    assert.match(sql, /security definer[\s\S]*set search_path = ''/i);
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /revoke all on table[\s\S]*from public, anon, authenticated, service_role/i);
    assert.doesNotMatch(sql, /grant (?:select|insert|update|delete|truncate|references|trigger) on table/i);
    assert.doesNotMatch(sql, /create policy|grant .* to (?:anon|authenticated)/i);
    assert.match(sql, /revoke all on function public\.continuum_claim_sterling_today_sarah_semantic[\s\S]*from public, anon, authenticated, service_role/i);
    assert.match(sql, /grant execute on function public\.continuum_claim_sterling_today_sarah_semantic[\s\S]*to service_role/i);
  });

  it("stores no evidence, Gmail identifier, client identity, prompt, or model output", () => {
    const sql = read(SARAH_AUTHORIZATION_MIGRATION);
    const table = sql.slice(sql.indexOf("create table"), sql.indexOf("alter table"));
    assert.doesNotMatch(table, /evidence|gmail|thread|message|subject|person|project|client|prompt|model|payload|jsonb/i);
    assert.match(table, /authorization_digest text/);
    assert.match(table, /claim_id uuid/);
    assert.match(table, /expires_at timestamptz/);
  });

  it("binds the exact reviewed Sarah thread into a temporary canonical package without persisting an association", () => {
    const projectId = "18e9ef2b-5b22-453e-8be8-e54dab0d86b1";
    const threadId = "1a0881b53067a9e6";
    const workUnitId = `project:${projectId}`;
    const canonicalEvidence = {
      evidenceId: `canonical:project:${projectId}`, sourceType: "canonical" as const,
      sourceRef: `continuum:project:${projectId}`, timestamp: "2026-10-01T12:00:00.000Z",
      direction: "unknown" as const, subject: "Sarah / C026143", excerpt: "Canonical project; lifecycle=cad.",
      attachmentFilenames: [], messageId: null, threadId: null, projectIds: [projectId], personIds: [],
      provenance: "canonical_project_read_only",
    };
    const evidence = {
      evidenceId: "gmail:sarah:latest", sourceType: "gmail" as const,
      sourceRef: "gmail:thread:private:message:private", timestamp: "2026-10-21T17:58:38.000Z",
      direction: "inbound" as const, subject: "Mod 9 CAD and STL", excerpt: "Updated Mod 9 STL attached.",
      attachmentFilenames: ["mod9.stl"], messageId: "private", threadId,
      projectIds: [], personIds: [], provenance: "indexed_gmail+live_quote_stripped_current_message",
    };
    const unrelated = { ...evidence, evidenceId: "gmail:unrelated:message", sourceRef: "gmail:thread:other:message:other",
      messageId: "other", threadId: "aaaaaaaaaaaaaaaa", subject: "Unrelated supplier thread" };
    const unit = { workUnitId, kind: "canonical_project" as const, identityBasis: "canonical_project" as const,
      projectId, label: "Sarah", observedIdentifiers: ["C026143"],
      typedIdentifiers: [{ kind: "project" as const, value: "C026143" }], threadIds: [],
      sourceRefs: [canonicalEvidence.sourceRef], evidenceRefs: [canonicalEvidence.evidenceId] };
    const base = {
      contractVersion: "sterling-today-working-set-v3", runId: "run", evidenceSnapshotId: "snapshot",
      sourceWatermark: "watermark", generatedAt: evidence.timestamp, mutationMode: "shadow_read_only",
      people: [], projects: [{ projectId, title: "Sarah / C026143", projectKind: "custom_new_jewelry",
        lifecycleStage: "cad", recordVersion: "v1", people: [], specs: [], openJobIds: [], gmailThreadIds: [] }],
      jobs: [], evidence: [canonicalEvidence, evidence, unrelated], workUnits: [unit, {
        workUnitId: "provisional:ambiguous", kind: "provisional_evidence", identityBasis: "source_thread",
        projectId: null, label: "Ambiguous", observedIdentifiers: [], typedIdentifiers: [],
        threadIds: [unrelated.threadId], sourceRefs: [unrelated.sourceRef], evidenceRefs: [unrelated.evidenceId],
      }], calendarAvailability: { status: "disabled", reason: "fixture" }, calendar: [], previousToday: [],
    } satisfies SterlingTodayWorkingSet;
    const target = buildSterlingTodayTargetWorkingSet(base, workUnitId, {
      reviewedRequiredThreadIds: [threadId],
    });
    assert.deepEqual(base.workUnits[0]?.threadIds, []);
    assert.deepEqual(base.projects[0]?.gmailThreadIds, []);
    assert.deepEqual(target.workUnits[0]?.targetThreadBindings, [{ threadId,
      associationBasis: "server_reviewed_target", persistedCanonicalAssociation: false }]);
    assert.deepEqual(target.evidence.map((row) => row.evidenceId), [canonicalEvidence.evidenceId, evidence.evidenceId]);
    const handles = createSterlingEvidenceHandleMap(target);
    assert.equal(handles.evidenceIdToHandle.has(evidence.evidenceId), true);
    assert.equal(handles.evidenceIdToHandle.has(unrelated.evidenceId), false);
    const assembly = {
      target: { caseId: "SARAH/C026143", selectedWorkUnitId: workUnitId, relatedWorkUnitIds: [workUnitId] },
      targetBlockedReason: null,
      targetDiagnostics: { selectedWorkUnitId: workUnitId, secondaryWorkUnitIds: ["ambiguous"],
        requiredThreadCount: 1, scheduledThreadCount: 1, successfullyLiveRetrievedThreadCount: 1,
        missingOrFailedThreadCount: 0, providerFailedThreadCount: 0, budgetDeferredThreadCount: 0,
        requiredIndexedMessageCount: 1, successfullyLiveRetrievedMessageCount: 1,
        includedEvidenceMessageCount: 1, excludedOrAmbiguousAssociationCount: 1, stoppedAtStage: null,
        latestVerifiedSourceAt: evidence.timestamp, complete: true },
      workingSet: base,
      requestWorkingSet: target,
    } as unknown as SterlingTodayAssembly;
    assert.deepEqual(validateSarahSemanticAssembly(assembly), { ok: true });
    assert.deepEqual(validateSarahSemanticAssembly({ ...assembly, targetDiagnostics: {
      ...assembly.targetDiagnostics!, successfullyLiveRetrievedThreadCount: 0, missingOrFailedThreadCount: 1,
      complete: false, stoppedAtStage: "target-thread-live-retrieval-incomplete",
    } }), { ok: false, reason: "target-thread-live-retrieval-incomplete" });
    assert.deepEqual(validateSarahSemanticAssembly({ ...assembly,
      requestWorkingSet: { ...assembly.requestWorkingSet, evidence: [evidence, unrelated] },
    }), { ok: false, reason: "target-package-cross-unit-evidence" });
    assert.deepEqual(validateSarahSemanticAssembly({ ...assembly, targetDiagnostics: {
      ...assembly.targetDiagnostics!, includedEvidenceMessageCount: 2,
    } }), { ok: false, reason: "target-chronology-incomplete" });
    assert.deepEqual(validateSarahSemanticAssembly({ ...assembly,
      requestWorkingSet: { ...target, evidence: target.evidence.map((row) => row.sourceType === "gmail"
        ? { ...row, excerpt: "x".repeat(70_000) } : row) },
    }), { ok: false, reason: "target-package-oversized" });
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
    assert.match(control, /<form action=\{sarahAssemblyAction\}/);
    assert.match(control, /Run Sarah Evidence Assembly/);
    assert.match(control, /<form action=\{semanticAction\}/);
    assert.doesNotMatch(control, /fetch\(|axios|XMLHttpRequest/);
    assert.match(page, /isSterlingTodaySemanticFeatureEnabled/);
    assert.match(page, /export const maxDuration = 300/);
    assert.equal(existsSync(join(ROOT, "app/api/sterling-today/route.ts")), false);
  });

  it("keeps Sarah as a fixed authenticated target with no caller-owned scope", () => {
    const action = read("app/executive-dashboard/concierge/sterling-today-actions.ts");
    const runtime = read("lib/continuum/today-sterling/action-runtime.ts");
    const control = read("app/executive-dashboard/concierge/components/sterling-today-shadow-control.tsx");
    const sarahAction = action.slice(action.indexOf("export async function runSterlingTodaySarahAssemblyAction"),
      action.indexOf("export async function runSterlingTodaySemanticAction"));
    const sarahRuntime = runtime.slice(runtime.indexOf("export async function runAuthenticatedSterlingTodaySarahAssembly"),
      runtime.indexOf("export async function runAuthenticatedSterlingTodaySarahSemantic"));
    assert.match(sarahAction, /void _formData/);
    assert.match(sarahAction, /runAuthenticatedSterlingTodaySarahAssembly\(\)/);
    assert.doesNotMatch(sarahAction, /\.get\(|Object\.fromEntries|threadId|projectId|targetCase/);
    assert.match(runtime, /const client = await authenticatedReadClient\(\)/);
    assert.match(sarahRuntime, /STERLING_TODAY_SARAH_TARGET/);
    assert.doesNotMatch(sarahRuntime, /executeSterlingTodaySemantic|getConciergeOpenAiApiKey/);
    const sarahForm = control.slice(control.indexOf("<form action={sarahAssemblyAction}"),
      control.indexOf("</form>", control.indexOf("<form action={sarahAssemblyAction}")));
    assert.doesNotMatch(sarahForm, /<input|<select|<textarea|name=/);
    assert.match(control, /disabled=\{executionPending\}/);
  });

  it("exposes a separately gated, fixed Sarah semantic action without enabling general semantics", () => {
    const action = read("app/executive-dashboard/concierge/sterling-today-actions.ts");
    const runtime = read("lib/continuum/today-sterling/action-runtime.ts");
    const config = read("lib/continuum/today-sterling/server-config.ts");
    const control = read("app/executive-dashboard/concierge/components/sterling-today-shadow-control.tsx");
    const sarahAction = action.slice(action.indexOf("export async function runSterlingTodaySarahSemanticAction"),
      action.indexOf("export async function runSterlingTodaySemanticAction"));
    const sarahRuntime = runtime.slice(runtime.indexOf("export async function runAuthenticatedSterlingTodaySarahSemantic"),
      runtime.indexOf("export async function runAuthenticatedSterlingTodaySemantic"));
    assert.match(config, /CONTINUUM_STERLING_TODAY_SARAH_SEMANTIC_ENABLED/);
    assert.match(sarahAction, /void _formData/);
    assert.match(sarahAction, /runAuthenticatedSterlingTodaySarahSemantic\(\)/);
    assert.doesNotMatch(sarahAction, /\.get\(|Object\.fromEntries|threadId|projectId|targetCase/);
    assert.match(sarahRuntime, /isSterlingTodaySarahSemanticFeatureEnabled/);
    assert.match(sarahRuntime, /targetCase: STERLING_TODAY_SARAH_TARGET/);
    assert.match(sarahRuntime, /validateSarahSemanticAssembly/);
    assert.match(sarahRuntime, /model: CONCIERGE_FOREGROUND_MODEL/);
    assert.match(sarahRuntime, /maxOutputTokens: STERLING_TODAY_SARAH_MAX_OUTPUT_TOKENS/);
    assert.match(sarahRuntime, /maxRequestBytes: STERLING_TODAY_SARAH_MAX_REQUEST_BYTES/);
    assert.doesNotMatch(sarahRuntime, /isSterlingTodaySemanticFeatureEnabled|isSterlingTodayDurableLeaseAvailable/);
    assert.match(control, /Run Sarah Semantic Shadow Once/);
    const semanticForm = control.slice(control.indexOf("<form action={sarahSemanticAction}"),
      control.indexOf("</form>", control.indexOf("<form action={sarahSemanticAction}")));
    assert.doesNotMatch(semanticForm, /<input|<select|<textarea|name=/);
  });

  it("blocks an unsafe fixed target before the Gmail loader and never expands it from secondary matches", () => {
    const runner = read("lib/continuum/today-sterling/server-runner.ts");
    assert.match(runner, /preliminaryTargetResolution\?\.blockedReason \? indexed\s*: await loadLiveTodayOperationalFacts/);
    assert.match(runner, /targetThreadIdsForPlanning = preliminaryTargetResolution/);
    assert.doesNotMatch(runner, /targetUnitsForPlanning\.flatMap\(\(unit\) => unit\.threadIds\)/);
    assert.match(runner, /threadIds: execution\.scheduledThreadIds/);
    assert.match(runner, /preserveThreadOrder: true/);
    assert.doesNotMatch(runner, /\[\.\.\.plan\.liveRequestThreadIds, \.\.\.plan\.budgetDeferredThreadIds\]/);
    assert.match(runner, /target-required-evidence-exceeds-budget/);
    assert.match(runner, /target-required-evidence-missing/);
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
    assert.doesNotMatch(semantic, /assembly_planning_only|createSupabaseSterlingThreadVerificationStore/);
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
    assert.match(control, /Retrieval continuity/);
    assert.match(control, /Verification reused/);
    assert.match(control, /Verification expired/);
    assert.match(control, /Verification invalidated/);
    assert.match(control, /never substitutes for semantic source evidence/);
    assert.doesNotMatch(control, /threadId|messageId|sourceRef|evidenceRef|excerpt/);
  });
});
