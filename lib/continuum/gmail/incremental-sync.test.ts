import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { InMemoryGmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import type { GmailCheckpoint } from "@/lib/continuum/client-memory/gmail/types";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { GmailHttpError, MockGmailApi, parseGmailJson } from "./adapter";
import { InMemoryGmailAttachmentStore } from "./attachments";
import {
  applyPause,
  connectFounderMailbox,
  InMemoryGmailConnectionStore,
  revokeConnection,
} from "./connection";
import { readGmailCurrentState } from "./current-state";
import {
  FIXTURE_FOUNDER_EMAIL,
  INBOX_FIXTURE_MESSAGE,
  SENT_FIXTURE_MESSAGE,
} from "./fixtures";
import {
  HISTORICAL_INCOMPLETE,
  encodePendingHistoryCursor,
  isMailboxIndexedView,
  parsePendingHistoryCursor,
  runIncrementalSync,
} from "./incremental-sync";
import { extractAttachmentMetadata, sentAtFromInternalDate } from "./payload";
import { encryptRefreshToken } from "./token-crypto";
import { GMAIL_INCREMENTAL_JOB_KEY, GMAIL_READONLY_SCOPE } from "./types";

const NOW = new Date("2026-08-27T16:00:00.000Z");
const KEY = Buffer.from("a".repeat(64), "hex");
const FOUNDER_HASH = hashEmail(FIXTURE_FOUNDER_EMAIL)!;
const CLIENT_HASH = hashEmail("client@example.com")!;
const HISTORY_START = "100";
const HISTORY_NEXT = "200";

const clock = {
  now: () => NOW,
  sleep: async () => {},
};

const NEW_INBOUND = {
  ...INBOX_FIXTURE_MESSAGE,
  id: "msg-inbox-2",
  internalDate: "1724600000000",
};

const NEW_SENT = {
  ...SENT_FIXTURE_MESSAGE,
  id: "msg-sent-2",
  internalDate: "1724603600000",
};

async function connected(store: InMemoryGmailConnectionStore) {
  await store.putConnection(
    connectFounderMailbox({
      existing: null,
      mailboxEmailHash: FOUNDER_HASH,
      refreshToken: encryptRefreshToken("refresh-incremental", KEY),
      grantedScope: GMAIL_READONLY_SCOPE,
      providerTokenType: "Bearer",
      now: NOW.toISOString(),
    }),
  );
}

async function completeHistorical(index: InMemoryGmailIndexStore) {
  await index.putCheckpoint({
    jobKey: "gmail-historical",
    status: "completed",
    windowStart: "2024-08-28T00:00:00.000Z",
    windowEnd: NOW.toISOString(),
    pageToken: null,
    historyId: null,
    cursorMessageId: "msg-sent-1",
    indexedCount: 2,
    updatedAt: NOW.toISOString(),
    errorCode: null,
  });
}

function readyApi() {
  const api = new MockGmailApi();
  api.setProfile({ emailAddress: FIXTURE_FOUNDER_EMAIL, historyId: HISTORY_START });
  api.setMessage(INBOX_FIXTURE_MESSAGE);
  api.setMessage(SENT_FIXTURE_MESSAGE);
  api.setMessage(NEW_INBOUND);
  api.setMessage(NEW_SENT);
  api.setListPage(null, { messages: [], nextPageToken: null });
  return api;
}

async function seed() {
  const api = readyApi();
  const index = new InMemoryGmailIndexStore();
  const attachments = new InMemoryGmailAttachmentStore();
  const connections = new InMemoryGmailConnectionStore();
  await connected(connections);
  await completeHistorical(index);
  return { api, index, attachments, connections };
}

describe("Gmail incremental History API sync", () => {
  it("quotes uint64 historyId values so the checkpoint is not rounded", () => {
    const parsed = parseGmailJson('{"historyId": 12345678901234567, "ok": true}') as {
      historyId: string;
      ok: boolean;
    };
    assert.equal(parsed.historyId, "12345678901234567");
    assert.equal(parsed.ok, true);
  });

  it("indexes Inbox/Sent and drops trash/spam", () => {
    assert.equal(isMailboxIndexedView(["INBOX"]), true);
    assert.equal(isMailboxIndexedView(["SENT"]), true);
    assert.equal(isMailboxIndexedView(["INBOX", "TRASH"]), false);
    assert.equal(isMailboxIndexedView(["SPAM"]), false);
  });

  it("blocks until historical backfill is completed", async () => {
    const { api, index, attachments, connections } = await seed();
    await index.putCheckpoint({
      jobKey: "gmail-historical",
      status: "running",
      windowStart: "2024-08-28T00:00:00.000Z",
      windowEnd: NOW.toISOString(),
      pageToken: "page-2",
      historyId: null,
      cursorMessageId: null,
      indexedCount: 1,
      updatedAt: NOW.toISOString(),
      errorCode: null,
    });
    const result = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.errorCode, HISTORICAL_INCOMPLETE);
    assert.equal(api.calls.some((call) => call.method === "listHistory"), false);
  });

  it("initializes the incremental historyId after overlap catch-up", async () => {
    const { api, index, attachments, connections } = await seed();
    const result = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(result.status, "completed");
    assert.equal(result.initialized, true);
    assert.equal(result.recovery, false);
    const checkpoint = await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY);
    assert.equal(checkpoint?.jobKey, "gmail-memory-daily");
    assert.equal(checkpoint?.historyId, HISTORY_START);
    assert.equal(checkpoint?.pageToken, null);
    assert.equal(checkpoint?.status, "completed");
    const methods = api.calls.map((call) => call.method);
    const profileAt = methods.indexOf("getProfile");
    const listAt = methods.indexOf("listMessages");
    assert.ok(profileAt >= 0 && listAt > profileAt);
    assert.equal(
      api.calls.some((call) => call.method === "listHistory"),
      false,
    );
  });

  it("indexes a new inbound message from history without rescanning the window", async () => {
    const { api, index, attachments, connections } = await seed();
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    api.setHistoryPage(HISTORY_START, null, {
      history: [
        {
          id: "101",
          messagesAdded: [
            {
              message: {
                id: NEW_INBOUND.id,
                threadId: NEW_INBOUND.threadId,
                labelIds: ["INBOX"],
              },
            },
          ],
        },
      ],
      nextPageToken: null,
      historyId: HISTORY_NEXT,
    });
    const beforeCalls = api.calls.filter((call) => call.method === "listMessages").length;
    const result = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(result.status, "completed");
    assert.equal(result.insertedCount, 1);
    const row = await index.getMessage(NEW_INBOUND.id);
    assert.equal(row?.direction, "inbound");
    assert.equal(row?.fromEmailHash, CLIENT_HASH);
    assert.equal("body" in (row ?? {}), false);
    assert.equal(JSON.stringify(row).includes("SHOULD-NOT-PERSIST"), false);
    assert.equal(JSON.stringify(row).includes("client@example.com"), false);
    assert.equal((await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY))?.historyId, HISTORY_NEXT);
    assert.equal(
      api.calls.filter((call) => call.method === "listMessages").length,
      beforeCalls,
    );
  });

  it("indexes a new sent/outbound message from history", async () => {
    const { api, index, attachments, connections } = await seed();
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    api.setHistoryPage(HISTORY_START, null, {
      history: [
        {
          id: "102",
          messagesAdded: [
            {
              message: {
                id: NEW_SENT.id,
                threadId: NEW_SENT.threadId,
                labelIds: ["SENT"],
              },
            },
          ],
        },
      ],
      nextPageToken: null,
      historyId: HISTORY_NEXT,
    });
    const result = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(result.insertedCount, 1);
    assert.equal((await index.getMessage(NEW_SENT.id))?.direction, "outbound");
  });

  it("does not advance historyId until every history page is indexed", async () => {
    const { api, index, attachments, connections } = await seed();
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    api.setHistoryPage(HISTORY_START, null, {
      history: [
        {
          id: "101",
          messagesAdded: [
            {
              message: {
                id: NEW_INBOUND.id,
                threadId: NEW_INBOUND.threadId,
                labelIds: ["INBOX"],
              },
            },
          ],
        },
      ],
      nextPageToken: "hist-2",
      historyId: "150",
    });
    api.setHistoryPage(HISTORY_START, "hist-2", {
      history: [
        {
          id: "102",
          messagesAdded: [
            {
              message: {
                id: NEW_SENT.id,
                threadId: NEW_SENT.threadId,
                labelIds: ["SENT"],
              },
            },
          ],
        },
      ],
      nextPageToken: null,
      historyId: HISTORY_NEXT,
    });
    const first = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(first.status, "running");
    const mid = await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY);
    assert.equal(mid?.historyId, HISTORY_START);
    assert.equal(mid?.pageToken, "hist-2");
    assert.equal(await index.getMessage(NEW_INBOUND.id) !== null, true);
    assert.equal(await index.getMessage(NEW_SENT.id), null);

    const second = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(second.status, "completed");
    const done = await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY);
    assert.equal(done?.historyId, HISTORY_NEXT);
    assert.equal(done?.pageToken, null);
    assert.equal(await index.getMessage(NEW_SENT.id) !== null, true);
  });

  it("replays duplicate history without duplicating rows", async () => {
    const { api, index, attachments, connections } = await seed();
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    api.setHistoryPage(HISTORY_START, null, {
      history: [
        {
          id: "101",
          messagesAdded: [
            {
              message: {
                id: NEW_INBOUND.id,
                threadId: NEW_INBOUND.threadId,
                labelIds: ["INBOX"],
              },
            },
          ],
        },
      ],
      nextPageToken: null,
      historyId: HISTORY_NEXT,
    });
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    await index.putCheckpoint({
      ...(await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY))!,
      historyId: HISTORY_START,
      pageToken: null,
      status: "completed",
      errorCode: null,
    });
    const replay = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(replay.insertedCount, 0);
    assert.equal(
      index.listMessages().filter((row) => row.messageId === NEW_INBOUND.id).length,
      1,
    );
  });

  it("does not advance the cursor when a page crashes after some messages", async () => {
    const { api, index, attachments, connections } = await seed();
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    api.setHistoryPage(HISTORY_START, null, {
      history: [
        {
          id: "101",
          messagesAdded: [
            {
              message: {
                id: NEW_INBOUND.id,
                threadId: NEW_INBOUND.threadId,
                labelIds: ["INBOX"],
              },
            },
            {
              message: {
                id: NEW_SENT.id,
                threadId: NEW_SENT.threadId,
                labelIds: ["SENT"],
              },
            },
          ],
        },
      ],
      nextPageToken: null,
      historyId: HISTORY_NEXT,
    });
    api.errors.set(`getMessage:${NEW_SENT.id}`, new Error("crash"));
    const failed = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(failed.status, "failed");
    const crashed = await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY);
    assert.equal(crashed?.historyId, HISTORY_START);
    assert.equal(crashed?.pageToken, null);
    assert.equal(await index.getMessage(NEW_INBOUND.id) !== null, true);
    assert.equal(await index.getMessage(NEW_SENT.id), null);

    api.errors.delete(`getMessage:${NEW_SENT.id}`);
    const retry = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(retry.status, "completed");
    assert.equal((await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY))?.historyId, HISTORY_NEXT);
    assert.equal(await index.getMessage(NEW_SENT.id) !== null, true);
  });

  it("recovers from an expired historyId with overlap catch-up, not a skip", async () => {
    const { api, index, attachments, connections } = await seed();
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    api.errors.set("listHistory", new GmailHttpError(404, "notFound"));
    api.setProfile({ emailAddress: FIXTURE_FOUNDER_EMAIL, historyId: "999" });
    api.setListPage(null, {
      messages: [{ id: NEW_INBOUND.id, threadId: NEW_INBOUND.threadId }],
      nextPageToken: null,
    });
    const afterInit = api.calls.length;
    const recovered = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(recovered.status, "completed");
    assert.equal(recovered.recovery, true);
    assert.equal(await index.getMessage(NEW_INBOUND.id) !== null, true);
    assert.equal((await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY))?.historyId, "999");
    const recoveryMethods = api.calls.slice(afterInit).map((call) => call.method);
    const profileAt = recoveryMethods.indexOf("getProfile");
    const listAt = recoveryMethods.indexOf("listMessages");
    assert.ok(profileAt >= 0 && listAt > profileAt);
    assert.equal(recoveryMethods.includes("listHistory"), true);
  });

  it("does not move historyId when recovery catch-up fails", async () => {
    const { api, index, attachments, connections } = await seed();
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    api.errors.set("listHistory", new GmailHttpError(404, "notFound"));
    api.errors.set("listMessages", new Error("catch-up-crash"));
    const failed = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(failed.status, "failed");
    assert.equal((await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY))?.historyId, HISTORY_START);
  });

  it("removes deleted mail from the index and attachment metadata", async () => {
    const { api, index, attachments, connections } = await seed();
    await index.indexMessage(
      {
        messageId: INBOX_FIXTURE_MESSAGE.id,
        threadId: INBOX_FIXTURE_MESSAGE.threadId,
        sentAt: "2026-08-24T12:00:00.000Z",
        fromEmail: "client@example.com",
        toEmails: [FIXTURE_FOUNDER_EMAIL],
        direction: "inbound",
        labelIds: ["INBOX"],
        hasAttachments: true,
      },
      NOW.toISOString(),
    );
    await attachments.putAttachment(
      extractAttachmentMetadata(INBOX_FIXTURE_MESSAGE, NOW.toISOString())[0]!,
    );
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    api.setHistoryPage(HISTORY_START, null, {
      history: [
        {
          id: "103",
          messagesDeleted: [
            {
              message: {
                id: INBOX_FIXTURE_MESSAGE.id,
                threadId: INBOX_FIXTURE_MESSAGE.threadId,
              },
            },
          ],
        },
      ],
      nextPageToken: null,
      historyId: HISTORY_NEXT,
    });
    const result = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(result.deletedCount, 1);
    assert.equal(await index.getMessage(INBOX_FIXTURE_MESSAGE.id), null);
    assert.equal((await attachments.listByMessage(INBOX_FIXTURE_MESSAGE.id)).length, 0);
  });

  it("applies label changes and drops mail that left Inbox/Sent", async () => {
    const { api, index, attachments, connections } = await seed();
    await index.indexMessage(
      {
        messageId: INBOX_FIXTURE_MESSAGE.id,
        threadId: INBOX_FIXTURE_MESSAGE.threadId,
        sentAt: sentAtFromInternalDate(INBOX_FIXTURE_MESSAGE),
        fromEmail: "client@example.com",
        toEmails: [FIXTURE_FOUNDER_EMAIL],
        direction: "inbound",
        labelIds: ["INBOX"],
        hasAttachments: true,
      },
      NOW.toISOString(),
    );
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    api.setMessage({
      ...INBOX_FIXTURE_MESSAGE,
      labelIds: ["INBOX", "IMPORTANT"],
    });
    api.setHistoryPage(HISTORY_START, null, {
      history: [
        {
          id: "104",
          labelsAdded: [
            {
              message: {
                id: INBOX_FIXTURE_MESSAGE.id,
                threadId: INBOX_FIXTURE_MESSAGE.threadId,
                labelIds: ["INBOX", "IMPORTANT"],
              },
              labelIds: ["IMPORTANT"],
            },
          ],
        },
      ],
      nextPageToken: null,
      historyId: "180",
    });
    const labeled = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.ok(labeled.labelUpdateCount >= 1);
    assert.deepEqual([...(await index.getMessage(INBOX_FIXTURE_MESSAGE.id))!.labelIds], [
      "INBOX",
      "IMPORTANT",
    ]);
    assert.equal((await index.getMessage(INBOX_FIXTURE_MESSAGE.id))?.direction, "inbound");

    api.setMessage({ ...INBOX_FIXTURE_MESSAGE, labelIds: ["TRASH"] });
    api.setHistoryPage("180", null, {
      history: [
        {
          id: "105",
          labelsAdded: [
            {
              message: {
                id: INBOX_FIXTURE_MESSAGE.id,
                threadId: INBOX_FIXTURE_MESSAGE.threadId,
                labelIds: ["TRASH"],
              },
              labelIds: ["TRASH"],
            },
          ],
        },
      ],
      nextPageToken: null,
      historyId: HISTORY_NEXT,
    });
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(await index.getMessage(INBOX_FIXTURE_MESSAGE.id), null);
  });

  it("preserves participant hashing and does not write Persons, Open Jobs, or CoS", async () => {
    const { api, index, attachments, connections } = await seed();
    const memory = new InMemoryClientMemoryStore();
    const before = await memory.inspectCounts();
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    api.setHistoryPage(HISTORY_START, null, {
      history: [
        {
          id: "101",
          messagesAdded: [
            {
              message: {
                id: NEW_INBOUND.id,
                threadId: NEW_INBOUND.threadId,
                labelIds: ["INBOX"],
              },
            },
          ],
        },
      ],
      nextPageToken: null,
      historyId: HISTORY_NEXT,
    });
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    const row = await index.getMessage(NEW_INBOUND.id);
    assert.equal(row?.fromEmailHash, CLIENT_HASH);
    assert.deepEqual([...row!.toEmailHashes], [FOUNDER_HASH]);
    assert.deepEqual(await memory.inspectCounts(), before);
    assert.equal(
      api.calls.some((call) => call.method === "getThread"),
      false,
    );
    api.assertNeverFetchedAttachmentBytes();
  });

  it("stops when the founder connection is paused or revoked", async () => {
    const { api, index, attachments, connections } = await seed();
    await applyPause(connections, NOW.toISOString());
    const paused = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(paused.status, "paused");
    assert.equal(api.calls.length, 0);

    const row = await connections.getFounderConnection();
    await connections.putConnection(revokeConnection(row!, NOW.toISOString()));
    const revoked = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(revoked.status, "revoked");
  });

  it("exposes latest inbound/outbound current-state without Meeting Prep", async () => {
    const { api, index, attachments, connections } = await seed();
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    api.setHistoryPage(HISTORY_START, null, {
      history: [
        {
          id: "101",
          messagesAdded: [
            {
              message: {
                id: NEW_INBOUND.id,
                threadId: NEW_INBOUND.threadId,
                labelIds: ["INBOX"],
              },
            },
            {
              message: {
                id: NEW_SENT.id,
                threadId: NEW_SENT.threadId,
                labelIds: ["SENT"],
              },
            },
          ],
        },
      ],
      nextPageToken: null,
      historyId: HISTORY_NEXT,
    });
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    const state = await readGmailCurrentState(index, "2026-08-01T00:00:00.000Z");
    assert.equal(state.latestInbound?.messageId, NEW_INBOUND.id);
    assert.equal(state.latestOutbound?.messageId, NEW_SENT.id);
    assert.equal(state.latestInbound?.direction, "inbound");
    assert.equal(state.latestOutbound?.direction, "outbound");
    assert.equal(state.hasNewerIndexedActivity, true);
    assert.equal("subject" in state.latestInbound!, false);
  });
});

