import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { GmailIncrementalChunkResult } from "./incremental";
import {
  GMAIL_INCREMENTAL_CONTINUE_DELAY_MS,
  createGmailIncrementalContinuation,
  shouldOfferGmailIncrementalResume,
  shouldRunNextGmailIncrementalChunk,
} from "./incremental-continue";
import { GMAIL_INCREMENTAL_CHUNK_MAX_PAGES } from "./incremental-sync";
import { GMAIL_HISTORY_CONTINUE_DELAY_MS } from "./history-continue";
import { GMAIL_HISTORY_CHUNK_MAX_PAGES } from "./history";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function chunk(
  overrides: Partial<GmailIncrementalChunkResult> = {},
): GmailIncrementalChunkResult {
  return {
    chunkSucceeded: true,
    checkpointStatus: "running",
    indexedCount: 20,
    indexedThisChunk: 20,
    deletedThisChunk: 0,
    labelUpdatesThisChunk: 0,
    attachmentsThisChunk: 0,
    morePagesRemain: true,
    completed: false,
    initialized: false,
    recovery: false,
    historyIdPresent: false,
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
});

const interrupted = chunk({
  chunkSucceeded: true,
  checkpointStatus: "running",
  indexedCount: 140,
  indexedThisChunk: 0,
  morePagesRemain: true,
  historyIdPresent: false,
});

