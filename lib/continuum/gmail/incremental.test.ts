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
} from "./fixtures";
import {
  GMAIL_INCREMENTAL_CHUNK_RESULT_KEYS,
  failedGmailIncrementalChunk,
  gmailIncrementalChunkResultKeys,
  runGmailIncrementalChunk,
  sanitizeGmailIncrementalChunkResult,
} from "./incremental";
import type { GmailAccessTokenRefresh } from "./oauth";
import { encryptRefreshToken } from "./token-crypto";
import { GMAIL_INCREMENTAL_JOB_KEY, GMAIL_READONLY_SCOPE } from "./types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const KEY = Buffer.from("b".repeat(64), "hex");
const FOUNDER_HASH = hashEmail(FIXTURE_FOUNDER_EMAIL)!;
const NOW = new Date("2026-08-28T16:00:00.000Z");
const ACCESS = "access-incremental-in-memory";

async function connected() {
  const connections = new InMemoryGmailConnectionStore();
  await connections.putConnection(
    connectFounderMailbox({
      existing: null,
      mailboxEmailHash: FOUNDER_HASH,
      refreshToken: encryptRefreshToken("refresh-incremental", KEY),
      grantedScope: GMAIL_READONLY_SCOPE,
      providerTokenType: "Bearer",
      now: NOW.toISOString(),
    }),
  );
  return connections;
}

async function completeHistorical(index: InMemoryGmailIndexStore) {
  await index.putCheckpoint({
    jobKey: "gmail-historical",
    status: "completed",
    windowStart: "2024-08-28T00:00:00.000Z",
    windowEnd: NOW.toISOString(),
    pageToken: null,
    historyId: null,
    cursorMessageId: null,
    indexedCount: 1,
    updatedAt: NOW.toISOString(),
    errorCode: null,
  });
}

function refreshOk(): (refreshToken: string) => Promise<GmailAccessTokenRefresh> {
  return async () => ({ ok: true, accessToken: ACCESS });
}

function initApi() {
  const api = new MockGmailApi();
  api.setProfile({ emailAddress: FIXTURE_FOUNDER_EMAIL, historyId: "100" });
  api.setMessage(INBOX_FIXTURE_MESSAGE);
  api.setListPage(null, { messages: [], nextPageToken: null });
  return api;
}

function assertSafeOutput(result: ReturnType<typeof sanitizeGmailIncrementalChunkResult>) {
  const serialized = JSON.stringify(result);
  assert.deepEqual(gmailIncrementalChunkResultKeys(result), [
    ...GMAIL_INCREMENTAL_CHUNK_RESULT_KEYS,
  ]);
  assert.equal(serialized.includes(FIXTURE_FOUNDER_EMAIL), false);
  assert.equal(serialized.includes("client@example.com"), false);
  assert.equal(serialized.includes("refresh-incremental"), false);
  assert.equal(serialized.includes(ACCESS), false);
  assert.equal(serialized.includes("msg-"), false);
  assert.equal(serialized.includes("thread-"), false);
  assert.equal(serialized.includes("Anniversary"), false);
  assert.equal(serialized.includes("sketch.pdf"), false);
  assert.equal(serialized.includes("ciphertext"), false);
  assert.doesNotMatch(serialized, /[0-9a-f]{64}/i);
}

