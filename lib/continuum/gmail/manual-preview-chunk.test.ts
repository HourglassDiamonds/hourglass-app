import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  executeOneManualPreviewChunk,
  isBetaRecoveryPreviewRuntime,
  MANUAL_PREVIEW_GMAIL_MAX_GETS_PER_SEC,
  MANUAL_PREVIEW_GMAIL_MAX_RETRIES,
  MANUAL_PREVIEW_GMAIL_MAX_RETRY_DELAY_MS,
  MANUAL_PREVIEW_GMAIL_RETRY_JITTER_RATIO,
  manualPreviewSnapshotFromIncremental,
} from "./manual-preview-chunk";
import type { GmailIncrementalChunkResult } from "./incremental";

const ROOT = process.cwd();

function chunk(
  extra: Partial<GmailIncrementalChunkResult> = {},
): GmailIncrementalChunkResult {
  return {
    chunkSucceeded: true,
    checkpointStatus: "running",
    indexedCount: 2,
    indexedThisChunk: 1,
    deletedThisChunk: 0,
    labelUpdatesThisChunk: 0,
    attachmentsThisChunk: 0,
    morePagesRemain: true,
    completed: false,
    initialized: false,
    recovery: false,
    historyIdPresent: true,
    safeErrorCode: null,
    ...extra,
  };
}