function callMethods(api: MockGmailApi, from = 0): string[] {
  return api.calls.slice(from).map((call) => call.method);
}

function assertProfileCapturedBeforeCatchUp(methods: readonly string[]) {
  const profileAt = methods.indexOf("getProfile");
  const listAt = methods.indexOf("listMessages");
  assert.ok(profileAt >= 0, "expected users.getProfile capture");
  assert.ok(listAt > profileAt, "expected catch-up list after cursor capture");
}

class OneShotContinuationCrashStore extends InMemoryGmailIndexStore {
  private remaining = 1;

  override async putCheckpoint(row: GmailCheckpoint) {
    if (
      this.remaining > 0 &&
      row.status === "running" &&
      row.pageToken &&
      parsePendingHistoryCursor(row.cursorMessageId)
    ) {
      this.remaining -= 1;
      throw new Error("crash-before-continuation");
    }
    return super.putCheckpoint(row);
  }
}

describe("Gmail incremental cursor capture race", () => {
  it("captures the init cursor before overlap catch-up", async () => {
    const { api, index, attachments, connections } = await seed();
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assertProfileCapturedBeforeCatchUp(callMethods(api));
    assert.equal((await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY))?.historyId, HISTORY_START);
  });

  it("does not lose mail that arrives between cursor capture and catch-up completion", async () => {
    const { api, index, attachments, connections } = await seed();
    api.setListPage(null, { messages: [], nextPageToken: null });
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(await index.getMessage(NEW_INBOUND.id), null);
    api.setProfile({ emailAddress: FIXTURE_FOUNDER_EMAIL, historyId: "101" });
    api.setHistoryPage(HISTORY_START, null, {
      history: [
        {
          id: "101",
          messagesAdded: [
            {
              message: {
                id: NEW_INBOUND.id,
                threadId: NEW_INBOUND.threadId,
                labelIds: ["INBOX"],
              },
            },
          ],
        },
      ],
      nextPageToken: null,
      historyId: "101",
    });
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(await index.getMessage(NEW_INBOUND.id) !== null, true);
    assert.equal(
      api.calls.some(
        (call) => call.method === "listHistory" && call.startHistoryId === HISTORY_START,
      ),
      true,
    );
  });

  it("keeps catch-up plus later History API replay idempotent", async () => {
    const { api, index, attachments, connections } = await seed();
    api.setListPage(null, {
      messages: [{ id: NEW_INBOUND.id, threadId: NEW_INBOUND.threadId }],
      nextPageToken: null,
    });
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(await index.getMessage(NEW_INBOUND.id) !== null, true);
    api.setHistoryPage(HISTORY_START, null, {
      history: [
        {
          id: "101",
          messagesAdded: [
            {
              message: {
                id: NEW_INBOUND.id,
                threadId: NEW_INBOUND.threadId,
                labelIds: ["INBOX"],
              },
            },
          ],
        },
      ],
      nextPageToken: null,
      historyId: "101",
    });
    const replay = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(replay.status, "completed");
    assert.equal((await index.listLatestByDirection("inbound", 10)).length, 1);
    assert.equal(await index.getMessage(NEW_INBOUND.id) !== null, true);
  });

  it("does not activate historyId if catch-up crashes before it starts", async () => {
    const { api, index, attachments, connections } = await seed();
    api.errors.set("listMessages", new Error("crash-before-catch-up"));
    const failed = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(failed.status, "failed");
    const crashed = await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY);
    assert.equal(crashed?.historyId, null);
    assert.equal(parsePendingHistoryCursor(crashed?.cursorMessageId ?? null), HISTORY_START);
    const profiles = callMethods(api).filter((method) => method === "getProfile").length;

    api.errors.delete("listMessages");
    api.setProfile({ emailAddress: FIXTURE_FOUNDER_EMAIL, historyId: "999" });
    const retry = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(retry.status, "completed");
    assert.equal((await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY))?.historyId, HISTORY_START);
    assert.equal(
      callMethods(api).filter((method) => method === "getProfile").length,
      profiles,
    );
  });

  it("preserves the captured cursor across paginated catch-up", async () => {
    const { api, index, attachments, connections } = await seed();
    api.setListPage(null, {
      messages: [{ id: NEW_INBOUND.id, threadId: NEW_INBOUND.threadId }],
      nextPageToken: "catch-2",
    });
    api.setListPage("catch-2", {
      messages: [{ id: NEW_SENT.id, threadId: NEW_SENT.threadId }],
      nextPageToken: null,
    });
    const first = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(first.status, "running");
    const mid = await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY);
    assert.equal(mid?.historyId, null);
    assert.equal(mid?.pageToken, "catch-2");
    assert.equal(mid?.cursorMessageId, encodePendingHistoryCursor(HISTORY_START));
    assert.equal(parsePendingHistoryCursor(mid?.cursorMessageId ?? null), HISTORY_START);

    api.setProfile({ emailAddress: FIXTURE_FOUNDER_EMAIL, historyId: "999" });
    const second = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(second.status, "completed");
    const done = await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY);
    assert.equal(done?.historyId, HISTORY_START);
    assert.equal(done?.pageToken, null);
    assert.equal(done?.cursorMessageId, null);
    assert.equal(await index.getMessage(NEW_INBOUND.id) !== null, true);
    assert.equal(await index.getMessage(NEW_SENT.id) !== null, true);
  });

  it("captures a history-too-old replacement cursor before catch-up", async () => {
    const { api, index, attachments, connections } = await seed();
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    api.errors.set("listHistory", new GmailHttpError(404, "notFound"));
    api.setProfile({ emailAddress: FIXTURE_FOUNDER_EMAIL, historyId: "999" });
    api.setListPage(null, { messages: [], nextPageToken: null });
    const afterInit = api.calls.length;
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assertProfileCapturedBeforeCatchUp(callMethods(api, afterInit));
    assert.equal((await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY))?.historyId, "999");
  });

  it("leaves the old active cursor unchanged when recovery catch-up fails", async () => {
    const { api, index, attachments, connections } = await seed();
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    api.errors.set("listHistory", new GmailHttpError(404, "notFound"));
    api.setProfile({ emailAddress: FIXTURE_FOUNDER_EMAIL, historyId: "999" });
    api.errors.set("listMessages", new Error("recovery-catch-up-crash"));
    const failed = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(failed.status, "failed");
    const crashed = await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY);
    assert.equal(crashed?.historyId, HISTORY_START);
    assert.equal(parsePendingHistoryCursor(crashed?.cursorMessageId ?? null), "999");
  });

  it("activates exactly the pre-catch-up captured cursor after successful recovery", async () => {
    const { api, index, attachments, connections } = await seed();
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    api.errors.set("listHistory", new GmailHttpError(404, "notFound"));
    api.setProfile({ emailAddress: FIXTURE_FOUNDER_EMAIL, historyId: "999" });
    api.setListPage(null, {
      messages: [{ id: NEW_INBOUND.id, threadId: NEW_INBOUND.threadId }],
      nextPageToken: null,
    });
    const recoveringApi = {
      getProfile: () => api.getProfile(),
      listMessages: async (query: Parameters<MockGmailApi["listMessages"]>[0]) => {
        const page = await api.listMessages(query);
        api.setProfile({ emailAddress: FIXTURE_FOUNDER_EMAIL, historyId: "1000" });
        return page;
      },
      listHistory: (query: Parameters<MockGmailApi["listHistory"]>[0]) =>
        api.listHistory(query),
      getMessage: (id: string) => api.getMessage(id),
      getThread: (id: string) => api.getThread(id),
    };
    const recovered = await runIncrementalSync({
      api: recoveringApi,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(recovered.status, "completed");
    assert.equal((await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY))?.historyId, "999");
  });

  it("advances a completed History API drain from the list-history response historyId", async () => {
    const { api, index, attachments, connections } = await seed();
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    api.setProfile({ emailAddress: FIXTURE_FOUNDER_EMAIL, historyId: "999" });
    api.setHistoryPage(HISTORY_START, null, {
      history: [
        {
          id: "101",
          messagesAdded: [
            {
              message: {
                id: NEW_INBOUND.id,
                threadId: NEW_INBOUND.threadId,
                labelIds: ["INBOX"],
              },
            },
          ],
        },
      ],
      nextPageToken: null,
      historyId: HISTORY_NEXT,
    });
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal((await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY))?.historyId, HISTORY_NEXT);
    assert.equal(
      callMethods(api).filter((method) => method === "getProfile").length,
      1,
    );
  });

  it("does not write Persons, projects, Open Jobs, Intake, or CoS", async () => {
    const { api, index, attachments, connections } = await seed();
    const memory = new InMemoryClientMemoryStore();
    const before = await memory.inspectCounts();
    await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.deepEqual(await memory.inspectCounts(), before);
    const source = readFileSync(
      join(process.cwd(), "lib/continuum/gmail/incremental-sync.ts"),
      "utf8",
    );
    assert.doesNotMatch(source, /createPersonAtomic|insertSourceNote|insertWish/);
    assert.doesNotMatch(source, /continuum_person_profiles|continuum_open_jobs/);
    assert.doesNotMatch(source, /continuum_attention_items|continuum_human_sources/);
    assert.doesNotMatch(source, /project-jobs|chief.of.staff|project desk/i);
  });

  it("indexes page 1 then retries safely if continuation checkpoint crashes", async () => {
    const api = readyApi();
    const index = new OneShotContinuationCrashStore();
    const attachments = new InMemoryGmailAttachmentStore();
    const connections = new InMemoryGmailConnectionStore();
    await connected(connections);
    await completeHistorical(index);
    api.setListPage(null, {
      messages: [{ id: NEW_INBOUND.id, threadId: NEW_INBOUND.threadId }],
      nextPageToken: "catch-2",
    });
    api.setListPage("catch-2", {
      messages: [{ id: NEW_SENT.id, threadId: NEW_SENT.threadId }],
      nextPageToken: null,
    });
    const failed = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(failed.status, "failed");
    const crashed = await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY);
    assert.equal(crashed?.historyId, null);
    assert.equal(parsePendingHistoryCursor(crashed?.cursorMessageId ?? null), HISTORY_START);
    assert.equal(await index.getMessage(NEW_INBOUND.id) !== null, true);

    const retry = await runIncrementalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(retry.status, "completed");
    assert.equal((await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY))?.historyId, HISTORY_START);
    assert.equal(await index.getMessage(NEW_SENT.id) !== null, true);
  });
});