describe("Gmail incremental current-state runner", () => {
  it("requires founder or secret auth and does not call Gmail", async () => {
    const api = initApi();
    const result = await runGmailIncrementalChunk({
      founderSessionOk: false,
      enabled: true,
      connections: new InMemoryGmailConnectionStore(),
      index: new InMemoryGmailIndexStore(),
      attachments: new InMemoryGmailAttachmentStore(),
      decryptRefreshToken: () => "refresh-incremental",
      refreshAccessToken: refreshOk(),
      createApi: () => api,
    });
    assert.deepEqual(
      result,
      failedGmailIncrementalChunk("unauthorized", { checkpointStatus: "idle" }),
    );
    assert.equal(api.calls.length, 0);
    assertSafeOutput(result);
  });

  it("honors the kill switch before token use", async () => {
    const api = initApi();
    const result = await runGmailIncrementalChunk({
      founderSessionOk: true,
      enabled: false,
      connections: await connected(),
      index: new InMemoryGmailIndexStore(),
      attachments: new InMemoryGmailAttachmentStore(),
      decryptRefreshToken: () => "refresh-incremental",
      refreshAccessToken: refreshOk(),
      createApi: () => api,
    });
    assert.equal(result.safeErrorCode, "sync-disabled");
    assert.equal(api.calls.length, 0);
    assertSafeOutput(result);
  });

  it("allows secret-protected execution and initializes a history cursor", async () => {
    const api = initApi();
    const index = new InMemoryGmailIndexStore();
    await completeHistorical(index);
    const result = await runGmailIncrementalChunk({
      founderSessionOk: false,
      secretProtectedOk: true,
      enabled: true,
      connections: await connected(),
      index,
      attachments: new InMemoryGmailAttachmentStore(),
      decryptRefreshToken: () => "refresh-incremental",
      refreshAccessToken: refreshOk(),
      createApi: () => api,
      clock: { now: () => NOW, sleep: async () => {} },
    });
    assert.equal(result.chunkSucceeded, true);
    assert.equal(result.initialized, true);
    assert.equal(result.historyIdPresent, true);
    assert.equal(result.completed, true);
    assert.equal((await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY))?.historyId, "100");
    assertSafeOutput(result);
  });

  it("fails closed on a concurrent second invocation", async () => {
    const inner = initApi();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let waiting = false;
    const api = {
      getProfile: async () => {
        waiting = true;
        await gate;
        return inner.getProfile();
      },
      listMessages: (query: Parameters<MockGmailApi["listMessages"]>[0]) =>
        inner.listMessages(query),
      listHistory: (query: Parameters<MockGmailApi["listHistory"]>[0]) =>
        inner.listHistory(query),
      getMessage: (id: string) => inner.getMessage(id),
      getThread: (id: string) => inner.getThread(id),
    };
    const index = new InMemoryGmailIndexStore();
    await completeHistorical(index);
    const attachments = new InMemoryGmailAttachmentStore();
    const connections = await connected();
    const deps = {
      founderSessionOk: true,
      enabled: true,
      connections,
      index,
      attachments,
      decryptRefreshToken: () => "refresh-incremental",
      refreshAccessToken: refreshOk(),
      createApi: () => api,
      clock: { now: () => NOW, sleep: async () => {} },
    };
    const first = runGmailIncrementalChunk(deps);
    const started = Date.now();
    while (!waiting && Date.now() - started < 1000) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(waiting, true);
    const second = await runGmailIncrementalChunk(deps);
    release();
    const done = await first;
    assert.equal(second.safeErrorCode, "gmail-sync-already-running");
    assert.equal(second.chunkSucceeded, false);
    assert.equal(done.chunkSucceeded, true);
    assertSafeOutput(second);
    assertSafeOutput(done);
  });

  it("surfaces token refresh failure without leaking tokens", async () => {
    const api = initApi();
    const index = new InMemoryGmailIndexStore();
    await completeHistorical(index);
    const result = await runGmailIncrementalChunk({
      founderSessionOk: true,
      enabled: true,
      connections: await connected(),
      index,
      attachments: new InMemoryGmailAttachmentStore(),
      decryptRefreshToken: () => "refresh-incremental",
      refreshAccessToken: async () => ({ ok: false, error: "token-refresh-failed" }),
      createApi: () => api,
      clock: { now: () => NOW, sleep: async () => {} },
    });
    assert.equal(result.safeErrorCode, "token-refresh-failed");
    assert.equal(api.calls.length, 0);
    assertSafeOutput(result);
  });

  it("does not write Persons, Human Intake, or CoS and does not persist body", async () => {
    const api = initApi();
    const index = new InMemoryGmailIndexStore();
    await completeHistorical(index);
    const memory = new InMemoryClientMemoryStore();
    const before = await memory.inspectCounts();
    const result = await runGmailIncrementalChunk({
      founderSessionOk: true,
      enabled: true,
      connections: await connected(),
      index,
      attachments: new InMemoryGmailAttachmentStore(),
      decryptRefreshToken: () => "refresh-incremental",
      refreshAccessToken: refreshOk(),
      createApi: () => api,
      clock: { now: () => NOW, sleep: async () => {} },
    });
    assert.equal(result.chunkSucceeded, true);
    assert.deepEqual(await memory.inspectCounts(), before);
    assert.equal(
      api.calls.some((call) => call.method === "getThread"),
      false,
    );
    api.assertNeverFetchedAttachmentBytes();
    assertSafeOutput(result);
  });

  it("keeps the runner off public routes, cron, and PII logs", () => {
    const incremental = readFileSync(join(ROOT, "lib/continuum/gmail/incremental.ts"), "utf8");
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail-incremental-actions.ts"),
      "utf8",
    );
    const ui = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/gmail-incremental.tsx"),
      "utf8",
    );
    const continueHelper = readFileSync(
      join(ROOT, "lib/continuum/gmail/incremental-continue.ts"),
      "utf8",
    );
    const vercel = readFileSync(join(ROOT, "vercel.json"), "utf8");
    for (const source of [incremental, actions, ui, continueHelper]) {
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /continuum_person_profiles|createPersonAtomic/);
      assert.doesNotMatch(source, /continuum_attention_items|continuum_human_sources/);
      assert.doesNotMatch(source, /continuum_open_jobs|project-jobs/);
      assert.doesNotMatch(source, /\/messages\/[^?\s"'`]+\/attachments\//);
    }
    assert.match(actions, /"use server"/);
    assert.doesNotMatch(actions, /formData\.get\(/);
    assert.doesNotMatch(vercel, /gmail-incremental|gmail-memory-daily/);
    assert.doesNotMatch(ui, /mailboxEmailHash|ciphertext|client_secret|messageId|threadId/);
  });
});
