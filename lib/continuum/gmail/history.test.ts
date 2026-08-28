import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { InMemoryGmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { MockGmailApi } from "./adapter";
import { InMemoryGmailAttachmentStore } from "./attachments";
import {
  connectFounderMailbox,
  InMemoryGmailConnectionStore,
} from "./connection";
import {
  FIXTURE_FOUNDER_EMAIL,
  INBOX_FIXTURE_MESSAGE,
  SENT_FIXTURE_MESSAGE,
} from "./fixtures";
import {
  GMAIL_HISTORY_CHUNK_MAX_PAGES,
  GMAIL_HISTORY_CHUNK_RESULT_KEYS,
  failedGmailHistoryChunk,
  gmailHistoryChunkResultKeys,
  runGmailHistoryChunk,
  sanitizeGmailHistoryChunkResult,
  snapshotFromCheckpoint,
} from "./history";
import type { GmailAccessTokenRefresh } from "./oauth";
import { runHistoricalSync } from "./sync";
import { encryptRefreshToken } from "./token-crypto";
import { GMAIL_READONLY_SCOPE } from "./types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const KEY = Buffer.from("d".repeat(64), "hex");
const FOUNDER_HASH = hashEmail(FIXTURE_FOUNDER_EMAIL)!;
const NOW = new Date("2026-08-28T16:00:00.000Z");
const ACCESS = "access-history-in-memory";

class RecordingIndex extends InMemoryGmailIndexStore {
  readonly order: string[] = [];

  override async indexMessage(
    input: Parameters<InMemoryGmailIndexStore["indexMessage"]>[0],
    indexedAt: string,
  ) {
    this.order.push("message");
    return super.indexMessage(input, indexedAt);
  }

  override async putCheckpoint(
    row: Parameters<InMemoryGmailIndexStore["putCheckpoint"]>[0],
  ) {
    this.order.push("checkpoint");
    return super.putCheckpoint(row);
  }
}

async function connected() {
  const connections = new InMemoryGmailConnectionStore();
  await connections.putConnection(
    connectFounderMailbox({
      existing: null,
      mailboxEmailHash: FOUNDER_HASH,
      refreshToken: encryptRefreshToken("refresh-history", KEY),
      grantedScope: GMAIL_READONLY_SCOPE,
      providerTokenType: "Bearer",
      now: NOW.toISOString(),
    }),
  );
  return connections;
}

function refreshOk(): (
  refreshToken: string,
) => Promise<GmailAccessTokenRefresh> {
  return async () => ({ ok: true, accessToken: ACCESS });
}

function twoPageApi() {
  const api = new MockGmailApi();
  api.setMessage(INBOX_FIXTURE_MESSAGE);
  api.setMessage(SENT_FIXTURE_MESSAGE);
  api.setListPage(null, {
    messages: [{ id: INBOX_FIXTURE_MESSAGE.id, threadId: INBOX_FIXTURE_MESSAGE.threadId }],
    nextPageToken: "page-2",
  });
  api.setListPage("page-2", {
    messages: [{ id: SENT_FIXTURE_MESSAGE.id, threadId: SENT_FIXTURE_MESSAGE.threadId }],
    nextPageToken: null,
  });
  return api;
}

function assertSafeOutput(result: ReturnType<typeof sanitizeGmailHistoryChunkResult>) {
  const serialized = JSON.stringify(result);
  assert.deepEqual(gmailHistoryChunkResultKeys(result), [...GMAIL_HISTORY_CHUNK_RESULT_KEYS]);
  assert.equal(serialized.includes(FIXTURE_FOUNDER_EMAIL), false);
  assert.equal(serialized.includes("client@example.com"), false);
  assert.equal(serialized.includes("refresh-history"), false);
  assert.equal(serialized.includes(ACCESS), false);
  assert.equal(serialized.includes("msg-"), false);
  assert.equal(serialized.includes("thread-"), false);
  assert.equal(serialized.includes("Anniversary"), false);
  assert.equal(serialized.includes("sketch.pdf"), false);
  assert.equal(serialized.includes("ciphertext"), false);
  assert.doesNotMatch(serialized, /[0-9a-f]{64}/i);
}

describe("Gmail founder history chunk runner", () => {
  it("requires founder auth and does not call Gmail", async () => {
    const api = twoPageApi();
    const result = await runGmailHistoryChunk({
      founderSessionOk: false,
      connections: new InMemoryGmailConnectionStore(),
      index: new InMemoryGmailIndexStore(),
      attachments: new InMemoryGmailAttachmentStore(),
      decryptRefreshToken: () => "refresh-history",
      refreshAccessToken: refreshOk(),
      createApi: () => api,
    });
    assert.deepEqual(result, failedGmailHistoryChunk("unauthorized", { checkpointStatus: "idle" }));
    assert.equal(api.calls.length, 0);
    assertSafeOutput(result);
  });

  it("requires a connected Gmail credential", async () => {
    const api = twoPageApi();
    const result = await runGmailHistoryChunk({
      founderSessionOk: true,
      connections: new InMemoryGmailConnectionStore(),
      index: new InMemoryGmailIndexStore(),
      attachments: new InMemoryGmailAttachmentStore(),
      decryptRefreshToken: () => "refresh-history",
      refreshAccessToken: refreshOk(),
      createApi: () => api,
    });
    assert.equal(result.safeErrorCode, "gmail-not-connected");
    assert.equal(api.calls.length, 0);
    assertSafeOutput(result);
  });

  it("hard-codes maxPages to 1 and does not take caller q/window/page count", () => {
    const history = readFileSync(join(ROOT, "lib/continuum/gmail/history.ts"), "utf8");
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail-history-actions.ts"),
      "utf8",
    );
    assert.equal(GMAIL_HISTORY_CHUNK_MAX_PAGES, 1);
    assert.match(history, /GMAIL_HISTORY_CHUNK_MAX_PAGES = 1/);
    assert.match(history, /maxPages: GMAIL_HISTORY_CHUNK_MAX_PAGES/);
    assert.doesNotMatch(history, /input\.(maxPages|pageSize|q)\b/);
    assert.doesNotMatch(actions, /formData\.get\(/);
    assert.doesNotMatch(actions, /maxPages|pageSize|windowStart|historicalGmailQuery/);
  });

  it("creates a fixed 24-month window on the first chunk and resumes it", async () => {
    const api = twoPageApi();
    const index = new RecordingIndex();
    const attachments = new InMemoryGmailAttachmentStore();
    const connections = await connected();
    let now = NOW;
    const clock = {
      now: () => now,
      sleep: async () => {},
    };
    const first = await runGmailHistoryChunk({
      founderSessionOk: true,
      connections,
      index,
      attachments,
      decryptRefreshToken: () => "refresh-history",
      refreshAccessToken: refreshOk(),
      createApi: () => api,
      clock,
    });
    assert.equal(first.chunkSucceeded, true);
    assert.equal(first.checkpointStatus, "running");
    assert.equal(first.morePagesRemain, true);
    assert.equal(first.completed, false);
    assert.equal(first.indexedCount, 1);
    assert.equal(first.windowStart, "2024-08-28");
    assert.equal(first.windowEnd, "2026-08-28");
    const afterFirst = await index.getCheckpoint("gmail-historical");
    assert.equal(afterFirst?.pageToken, "page-2");
    const firstMessageIdx = index.order.indexOf("message");
    const firstPageCheckpoint = index.order.indexOf(
      "checkpoint",
      firstMessageIdx,
    );
    assert.ok(firstMessageIdx >= 0);
    assert.ok(firstPageCheckpoint > firstMessageIdx);

    now = new Date("2026-08-29T16:00:00.000Z");
    const second = await runGmailHistoryChunk({
      founderSessionOk: true,
      connections,
      index,
      attachments,
      decryptRefreshToken: () => "refresh-history",
      refreshAccessToken: refreshOk(),
      createApi: () => api,
      clock,
    });
    assert.equal(second.chunkSucceeded, true);
    assert.equal(second.completed, true);
    assert.equal(second.morePagesRemain, false);
    assert.equal(second.indexedCount, 2);
    assert.equal(second.windowStart, "2024-08-28");
    assert.equal(second.windowEnd, "2026-08-28");
    assert.equal((await index.getCheckpoint("gmail-historical"))?.status, "completed");
    assertSafeOutput(first);
    assertSafeOutput(second);
  });

  it("fails closed on a concurrent second invocation", async () => {
    const inner = twoPageApi();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let waiting = false;
    const api = {
      getProfile: () => inner.getProfile(),
      listMessages: (query: Parameters<MockGmailApi["listMessages"]>[0]) =>
        inner.listMessages(query),
      getMessage: async (id: string) => {
        waiting = true;
        await gate;
        return inner.getMessage(id);
      },
      getThread: (id: string) => inner.getThread(id),
    };
    const index = new InMemoryGmailIndexStore();
    const attachments = new InMemoryGmailAttachmentStore();
    const connections = await connected();
    const deps = {
      founderSessionOk: true,
      connections,
      index,
      attachments,
      decryptRefreshToken: () => "refresh-history",
      refreshAccessToken: refreshOk(),
      createApi: () => api,
      clock: { now: () => NOW, sleep: async () => {} },
    };
    const first = runGmailHistoryChunk(deps);
    const started = Date.now();
    while (!waiting && Date.now() - started < 1000) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(waiting, true);
    const second = await runGmailHistoryChunk(deps);
    release();
    const done = await first;
    assert.equal(second.safeErrorCode, "gmail-sync-already-running");
    assert.equal(second.chunkSucceeded, false);
    assert.equal(done.chunkSucceeded, true);
    assertSafeOutput(second);
    assertSafeOutput(done);
  });

  it("replays a failed page idempotently without duplicate rows", async () => {
    const api = twoPageApi();
    api.errors.set(`getMessage:${INBOX_FIXTURE_MESSAGE.id}`, new Error("crash"));
    const index = new InMemoryGmailIndexStore();
    const attachments = new InMemoryGmailAttachmentStore();
    const connections = await connected();
    const deps = {
      founderSessionOk: true,
      connections,
      index,
      attachments,
      decryptRefreshToken: () => "refresh-history",
      refreshAccessToken: refreshOk(),
      createApi: () => api,
      clock: { now: () => NOW, sleep: async () => {} },
    };
    const failed = await runGmailHistoryChunk(deps);
    assert.equal(failed.chunkSucceeded, false);
    assert.equal(index.listMessages().length, 0);
    api.errors.delete(`getMessage:${INBOX_FIXTURE_MESSAGE.id}`);
    const retry = await runGmailHistoryChunk(deps);
    assert.equal(retry.chunkSucceeded, true);
    assert.equal(retry.indexedCount, 1);
    const again = await runGmailHistoryChunk(deps);
    assert.equal(again.indexedCount, 2);
    assert.equal(index.listMessages().length, 2);
    assertSafeOutput(retry);
  });

  it("does not write Persons, projects, or CoS and does not persist body/snippet", async () => {
    const api = twoPageApi();
    const index = new InMemoryGmailIndexStore();
    const attachments = new InMemoryGmailAttachmentStore();
    const connections = await connected();
    const memory = new InMemoryClientMemoryStore();
    const before = await memory.inspectCounts();
    const result = await runGmailHistoryChunk({
      founderSessionOk: true,
      connections,
      index,
      attachments,
      decryptRefreshToken: () => "refresh-history",
      refreshAccessToken: refreshOk(),
      createApi: () => api,
      clock: { now: () => NOW, sleep: async () => {} },
    });
    const inbox = await index.getMessage(INBOX_FIXTURE_MESSAGE.id);
    assert.equal(result.indexedCount, 1);
    assert.equal("body" in (inbox ?? {}), false);
    assert.equal("snippet" in (inbox ?? {}), false);
    assert.equal(JSON.stringify(inbox).includes("SHOULD-NOT-PERSIST"), false);
    assert.equal(JSON.stringify(inbox).includes("client@example.com"), false);
    assert.deepEqual(await memory.inspectCounts(), before);
    assert.equal(
      api.calls.some((call) => call.method === "getThread"),
      false,
    );
    api.assertNeverFetchedAttachmentBytes();
    assertSafeOutput(result);
  });

  it("short-circuits when historical backfill is already completed", async () => {
    const api = twoPageApi();
    const index = new InMemoryGmailIndexStore();
    const attachments = new InMemoryGmailAttachmentStore();
    const connections = await connected();
    await runHistoricalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock: { now: () => NOW, sleep: async () => {} },
    });
    const callsAfterFull = api.calls.length;
    const result = await runGmailHistoryChunk({
      founderSessionOk: true,
      connections,
      index,
      attachments,
      decryptRefreshToken: () => "refresh-history",
      refreshAccessToken: refreshOk(),
      createApi: () => api,
      clock: { now: () => NOW, sleep: async () => {} },
    });
    assert.equal(result.completed, true);
    assert.equal(api.calls.length, callsAfterFull);
    assertSafeOutput(result);
  });
});

describe("Gmail history chunk source boundaries", () => {
  it("keeps the runner off public routes, PII logs, and attachments.get", () => {
    const history = readFileSync(join(ROOT, "lib/continuum/gmail/history.ts"), "utf8");
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail-history-actions.ts"),
      "utf8",
    );
    const ui = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/gmail-history.tsx"),
      "utf8",
    );
    const page = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail/page.tsx"),
      "utf8",
    );
    for (const source of [history, actions, ui, page]) {
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /continuum_person_profiles|createPersonAtomic/);
      assert.doesNotMatch(source, /continuum_attention_items/);
      assert.doesNotMatch(source, /\/messages\/[^?\s"'`]+\/attachments\//);
      assert.doesNotMatch(source, /attachments\.get/);
    }
    assert.doesNotMatch(ui, /mailboxEmailHash|ciphertext|client_secret|messageId|threadId/);
    assert.match(ui, /Gmail History/);
    assert.match(ui, /Start backfill/);
    assert.match(actions, /"use server"/);
    assert.match(actions, /runGmailHistoryChunk/);
  });
});
