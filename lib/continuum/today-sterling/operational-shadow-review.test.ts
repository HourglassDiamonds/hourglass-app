import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS } from "./operational-reconciliation-scope";

describe("bounded operational shadow review", () => {
  const runtime = readFileSync("lib/continuum/today-sterling/operational-shadow-review.ts", "utf8");
  const runRoute = readFileSync("app/api/continuum/internal/operational-shadow/run/route.ts", "utf8");
  const resultRoute = readFileSync("app/api/continuum/internal/operational-shadow/result/route.ts", "utf8");
  const directivePreflight = readFileSync(
    "lib/continuum/today-sterling/founder-directive-preflight.ts", "utf8");
  const control = readFileSync(
    "app/executive-dashboard/concierge/sterling-today/operational-review/operational-shadow-control.tsx", "utf8");
  const nextConfig = readFileSync("next.config.ts", "utf8");
  const proxy = readFileSync("proxy.ts", "utf8");
  const page = readFileSync("app/executive-dashboard/concierge/sterling-today/operational-review/page.tsx", "utf8");
  const browserE2e = readFileSync("lib/continuum/today-sterling/operational-shadow-browser-e2e.ts", "utf8");
  const browserE2eRuntime = readFileSync(
    "lib/continuum/today-sterling/operational-shadow-browser-e2e-runtime.ts", "utf8");

  it("pins exactly the reviewed 23 threads and accepts no caller-owned scope", () => {
    assert.equal(NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS.length, 23);
    assert.match(runtime, /additionalIndexedThreadIds: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS/);
    assert.match(runtime, /liveRetrievalThreadAllowlist: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS/);
    assert.match(runtime, /forcedLiveThreadIds: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS/);
    assert.match(runtime, /includeUnindexedLiveMessages: true/);
    assert.doesNotMatch(`${runRoute}${resultRoute}`, /formData\.get|searchParams\.get|threadId|mailbox|model/);
  });

  it("fails closed on runtime, founder, mailbox, execution, and lease identity", () => {
    assert.match(runtime, /isVerifiedContinuumProductionStagingRuntime/);
    assert.match(runtime, /isVerifiedContinuumProductionShadowRuntime/);
    assert.match(runtime, /getAuthenticatedGmailHistoryStores/);
    assert.match(runtime, /connection\.mailboxEmailHash !== expectedMailboxHash/);
    assert.match(runtime, /getSterlingOperationalShadowExecutionId/);
    assert.match(runtime, /priorLease/);
    assert.match(runtime, /ALREADY_EXECUTED/);
    assert.match(runtime, /CONTINUUM_GMAIL_RECURRING_SYNC_ENABLED/);
    assert.match(runtime, /CONTINUUM_GMAIL_MANUAL_REFRESH_ENABLED/);
    assert.match(runtime, /CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED/);
    assert.match(runtime, /CONTINUUM_TODAY_MANUAL_RECOMPUTE_ENABLED/);
    assert.match(runtime, /CONTINUUM_STERLING_TODAY_PUBLISHER_ENABLED/);
    assert.match(runtime, /business-persistence-control-enabled/);
    assert.match(page, /export const maxDuration = 300/);
    assert.match(runRoute, /sameOrigin/);
    assert.match(resultRoute, /restoreAuthenticatedOperationalShadowResult/);
    assert.match(resultRoute, /cleanupAuthenticatedOperationalShadowResult/);
    assert.match(resultRoute, /prepareAuthenticatedOperationalShadowFounderDirectives/);
    assert.match(directivePreflight, /matchAuthorizedNovember20FounderDirectiveReadback/);
    assert.match(directivePreflight, /loadSterlingFounderDirectiveNotes/);
    assert.doesNotMatch(directivePreflight, /recordSterlingFounderDirective|createSupabaseClientMemoryNoteWriter/);
    assert.doesNotMatch(directivePreflight, /createSterlingRunLease|executeSterlingTodaySemantic|createLiveSourceViewerBatch/);
    assert.match(control, /disabled=\{pending \|\| !directivesReady\}/);
  });

  it("rewrites only the two browser-facing shadow routes to guarded internal handlers", () => {
    assert.match(nextConfig,
      /source:\s*PRODUCTION_STAGING_OPERATIONAL_SHADOW_RUN_ROUTE,[\s\S]*destination:\s*INTERNAL_OPERATIONAL_SHADOW_RUN_ROUTE/);
    assert.match(nextConfig,
      /source:\s*PRODUCTION_STAGING_OPERATIONAL_SHADOW_RESULT_ROUTE,[\s\S]*destination:\s*INTERNAL_OPERATIONAL_SHADOW_RESULT_ROUTE/);
    assert.match(nextConfig, /beforeFiles/);
    assert.doesNotMatch(nextConfig, /source:\s*["'`]\/executive-dashboard\/.*:\w+\*/);
    assert.match(proxy, /isInternalOperationalShadowPath\(pathname\)/);
    assert.match(proxy, /OPERATIONAL_SHADOW_REWRITE_SOURCE_HEADER/);
    assert.match(proxy, /isOperationalShadowDispatchProbe/);
    assert.match(runRoute, /isOperationalShadowRewriteRequest/);
    assert.match(resultRoute, /isOperationalShadowRewriteRequest/);
    assert.match(runRoute, /sameOrigin/);
    assert.match(runRoute, /runAuthenticatedOperationalShadowReview/);
    assert.match(resultRoute, /restoreAuthenticatedOperationalShadowResult/);
  });

  it("uses the real assembler, model boundary, and comparator without business writers", () => {
    assert.match(runtime, /assembleSterlingTodayShadow/);
    assert.match(runtime, /executeSterlingTodaySemantic/);
    assert.match(runtime, /compareOperationalBoard/);
    assert.doesNotMatch(runtime, /publishAuthenticated|continuum_publish_sterling|canonical-approval-repository/);
    assert.doesNotMatch(runtime, /incremental-sync|history-run|freshness-run|createCandidate|upsert.*association/i);
    assert.match(runtime, /gmailIndexWrites: false/);
    assert.match(runtime, /checkpointWrites: false/);
    assert.match(runtime, /tokenRefreshWrites: false/);
    assert.match(runtime, /persistCompletedOperationalShadowResult/);
    assert.match(runtime, /sourceWatermark: assembly\.requestWorkingSet\.sourceWatermark/);
    assert.doesNotMatch(runtime, /leaseStore\.finish\(lease\.runId, "completed"/);
  });

  it("keeps the production-build browser fixture local and below real handlers", () => {
    assert.match(browserE2eRuntime, /process\.env\.NODE_ENV === "production"/);
    assert.match(browserE2eRuntime, /process\.env\.VERCEL !== "1"/);
    assert.match(browserE2e, /operational-shadow-browser-e2e-runtime/);
    assert.match(runtime, /assembleSterlingTodayShadow/);
    assert.match(runtime, /executeSterlingTodaySemantic/);
    assert.match(runtime, /persistCompletedOperationalShadowResult/);
    assert.match(browserE2e, /nativeThreadMembershipComplete: true/);
    assert.match(browserE2e, /InMemoryOperationalShadowResultStore/);
    assert.doesNotMatch(browserE2e, /NEXT_PUBLIC_|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY/);
  });

  it("reports exact retrieval provenance and excludes correspondence bodies from the result", () => {
    assert.match(runtime, /observedMessageIds/);
    assert.match(runtime, /newerUnindexedMessageIds/);
    assert.match(runtime, /bodyIncompleteMessageIds/);
    assert.match(runtime, /retrievedAt/);
    assert.match(runtime, /outstandingObligations/);
    assert.match(runtime, /rememberedObligations/);
    assert.match(runtime, /description: obligation\.description\.trim\(\)/);
    assert.match(runtime, /checkBackAt/);
    const resultBlock = runtime.slice(runtime.indexOf("const threadEvidence"));
    assert.doesNotMatch(resultBlock, /plainText|snippet|operationalText|verifiedCurrentMessageText/);
  });
});
