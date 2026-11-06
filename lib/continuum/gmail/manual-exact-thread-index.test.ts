import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryGmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import { MockGmailApi } from "./adapter";
import { InMemoryGmailAttachmentStore } from "./attachments";
import type { GmailConnectionStore } from "./connection";
import {
  indexOneFounderReviewedThread,
  MANUAL_EXACT_THREAD_MAX_MESSAGES,
  PENNOCK_DIRECT_THREAD_ID,
} from "./manual-exact-thread-index";
import type { GmailApiMessage, GmailConnection } from "./types";

const NOW = "2026-11-06T18:00:00.000Z";
const wrapped = { alg: "aes-256-gcm" as const, version: 1 as const, iv: "iv", tag: "tag", ciphertext: "cipher" };

function connection(): GmailConnection {
  return {
    connectionId: "connection",
    mailboxSlot: "founder-v1",
    mailboxEmailHash: "founder-hash",
    status: "connected",
    refreshToken: wrapped,
    grantedScope: "https://www.googleapis.com/auth/gmail.readonly",
    providerTokenType: "Bearer",
    connectedAt: "2026-11-04T15:00:50.000Z",
    updatedAt: NOW,
    lastSyncAt: null,
    statusErrorCode: null,
  };
}

function connections(): GmailConnectionStore {
  let row = connection();
  return {
    getFounderConnection: async () => row,
    putConnection: async (next) => (row = next),
  };
}

function message(id: string, from: string, to: string, labels: string[]): GmailApiMessage {
  return {
    id,
    threadId: PENNOCK_DIRECT_THREAD_ID,
    internalDate: String(Date.parse("2026-08-07T16:20:00.000Z")),
    labelIds: labels,
    payload: {
      headers: [
        { name: "From", value: from },
        { name: "To", value: to },
        { name: "Subject", value: "Sapphire / Platinum Ring" },
      ],
    },
  };
}

function base(api: MockGmailApi, index = new InMemoryGmailIndexStore()) {
  return {
    founderAuthenticated: true,
    betaRecoveryPreviewVerified: true,
    threadId: PENNOCK_DIRECT_THREAD_ID,
    connections: connections(),
    index,
    attachments: new InMemoryGmailAttachmentStore(),
    decryptRefreshToken: () => "refresh-token",
    refreshAccessToken: async () => ({ ok: true as const, accessToken: "access-token" }),
    createApi: () => api,
    nowIso: NOW,
  };
}

describe("founder-reviewed exact Gmail thread indexing", () => {
  it("indexes only the approved exact thread without changing the mailbox checkpoint", async () => {
    const api = new MockGmailApi();
    api.setThread({
      id: PENNOCK_DIRECT_THREAD_ID,
      messages: [
        message("19fdca8cab1dfd8e", "justin@hourglassdiamonds.com", "pennock3@gmail.com", ["SENT"]),
        message("19fdd06c3922215e", "pennock3@gmail.com", "justin@hourglassdiamonds.com", ["INBOX"]),
      ],
    });
    const index = new InMemoryGmailIndexStore();
    await index.putCheckpoint({
      jobKey: "gmail-memory-daily", status: "completed", windowStart: null, windowEnd: NOW,
      pageToken: null, historyId: "fresh-cursor", cursorMessageId: null, indexedCount: 1452,
      updatedAt: NOW, errorCode: null,
    });
    const before = await index.getCheckpoint("gmail-memory-daily");
    const first = await indexOneFounderReviewedThread(base(api, index));
    const second = await indexOneFounderReviewedThread(base(api, index));
    assert.deepEqual(first, {
      ok: true, status: "indexed", safeErrorCode: null, messageCount: 2,
      insertedCount: 2, updatedCount: 0, alreadyPresentCount: 0, droppedCount: 0,
    });
    assert.equal(second.insertedCount, 0);
    assert.equal(second.alreadyPresentCount, 2);
    assert.deepEqual(await index.getCheckpoint("gmail-memory-daily"), before);
    assert.deepEqual((await index.listMessagesByThread(PENNOCK_DIRECT_THREAD_ID)).map((row) => row.messageId).sort(), ["19fdca8cab1dfd8e", "19fdd06c3922215e"]);
    assert.deepEqual([...new Set(api.calls.map((call) => call.method))], ["getThread"]);
  });

  it("fails closed outside Preview, without founder auth, for other threads, or above the bound", async () => {
    const api = new MockGmailApi();
    const common = base(api);
    assert.equal((await indexOneFounderReviewedThread({ ...common, founderAuthenticated: false })).safeErrorCode, "unauthorized");
    assert.equal((await indexOneFounderReviewedThread({ ...common, betaRecoveryPreviewVerified: false })).safeErrorCode, "not-beta-recovery-preview");
    assert.equal((await indexOneFounderReviewedThread({ ...common, threadId: "1a10c5b8e4a52db7" })).safeErrorCode, "thread-not-approved");
    api.setThread({ id: PENNOCK_DIRECT_THREAD_ID, messages: Array.from({ length: MANUAL_EXACT_THREAD_MAX_MESSAGES + 1 }, (_, i) => message(`m${i}`, "pennock3@gmail.com", "justin@hourglassdiamonds.com", ["INBOX"])) });
    assert.equal((await indexOneFounderReviewedThread(common)).safeErrorCode, "thread-integrity-failed");
  });
});
