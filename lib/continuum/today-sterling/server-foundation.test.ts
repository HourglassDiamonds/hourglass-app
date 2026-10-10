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
import { InMemorySterlingRunLeaseStore, createSterlingRunLease } from "./run-lease";

const ROOT = process.cwd();
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
      "audrey", "lucasResolved", "justinIntake", "jenniferActionability"]) assert.equal(keys.has(key), true);
    assert.equal(scopeMatchesText(scopeDefinition("audrey")!, "CAD C026401"), true);
    assert.equal(scopeMatchesText(scopeDefinition("audrey")!, "Audreyy"), false);
    assert.equal(scopeMatchesIdentifierText(scopeDefinition("audrey")!, "Audrey"), false);
    assert.equal(scopeMatchesIdentifierText(scopeDefinition("audrey")!, "CAD C026401"), true);
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
  it("rejects a concurrent run and permits a run after expiration", async () => {
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
    assert.match(source, /scopeMatchesIdentifierText/);
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
    const page = read("app/executive-dashboard/concierge/sterling-today/page.tsx");
    const control = read("app/executive-dashboard/concierge/components/sterling-today-shadow-control.tsx");
    assert.match(action, /^"use server";/);
    assert.match(action, /getAuthenticatedGmailHistoryStores/);
    assert.doesNotMatch(action, /threadId|projectId|targetCase|request\.json/);
    assert.match(control, /<form action=\{assemblyAction\}/);
    assert.match(control, /<form action=\{semanticAction\}/);
    assert.doesNotMatch(control, /fetch\(|axios|XMLHttpRequest/);
    assert.match(page, /isSterlingTodaySemanticFeatureEnabled/);
    assert.match(page, /export const maxDuration = 300/);
    assert.equal(existsSync(join(ROOT, "app/api/sterling-today/route.ts")), false);
  });

  it("fails semantic execution closed before evidence assembly", () => {
    const action = read("app/executive-dashboard/concierge/sterling-today-actions.ts");
    const semantic = action.slice(action.indexOf("export async function runSterlingTodaySemanticAction"));
    assert.match(semantic, /semantic-feature-disabled/);
    assert.match(semantic, /durable-lease-unavailable/);
    assert.ok(semantic.indexOf("semantic-feature-disabled") < semantic.indexOf("assembleSterlingTodayShadow"));
    assert.ok(semantic.indexOf("durable-lease-unavailable") < semantic.indexOf("assembleSterlingTodayShadow"));
  });

  it("returns aggregate fields only and contains no sensitive diagnostics", () => {
    const action = read("app/executive-dashboard/concierge/sterling-today-actions.ts");
    const control = read("app/executive-dashboard/concierge/components/sterling-today-shadow-control.tsx");
    for (const source of [action, control]) {
      assert.doesNotMatch(source, /subject|snippet|participants|filename|attachmentFilenames|messageId|accessToken|refreshToken/);
    }
    assert.match(control, /Work units/);
    assert.match(control, /Input tokens/);
    assert.match(control, /Validation errors/);
  });
});