describe("one-time Beta Recovery Gmail chunk", () => {
  it("fails closed in Production, adjacent Preview, and any other branch", () => {
    const base = {
      vercel: "1",
      vercelEnv: "preview",
      continuumEnv: "preview",
      gitBranch: "codex/continuum-beta-recovery",
      isolationState: "preview-isolated",
    };
    assert.equal(isBetaRecoveryPreviewRuntime(base), true);
    assert.equal(
      isBetaRecoveryPreviewRuntime({ ...base, vercelEnv: "production" }),
      false,
    );
    assert.equal(
      isBetaRecoveryPreviewRuntime({ ...base, continuumEnv: "production" }),
      false,
    );
    assert.equal(
      isBetaRecoveryPreviewRuntime({ ...base, isolationState: "preview-adjacent" }),
      false,
    );
    assert.equal(isBetaRecoveryPreviewRuntime({ ...base, gitBranch: "main" }), false);
  });

  it("does not invoke the provider runner for an unauthenticated founder", async () => {
    let calls = 0;
    const result = await executeOneManualPreviewChunk({
      founderAuthenticated: false,
      betaRecoveryPreviewVerified: true,
      runChunk: async () => {
        calls += 1;
        return chunk();
      },
    });
    assert.equal(calls, 0);
    assert.equal(result.status, "blocked");
    assert.equal(result.blockedReason, "unauthorized");
  });

  it("invokes no more than one bounded chunk per explicit action", async () => {
    let calls = 0;
    const result = await executeOneManualPreviewChunk({
      founderAuthenticated: true,
      betaRecoveryPreviewVerified: true,
      runChunk: async () => {
        calls += 1;
        return chunk();
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.status, "progressed");
    assert.equal(result.morePagesRemain, true);
  });

  it("resumes only through a second explicit action and preserves checkpoint progress", async () => {
    let durableIndexedCount = 0;
    const runChunk = async () => {
      durableIndexedCount += 1;
      return chunk(
        durableIndexedCount === 1
          ? {}
          : {
              checkpointStatus: "completed",
              indexedCount: durableIndexedCount,
              morePagesRemain: false,
              completed: true,
            },
      );
    };
    const first = await executeOneManualPreviewChunk({
      founderAuthenticated: true,
      betaRecoveryPreviewVerified: true,
      runChunk,
    });
    assert.equal(first.status, "progressed");
    assert.equal(durableIndexedCount, 1);
    const second = await executeOneManualPreviewChunk({
      founderAuthenticated: true,
      betaRecoveryPreviewVerified: true,
      runChunk,
    });
    assert.equal(second.status, "completed");
    assert.equal(durableIndexedCount, 2);
  });

  it("never presents a provider failure as successful", async () => {
    const result = await executeOneManualPreviewChunk({
      founderAuthenticated: true,
      betaRecoveryPreviewVerified: true,
      runChunk: async () =>
        chunk({
          chunkSucceeded: false,
          checkpointStatus: "failed",
          morePagesRemain: false,
          safeErrorCode: "token-refresh-failed",
        }),
    });
    assert.equal(result.status, "failed");
    assert.equal(result.completed, false);
    assert.equal(result.safeErrorCode, "token-refresh-failed");
  });

  it("reports persisted history-too-old catch-up as recovery without claiming completion", async () => {
    const result = await executeOneManualPreviewChunk({
      founderAuthenticated: true,
      betaRecoveryPreviewVerified: true,
      runChunk: async () =>
        chunk({
          chunkSucceeded: false,
          checkpointStatus: "running",
          indexedCount: 22,
          indexedThisChunk: 20,
          morePagesRemain: true,
          recovery: true,
          safeErrorCode: "history-too-old",
        }),
    });
    assert.equal(result.status, "recovering");
    assert.equal(result.indexedThisChunk, 20);
    assert.equal(result.indexedCount, 22);
    assert.equal(result.morePagesRemain, true);
    assert.equal(result.recovery, true);
    assert.equal(result.completed, false);
    assert.equal(result.safeErrorCode, "history-too-old");
  });

  it("does not treat recovery as complete until the checkpoint clears its error", async () => {
    const result = await executeOneManualPreviewChunk({
      founderAuthenticated: true,
      betaRecoveryPreviewVerified: true,
      runChunk: async () =>
        chunk({
          checkpointStatus: "completed",
          morePagesRemain: false,
          completed: true,
          recovery: true,
          safeErrorCode: "history-too-old",
        }),
    });
    assert.equal(result.status, "failed");
    assert.equal(result.completed, false);
  });

  it("restores visible recovery state from the durable checkpoint after refresh", () => {
    const result = manualPreviewSnapshotFromIncremental(
      chunk({
        chunkSucceeded: true,
        checkpointStatus: "running",
        indexedCount: 42,
        indexedThisChunk: 0,
        morePagesRemain: true,
        recovery: true,
        safeErrorCode: "history-too-old",
      }),
    );
    assert.equal(result.status, "recovering");
    assert.equal(result.indexedCount, 42);
    assert.equal(result.morePagesRemain, true);
    assert.equal(result.completed, false);
  });

  it("keeps recurring sync kill-switched and the manual surface free of client/Sterling writes", () => {
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail-incremental-actions.ts"),
      "utf8",
    );
    const manualUi = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/gmail-manual-preview-chunk.tsx",
      ),
      "utf8",
    );
    const cron = readFileSync(
      join(ROOT, "app/api/cron/continuum-gmail-freshness/route.ts"),
      "utf8",
    );
    const freshness = readFileSync(
      join(ROOT, "lib/continuum/gmail/freshness-run.ts"),
      "utf8",
    );
    const incremental = readFileSync(
      join(ROOT, "lib/continuum/gmail/incremental.ts"),
      "utf8",
    );
    const gmailPage = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail/page.tsx"),
      "utf8",
    );
    assert.equal(MANUAL_PREVIEW_GMAIL_MAX_GETS_PER_SEC, 0.8);
    assert.equal(MANUAL_PREVIEW_GMAIL_MAX_RETRIES, 3);
    assert.equal(MANUAL_PREVIEW_GMAIL_RETRY_JITTER_RATIO, 0.25);
    assert.equal(MANUAL_PREVIEW_GMAIL_MAX_RETRY_DELAY_MS, 10_000);
    assert.match(actions, /maxGetsPerSec: MANUAL_PREVIEW_GMAIL_MAX_GETS_PER_SEC/);
    assert.match(actions, /maxRetries: MANUAL_PREVIEW_GMAIL_MAX_RETRIES/);
    assert.match(actions, /retryJitterRatio: MANUAL_PREVIEW_GMAIL_RETRY_JITTER_RATIO/);
    assert.match(actions, /maxRetryDelayMs: MANUAL_PREVIEW_GMAIL_MAX_RETRY_DELAY_MS/);
    assert.match(gmailPage, /export const maxDuration = 120/);
    assert.match(actions, /export async function runNextGmailIncrementalChunk/);
    assert.match(actions, /isGmailIncrementalSyncEnabled/);
    assert.match(freshness, /isGmailIncrementalSyncEnabled/);
    assert.match(cron, /executeLiveGmailFreshnessCycle/);
    assert.match(actions, /runGmailIncrementalChunk/);
    assert.match(incremental, /tryClaimIncrementalChunk/);
    assert.match(manualUi, /Start Gmail Catch-Up/);
    assert.match(manualUi, /Stop after current chunk/);
    assert.match(manualUi, /createManualPreviewCatchUp/);
    const effect = manualUi.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[initial\]\);/)?.[0] ?? "";
    assert.match(effect, /continuation\.cancel\(\)/);
    assert.doesNotMatch(effect, /continuation\.start\(/);
    for (const source of [actions, manualUi]) {
      assert.doesNotMatch(source, /continuum_open_jobs|continuum_projects|createPersonAtomic/);
      assert.doesNotMatch(source, /CandidateStore|createSupabaseCandidateStore|runGmailNewProjectIntakeScan/);
      assert.doesNotMatch(source, /createSterling|publishSterling|publisher-projection/);
      assert.doesNotMatch(source, /sendMessage|modify|trash|label/);
    }
  });
});