describe("Gmail incremental automatic continuation", () => {
  it("hard-codes delay and does not take caller pageToken/historyId/maxPages", () => {
    const continueSource = readFileSync(
      join(ROOT, "lib/continuum/gmail/incremental-continue.ts"),
      "utf8",
    );
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail-incremental-actions.ts"),
      "utf8",
    );
    const ui = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/gmail-incremental.tsx"),
      "utf8",
    );
    const sync = readFileSync(join(ROOT, "lib/continuum/gmail/incremental-sync.ts"), "utf8");
    assert.equal(GMAIL_INCREMENTAL_CONTINUE_DELAY_MS, 1000);
    assert.equal(GMAIL_INCREMENTAL_CHUNK_MAX_PAGES, 1);
    assert.match(sync, /GMAIL_INCREMENTAL_CHUNK_MAX_PAGES = 1/);
    assert.match(sync, /GMAIL_INCREMENTAL_HISTORY_PAGE_SIZE/);
    assert.match(continueSource, /runChunk\(\)/);
    assert.doesNotMatch(
      continueSource,
      /\bmaxPages\b|\bpageToken\b|\bhistoryId\b|historicalGmailQuery/,
    );
    assert.match(actions, /export async function runNextGmailIncrementalChunk\(\)/);
    assert.doesNotMatch(actions, /formData\.get\(/);
    assert.doesNotMatch(actions, /maxPages|pageSize|pageToken|historyId/);
    assert.doesNotMatch(ui, /pageToken|maxPages|mailboxEmailHash/);
    assert.match(ui, /Resume current-state sync/);
    assert.match(ui, /Initialize current-state sync/);
    assert.match(ui, /Stop after current chunk/);
    assert.match(ui, /Continuing automatically/);
  });

  it("does not invoke the runner until the founder explicitly starts", async () => {
    let calls = 0;
    createGmailIncrementalContinuation({
      initial: interrupted,
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        return chunk({ indexedCount: 160 });
      },
    });
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(calls, 0);
    assert.equal(shouldOfferGmailIncrementalResume(interrupted), true);
    assert.equal(shouldOfferGmailIncrementalResume(idle), false);
  });

  it("one start runs the first chunk", async () => {
    let calls = 0;
    const continuation = createGmailIncrementalContinuation({
      initial: idle,
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        return chunk({
          indexedCount: 20,
          morePagesRemain: false,
          completed: true,
          checkpointStatus: "completed",
          historyIdPresent: true,
          initialized: true,
        });
      },
    });
    const done = await continuation.start();
    assert.equal(calls, 1);
    assert.equal(done.chunksThisSession, 1);
    assert.equal(done.result.indexedCount, 20);
    assert.equal(done.result.historyIdPresent, true);
    assert.equal(done.stopReason, "completed");
  });

  it("schedules exactly one next chunk after a successful morePagesRemain result", async () => {
    const calls: number[] = [];
    const continuation = createGmailIncrementalContinuation({
      initial: interrupted,
      delayMs: 0,
      runChunk: async () => {
        const index = calls.length;
        calls.push(index);
        if (index === 0) return chunk({ indexedCount: 160, morePagesRemain: true });
        return chunk({
          indexedCount: 180,
          morePagesRemain: false,
          completed: true,
          checkpointStatus: "completed",
          historyIdPresent: true,
        });
      },
    });
    const done = await continuation.start();
    assert.deepEqual(calls, [0, 1]);
    assert.equal(done.result.indexedCount, 180);
    assert.equal(done.result.historyIdPresent, true);
    assert.equal(done.stopReason, "completed");
  });

  it("continues multiple pages sequentially with no overlap", async () => {
    const calls: number[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const pages = [
      chunk({ indexedCount: 20, indexedThisChunk: 20, morePagesRemain: true }),
      chunk({ indexedCount: 60, indexedThisChunk: 40, morePagesRemain: true }),
      chunk({
        indexedCount: 140,
        indexedThisChunk: 80,
        morePagesRemain: false,
        completed: true,
        checkpointStatus: "completed",
        historyIdPresent: true,
        initialized: true,
      }),
    ];
    const continuation = createGmailIncrementalContinuation({
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
    assert.equal(done.result.indexedCount, 140);
    assert.equal(done.stopReason, "completed");
    assert.equal(done.autoRunning, false);
  });

  it("does not start the next chunk until the prior chunk succeeds", async () => {
    const order: string[] = [];
    const continuation = createGmailIncrementalContinuation({
      initial: idle,
      delayMs: 0,
      runChunk: async () => {
        order.push("start");
        await Promise.resolve();
        order.push("end");
        const finished = order.filter((item) => item === "end").length >= 2;
        return chunk({
          indexedCount: finished ? 40 : 20,
          morePagesRemain: !finished,
          completed: finished,
          checkpointStatus: finished ? "completed" : "running",
          historyIdPresent: finished,
        });
      },
    });
    await continuation.start();
    assert.deepEqual(order, ["start", "end", "start", "end"]);
  });

  it("stops automatically on completion and does not start another chunk", async () => {
    let calls = 0;
    const continuation = createGmailIncrementalContinuation({
      initial: interrupted,
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        return chunk({
          indexedCount: 140,
          morePagesRemain: false,
          completed: true,
          checkpointStatus: "completed",
          historyIdPresent: true,
        });
      },
    });
    await continuation.start();
    assert.equal(calls, 1);
  });

  it("stops automatic continuation after a failed chunk without retry", async () => {
    let calls = 0;
    const continuation = createGmailIncrementalContinuation({
      initial: interrupted,
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        if (calls === 1) return chunk({ indexedCount: 160 });
        return chunk({
          chunkSucceeded: false,
          checkpointStatus: "failed",
          indexedCount: 160,
          indexedThisChunk: 0,
          morePagesRemain: true,
          safeErrorCode: "gmail-sync-failed",
        });
      },
    });
    const done = await continuation.start();
    assert.equal(calls, 2);
    assert.equal(done.stopReason, "failed");
    assert.equal(done.result.safeErrorCode, "gmail-sync-failed");
    assert.equal(done.chunksThisSession, 1);
    assert.equal(
      shouldRunNextGmailIncrementalChunk({
        result: done.result,
        autoContinue: true,
        stopAfterCurrent: false,
        cancelled: false,
      }),
      false,
    );
  });

  it("fails closed on gmail-sync-already-running without starting another chunk", async () => {
    let calls = 0;
    const continuation = createGmailIncrementalContinuation({
      initial: interrupted,
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        return chunk({
          chunkSucceeded: false,
          checkpointStatus: "running",
          indexedCount: 140,
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
    assert.equal(done.result.historyIdPresent, false);
  });

  it("stops after the current chunk when requested and leaves morePagesRemain", async () => {
    let calls = 0;
    const continuation = createGmailIncrementalContinuation({
      initial: interrupted,
      delayMs: 5,
      runChunk: async () => {
        calls += 1;
        return chunk({ indexedCount: 140 + calls * 20, indexedThisChunk: 20 });
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
    assert.equal(done.result.historyIdPresent, false);
  });

  it("does not start a future chunk after unmount cancellation", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const continuation = createGmailIncrementalContinuation({
      initial: interrupted,
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        if (calls === 1) await gate;
        return chunk({ indexedCount: 140 + calls * 20 });
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
    const continuation = createGmailIncrementalContinuation({
      initial: interrupted,
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await gate;
        inFlight -= 1;
        return chunk({
          indexedCount: 160,
          morePagesRemain: false,
          completed: true,
          checkpointStatus: "completed",
          historyIdPresent: true,
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

  it("explicit resume continues the existing checkpoint without a client page token", async () => {
    const args: unknown[] = [];
    const runChunk = async (...received: unknown[]) => {
      args.push(received);
      return chunk({
        indexedCount: 160,
        morePagesRemain: false,
        completed: true,
        checkpointStatus: "completed",
        historyIdPresent: true,
      });
    };
    const continuation = createGmailIncrementalContinuation({
      initial: interrupted,
      delayMs: 0,
      runChunk,
    });
    const done = await continuation.start();
    assert.deepEqual(args, [[]]);
    assert.equal(runChunk.length, 0);
    assert.equal(done.result.indexedCount, 160);
    assert.equal(done.result.historyIdPresent, true);
  });

  it("does not auto-run a remounted interrupted checkpoint", async () => {
    let calls = 0;
    const first = createGmailIncrementalContinuation({
      initial: interrupted,
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        return chunk({ indexedCount: 160 });
      },
    });
    first.cancel();
    const remounted = createGmailIncrementalContinuation({
      initial: interrupted,
      delayMs: 0,
      runChunk: async () => {
        calls += 1;
        return chunk({ indexedCount: 160 });
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(calls, 0);
    assert.equal(remounted.isActive(), false);
    assert.equal(shouldOfferGmailIncrementalResume(interrupted), true);
  });

  it("leaves historical Finish backfill continuation unchanged", () => {
    const historyUi = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/gmail-history.tsx"),
      "utf8",
    );
    const historyContinue = readFileSync(
      join(ROOT, "lib/continuum/gmail/history-continue.ts"),
      "utf8",
    );
    assert.equal(GMAIL_HISTORY_CONTINUE_DELAY_MS, 1000);
    assert.equal(GMAIL_HISTORY_CHUNK_MAX_PAGES, 1);
    assert.match(historyUi, /Finish backfill/);
    assert.match(historyUi, /Stop after current chunk/);
    assert.match(historyUi, /createGmailHistoryContinuation/);
    assert.match(historyContinue, /export function createGmailHistoryContinuation/);
    assert.doesNotMatch(historyUi, /createGmailIncrementalContinuation/);
    assert.doesNotMatch(historyContinue, /gmail-memory-daily|runNextGmailIncrementalChunk/);
  });

  it("does not render Gmail content, cron, or Person/Project/Open Job/CoS writes", () => {
    const continueSource = readFileSync(
      join(ROOT, "lib/continuum/gmail/incremental-continue.ts"),
      "utf8",
    );
    const ui = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/gmail-incremental.tsx"),
      "utf8",
    );
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail-incremental-actions.ts"),
      "utf8",
    );
    const vercel = readFileSync(join(ROOT, "vercel.json"), "utf8");
    for (const source of [continueSource, ui, actions]) {
      assert.doesNotMatch(source, /continuum_person_profiles|createPersonAtomic/);
      assert.doesNotMatch(source, /continuum_attention_items|continuum_human_sources/);
      assert.doesNotMatch(source, /continuum_project_jobs|continuum_project_artifacts/);
      assert.doesNotMatch(source, /correctProjectSpec|insertSourceNote/);
      assert.doesNotMatch(source, /attachments\.get|\/messages\/[^?\s"'`]+\/attachments\//);
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
    }
    assert.doesNotMatch(ui, /mailboxEmailHash|ciphertext|subject|snippet|messageId|threadId|filename/);
    assert.match(ui, /runNextGmailIncrementalChunk\(\)/);
    assert.doesNotMatch(ui, /Promise\.all/);
    assert.doesNotMatch(ui, /Continue current-state sync/);
    const effect = ui.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[initial\]\);/)?.[0] ?? "";
    assert.match(effect, /createGmailIncrementalContinuation/);
    assert.match(effect, /continuation\.cancel\(\)/);
    assert.doesNotMatch(effect, /\.start\(/);
    assert.doesNotMatch(effect, /startContinuation\(/);
    assert.match(ui, /onClick=\{startContinuation\}/);
    assert.doesNotMatch(vercel, /gmail-incremental|gmail-memory-daily|gmail-current-state/);
  });
});
