import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { GmailHistoryChunkResult } from "./history";
import {
  GMAIL_HISTORY_CONTINUE_DELAY_MS,
  createGmailHistoryContinuation,
  shouldRunNextGmailHistoryChunk,
} from "./history-continue";
import { GMAIL_HISTORY_CHUNK_MAX_PAGES } from "./history";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function chunk(overrides: Partial<GmailHistoryChunkResult> = {}): GmailHistoryChunkResult {
  return {
    chunkSucceeded: true,
    checkpointStatus: "running",
    indexedCount: 100,
    indexedThisChunk: 100,
    attachmentsThisChunk: 0,
    morePagesRemain: true,
    completed: false,
    windowStart: "2024-08-28",
    windowEnd: "2026-08-28",
    safeErrorCode: null,
    ...overrides,
  };
}

const idle = chunk({
  chunkSucceeded: false,
  checkpointStatus: "idle",
  indexedCount: 0,
  indexedThisChunk: 0,
  morePagesRemain: false,
  windowStart: null,
  windowEnd: null,
});

describe("Gmail history automatic continuation", () => {
  it("hard-codes delay and does not take caller q/window/pageToken/maxPages", () => {
    const continueSource = readFileSync(join(ROOT, "lib/continuum/gmail/history-continue.ts"), "utf8");
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail-history-actions.ts"),
      "utf8",
    );
    const ui = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/gmail-history.tsx"),
      "utf8",
    );
    assert.equal(GMAIL_HISTORY_CONTINUE_DELAY_MS, 1000);
    assert.equal(GMAIL_HISTORY_CHUNK_MAX_PAGES, 1);
    assert.match(continueSource, /runChunk\(\)/);
    assert.doesNotMatch(continueSource, /\bmaxPages\b|\bpageToken\b|\bwindowStart\b|historicalGmailQuery/);
    assert.match(actions, /export async function runNextGmailHistoryChunk\(\)/);
    assert.doesNotMatch(actions, /formData\.get\(/);
    assert.doesNotMatch(actions, /maxPages|pageSize|windowStart|pageToken|historicalGmailQuery/);
    assert.doesNotMatch(ui, /pageToken|maxPages|historicalGmailQuery|mailboxEmailHash/);
    assert.match(ui, /Finish backfill/);
    assert.match(ui, /Stop after current chunk/);
  });

  it("runs sequential chunks from one start until complete", async () => {
    const calls: number[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const pages = [
      chunk({ indexedCount: 100, indexedThisChunk: 100, morePagesRemain: true }),
      chunk({ indexedCount: 200, indexedThisChunk: 100, morePagesRemain: true }),
      chunk({
        indexedCount: 250,
        indexedThisChunk: 50,
        morePagesRemain: false,
        completed: true,
        checkpointStatus: "completed",
      }),
    ];
    const continuation = createGmailHistoryContinuation({
      initial: idle,
      delayMs: 0,
      runChunk: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        const index = calls.length;
        calls.push(index);
        await Promise.resolve();
        inFlight -= 1;
        return pages[index]!;
      },
    });
    const done = await continuation.start();
    assert.deepEqual(calls, [0, 1, 2]);
    assert.equal(maxInFlight, 1);
    assert.equal(done.chunksThisSession, 3);
    assert.equal(done.result.completed, true);
    assert.equal(done.result.indexedCount, 250);
    assert.equal(done.stopReason, "completed");
    assert.equal(done.autoRunning, false);
  });

  it("does not start the next chunk until the prior chunk succeeds", async () => {
    const order: string[] = [];
    const continuation = createGmailHistoryContinuation({
      initial: idle,
      delayMs: 0,
      runChunk: async () => {
        order.push("start");
        await Promise.resolve();
        order.push("end");
        const finished = order.filter((item) => item === "end").length >= 2;
        return chunk({
          indexedCount: finished ? 200 : 100,
          morePagesRemain: !finished,
          completed: finished,
          checkpointStatus: finished ? "completed" : "running",
        });
      },
    });
    await continuation.start();
    assert.deepEqual(order, ["start", "end", "start", "end"]);
  });

  it("stops automatic continuation after a failed chunk", async () => {
    let calls = 0;
    const continuation = createGmailHistoryContinuation({
      initial: idle,
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        if (calls === 1) return chunk({ indexedCount: 100 });
        return chunk({
          chunkSucceeded: false,
          checkpointStatus: "failed",
          indexedCount: 100,
          indexedThisChunk: 0,
          morePagesRemain: true,
          safeErrorCode: "invalid_grant",
        });
      },
    });
    const done = await continuation.start();
    assert.equal(calls, 2);
    assert.equal(done.stopReason, "failed");
    assert.equal(done.result.safeErrorCode, "invalid_grant");
    assert.equal(done.chunksThisSession, 1);
    assert.equal(
      shouldRunNextGmailHistoryChunk({
        result: done.result,
        autoContinue: true,
        stopAfterCurrent: false,
        cancelled: false,
      }),
      false,
    );
  });

  it("does not start another chunk after completed", async () => {
    let calls = 0;
    const continuation = createGmailHistoryContinuation({
      initial: idle,
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        return chunk({
          indexedCount: 100,
          morePagesRemain: false,
          completed: true,
          checkpointStatus: "completed",
        });
      },
    });
    await continuation.start();
    assert.equal(calls, 1);
  });

  it("stops after the current chunk when requested", async () => {
    let calls = 0;
    const continuation = createGmailHistoryContinuation({
      initial: idle,
      delayMs: 5,
      runChunk: async () => {
        calls += 1;
        return chunk({ indexedCount: calls * 100, indexedThisChunk: 100 });
      },
    });
    const started = continuation.start((state) => {
      if (state.chunksThisSession === 1) continuation.requestStopAfterCurrent();
    });
    const done = await started;
    assert.equal(calls, 1);
    assert.equal(done.stopReason, "stopped");
    assert.equal(done.paused, true);
    assert.equal(done.result.morePagesRemain, true);
    assert.equal(done.result.completed, false);
  });

  it("does not start a future chunk after browser cancellation", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const continuation = createGmailHistoryContinuation({
      initial: idle,
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        if (calls === 1) await gate;
        return chunk({ indexedCount: calls * 100 });
      },
    });
    const started = continuation.start();
    continuation.cancel();
    release();
    const done = await started;
    assert.equal(calls, 1);
    assert.equal(done.stopReason, "cancelled");
    assert.equal(done.paused, true);
  });

  it("protects double-start so exactly one chunk is in flight", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let inFlight = 0;
    let maxInFlight = 0;
    let calls = 0;
    const continuation = createGmailHistoryContinuation({
      initial: idle,
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await gate;
        inFlight -= 1;
        return chunk({
          indexedCount: 100,
          morePagesRemain: false,
          completed: true,
          checkpointStatus: "completed",
        });
      },
    });
    const first = continuation.start();
    const second = await continuation.start();
    assert.equal(second.stopReason, "already-in-flight");
    assert.equal(continuation.isActive(), true);
    release();
    const done = await first;
    assert.equal(calls, 1);
    assert.equal(maxInFlight, 1);
    assert.equal(done.result.completed, true);
  });

  it("resumes from checkpoint-shaped results and never supplies a local page token", async () => {
    const args: unknown[] = [];
    const runChunk = async (...received: unknown[]) => {
      args.push(received);
      return chunk({
        indexedCount: 200,
        morePagesRemain: false,
        completed: true,
        checkpointStatus: "completed",
        windowStart: "2024-08-28",
        windowEnd: "2026-08-28",
      });
    };
    const continuation = createGmailHistoryContinuation({
      initial: chunk({ indexedCount: 100, morePagesRemain: true }),
      delayMs: 0,
      runChunk,
    });
    const done = await continuation.start();
    assert.deepEqual(args, [[]]);
    assert.equal(runChunk.length, 0);
    assert.equal(done.result.windowStart, "2024-08-28");
    assert.equal(done.result.windowEnd, "2026-08-28");
  });

  it("fails closed on a concurrent already-running chunk without starting another", async () => {
    let calls = 0;
    const continuation = createGmailHistoryContinuation({
      initial: chunk({ indexedCount: 100, morePagesRemain: true }),
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        return chunk({
          chunkSucceeded: false,
          checkpointStatus: "running",
          indexedCount: 100,
          indexedThisChunk: 0,
          morePagesRemain: true,
          safeErrorCode: "gmail-sync-already-running",
        });
      },
    });
    const done = await continuation.start();
    assert.equal(calls, 1);
    assert.equal(done.stopReason, "failed");
    assert.equal(done.result.safeErrorCode, "gmail-sync-already-running");
  });

  it("does not render Gmail content or write Person/Project/CoS paths", () => {
    const continueSource = readFileSync(join(ROOT, "lib/continuum/gmail/history-continue.ts"), "utf8");
    const ui = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/gmail-history.tsx"),
      "utf8",
    );
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail-history-actions.ts"),
      "utf8",
    );
    for (const source of [continueSource, ui, actions]) {
      assert.doesNotMatch(source, /continuum_person_profiles|createPersonAtomic/);
      assert.doesNotMatch(source, /continuum_attention_items|continuum_human_sources/);
      assert.doesNotMatch(source, /correctProjectSpec|correctProjectKind|insertSourceNote/);
      assert.doesNotMatch(source, /attachments\.get|\/messages\/[^?\s"'`]+\/attachments\//);
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
    }
    assert.doesNotMatch(ui, /mailboxEmailHash|ciphertext|subject|snippet|messageId|threadId|filename/);
    assert.match(ui, /runNextGmailHistoryChunk\(\)/);
    assert.doesNotMatch(ui, /Promise\.all/);
  });
});
