import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS } from "./operational-reconciliation-scope";

describe("bounded operational shadow review", () => {
  const runtime = readFileSync("lib/continuum/today-sterling/operational-shadow-review.ts", "utf8");
  const action = readFileSync("app/executive-dashboard/concierge/sterling-today/operational-review/actions.ts", "utf8");
  const page = readFileSync("app/executive-dashboard/concierge/sterling-today/operational-review/page.tsx", "utf8");

  it("pins exactly the reviewed 23 threads and accepts no caller-owned scope", () => {
    assert.equal(NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS.length, 23);
    assert.match(runtime, /additionalIndexedThreadIds: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS/);
    assert.match(runtime, /liveRetrievalThreadAllowlist: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS/);
    assert.match(runtime, /forcedLiveThreadIds: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS/);
    assert.match(runtime, /includeUnindexedLiveMessages: true/);
    assert.match(action, /void _formData/);
    assert.doesNotMatch(action, /formData\.get|threadId|mailbox|model/);
  });

  it("fails closed on runtime, founder, mailbox, execution, and lease identity", () => {
    assert.match(runtime, /isVerifiedContinuumProductionStagingRuntime/);
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
    assert.match(page, /export const maxDuration = 300/);
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
  });

  it("reports exact retrieval provenance and excludes correspondence bodies from the result", () => {
    assert.match(runtime, /observedMessageIds/);
    assert.match(runtime, /newerUnindexedMessageIds/);
    assert.match(runtime, /bodyIncompleteMessageIds/);
    assert.match(runtime, /retrievedAt/);
    const resultBlock = runtime.slice(runtime.indexOf("const threadEvidence"));
    assert.doesNotMatch(resultBlock, /plainText|snippet|operationalText|verifiedCurrentMessageText/);
  });
});
