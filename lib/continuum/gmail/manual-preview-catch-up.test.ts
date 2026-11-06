import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createManualPreviewCatchUp,
  MANUAL_PREVIEW_CATCH_UP_MAX_CHUNKS,
} from "./manual-preview-catch-up";
import {
  INITIAL_MANUAL_PREVIEW_CHUNK_RESULT,
  blockedManualPreviewChunk,
  type ManualPreviewChunkResult,
} from "./manual-preview-chunk";

function recovery(
  indexedCount: number,
  indexedThisChunk = 20,
): ManualPreviewChunkResult {
  return {
    ...INITIAL_MANUAL_PREVIEW_CHUNK_RESULT,
    status: "recovering",
    checkpointStatus: "running",
    indexedCount,
    indexedThisChunk,
    morePagesRemain: true,
    recovery: true,
    historyIdPresent: true,
    safeErrorCode: "history-too-old",
  };
}

function completed(indexedCount: number): ManualPreviewChunkResult {
  return {
    ...INITIAL_MANUAL_PREVIEW_CHUNK_RESULT,
    status: "completed",
    checkpointStatus: "completed",
    indexedCount,
    morePagesRemain: false,
    recovery: true,
    completed: true,
    historyIdPresent: true,
    safeErrorCode: null,
  };
}

describe("founder-controlled Preview Gmail catch-up", () => {
  it("does not start on construction or remount", async () => {
    let calls = 0;
    const first = createManualPreviewCatchUp({
      initial: recovery(42, 0),
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        return recovery(62);
      },
    });
    first.cancel();
    const remounted = createManualPreviewCatchUp({
      initial: recovery(42, 0),
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        return recovery(62);
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(calls, 0);
    assert.equal(remounted.isActive(), false);
  });

  it("runs sequential one-page calls and stops on completion", async () => {
    let calls = 0;
    let inFlight = 0;
    let maxInFlight = 0;
    const continuation = createManualPreviewCatchUp({
      initial: recovery(42, 0),
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return calls === 3 ? completed(82) : recovery(42 + calls * 20);
      },
    });
    const done = await continuation.start();
    assert.equal(calls, 3);
    assert.equal(maxInFlight, 1);
    assert.equal(done.stopReason, "completed");
    assert.equal(done.chunksCompleted, 3);
    assert.equal(done.messagesIndexedThisSession, 40);
    assert.equal(done.result.indexedCount, 82);
  });

  it("stops after the current chunk when requested", async () => {
    let calls = 0;
    const continuation = createManualPreviewCatchUp({
      initial: recovery(42, 0),
      delayMs: 5,
      runChunk: async () => {
        calls += 1;
        return recovery(42 + calls * 20);
      },
    });
    const done = await continuation.start((state) => {
      if (state.chunksCompleted === 1) continuation.requestStopAfterCurrent();
    });
    assert.equal(calls, 1);
    assert.equal(done.stopReason, "stopped");
    assert.equal(done.paused, true);
    assert.equal(done.result.morePagesRemain, true);
  });

  it("allows an in-flight chunk to persist, then cancels browser continuation", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const continuation = createManualPreviewCatchUp({
      initial: recovery(42, 0),
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        await gate;
        return recovery(62);
      },
    });
    const started = continuation.start();
    continuation.cancel();
    release();
    const done = await started;
    assert.equal(calls, 1);
    assert.equal(done.stopReason, "cancelled");
    assert.equal(done.result.indexedCount, 62);
    assert.equal(done.chunksCompleted, 1);
  });

  it("stops without retry on provider, authentication, lease, and action failures", async (t) => {
    const cases: Array<{
      name: string;
      result?: ManualPreviewChunkResult;
      throws?: boolean;
      reason: string;
      code: string | null;
    }> = [
      {
        name: "provider error",
        result: {
          ...INITIAL_MANUAL_PREVIEW_CHUNK_RESULT,
          status: "failed",
          checkpointStatus: "failed",
          safeErrorCode: "token-refresh-failed",
        },
        reason: "failed",
        code: "token-refresh-failed",
      },
      {
        name: "founder authentication failure",
        result: blockedManualPreviewChunk("unauthorized"),
        reason: "blocked",
        code: null,
      },
      {
        name: "lease conflict",
        result: {
          ...INITIAL_MANUAL_PREVIEW_CHUNK_RESULT,
          status: "failed",
          checkpointStatus: "running",
          morePagesRemain: true,
          safeErrorCode: "gmail-sync-already-running",
        },
        reason: "failed",
        code: "gmail-sync-already-running",
      },
      {
        name: "server action rejection",
        throws: true,
        reason: "blocked",
        code: null,
      },
    ];
    for (const row of cases) {
      await t.test(row.name, async () => {
        let calls = 0;
        const continuation = createManualPreviewCatchUp({
          initial: recovery(42, 0),
          delayMs: 0,
          runChunk: async () => {
            calls += 1;
            if (row.throws) throw new Error("network-failed");
            return row.result!;
          },
        });
        const done = await continuation.start();
        assert.equal(calls, 1);
        assert.equal(done.stopReason, row.reason);
        assert.equal(done.result.safeErrorCode, row.code);
      });
    }
  });

  it("enforces exactly 25 attempts and requires a new click for another session", async () => {
    let calls = 0;
    const continuation = createManualPreviewCatchUp({
      initial: recovery(42, 0),
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        return recovery(42 + calls * 20);
      },
    });
    const first = await continuation.start();
    assert.equal(MANUAL_PREVIEW_CATCH_UP_MAX_CHUNKS, 25);
    assert.equal(calls, 25);
    assert.equal(first.attemptsThisSession, 25);
    assert.equal(first.chunksCompleted, 25);
    assert.equal(first.messagesIndexedThisSession, 500);
    assert.equal(first.stopReason, "limit-reached");

    const second = await continuation.start((state) => {
      if (state.chunksCompleted === 1) continuation.requestStopAfterCurrent();
    });
    assert.equal(calls, 26);
    assert.equal(second.chunksCompleted, 1);
    assert.equal(second.stopReason, "stopped");
  });

  it("resumes from a durable checkpoint after refresh without client cursor input", async () => {
    let durableCount = 62;
    const args: unknown[][] = [];
    const refreshed = createManualPreviewCatchUp({
      initial: recovery(durableCount, 0),
      delayMs: 0,
      runChunk: async (...received: unknown[]) => {
        args.push(received);
        durableCount += 20;
        return completed(durableCount);
      },
    });
    const done = await refreshed.start();
    assert.deepEqual(args, [[]]);
    assert.equal(done.result.indexedCount, 82);
    assert.equal(done.stopReason, "completed");
  });
});
