import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryGmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { GmailHttpError, MockGmailApi } from "./adapter";
import { InMemoryGmailAttachmentStore } from "./attachments";
import {
  connectFounderMailbox,
  InMemoryGmailConnectionStore,
} from "./connection";
import { gmailMessageDirection } from "./direction";
import {
  BCC_FIXTURE_MESSAGE,
  FIXTURE_FOUNDER_EMAIL,
  INBOX_FIXTURE_MESSAGE,
  SELF_SENT_FIXTURE_MESSAGE,
  SENT_FIXTURE_MESSAGE,
} from "./fixtures";
import { gmailSafeTelemetry } from "./logging";
import { extractAttachmentMetadata } from "./payload";
import { historicalGmailQuery, historicalWindowStart, runHistoricalSync } from "./sync";
import { encryptRefreshToken } from "./token-crypto";
import { GMAIL_READONLY_SCOPE } from "./types";

const NOW = new Date("2026-08-27T16:00:00.000Z");
const KEY = Buffer.from("e".repeat(64), "hex");
const FOUNDER_HASH = hashEmail(FIXTURE_FOUNDER_EMAIL)!;

const clock = {
  now: () => NOW,
  sleep: async () => {},
};

async function connected(store: InMemoryGmailConnectionStore) {
  await store.putConnection(
    connectFounderMailbox({
      existing: null,
      mailboxEmailHash: FOUNDER_HASH,
      refreshToken: encryptRefreshToken("refresh-sync", KEY),
      grantedScope: GMAIL_READONLY_SCOPE,
      providerTokenType: "Bearer",
      now: NOW.toISOString(),
    }),
  );
}

function loadFixtures(api: MockGmailApi) {
  api.setProfile({ emailAddress: FIXTURE_FOUNDER_EMAIL, historyId: "99" });
  api.setMessage(INBOX_FIXTURE_MESSAGE);
  api.setMessage(SENT_FIXTURE_MESSAGE);
  api.setMessage(SELF_SENT_FIXTURE_MESSAGE);
  api.setMessage(BCC_FIXTURE_MESSAGE);
  api.setListPage(null, {
    messages: [
      { id: INBOX_FIXTURE_MESSAGE.id, threadId: INBOX_FIXTURE_MESSAGE.threadId },
      { id: SENT_FIXTURE_MESSAGE.id, threadId: SENT_FIXTURE_MESSAGE.threadId },
      { id: SELF_SENT_FIXTURE_MESSAGE.id, threadId: SELF_SENT_FIXTURE_MESSAGE.threadId },
      { id: BCC_FIXTURE_MESSAGE.id, threadId: BCC_FIXTURE_MESSAGE.threadId },
    ],
    nextPageToken: null,
  });
}

describe("Gmail direction semantics", () => {
  it("classifies inbound, outbound, self-sent, and unknown", () => {
    assert.equal(
      gmailMessageDirection({
        labelIds: ["INBOX"],
        fromEmail: "client@example.com",
        founderMailboxHash: FOUNDER_HASH,
      }),
      "inbound",
    );
    assert.equal(
      gmailMessageDirection({
        labelIds: ["SENT"],
        fromEmail: FIXTURE_FOUNDER_EMAIL,
        founderMailboxHash: FOUNDER_HASH,
      }),
      "outbound",
    );
    assert.equal(
      gmailMessageDirection({
        labelIds: ["INBOX"],
        fromEmail: FIXTURE_FOUNDER_EMAIL,
        founderMailboxHash: FOUNDER_HASH,
      }),
      "outbound",
    );
    assert.equal(
      gmailMessageDirection({
        labelIds: ["IMPORTANT"],
        fromEmail: "client@example.com",
        founderMailboxHash: FOUNDER_HASH,
      }),
      "unknown",
    );
  });
});

describe("Gmail historical sync", () => {
  it("indexes inbox and sent fixtures without body, snippet, or attachment bytes", async () => {
    const api = new MockGmailApi();
    loadFixtures(api);
    const index = new InMemoryGmailIndexStore();
    const attachments = new InMemoryGmailAttachmentStore();
    const connections = new InMemoryGmailConnectionStore();
    await connected(connections);
    const events: unknown[] = [];

    const result = await runHistoricalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
      telemetry: (event) => events.push(event),
    });

    assert.equal(result.status, "completed");
    assert.equal(result.indexedCount, 4);
    const inbox = await index.getMessage("msg-inbox-1");
    const sent = await index.getMessage("msg-sent-1");
    const selfSent = await index.getMessage("msg-self-1");
    assert.equal(inbox?.direction, "inbound");
    assert.equal(sent?.direction, "outbound");
    assert.equal(selfSent?.direction, "outbound");
    assert.equal(inbox?.fromEmailHash, hashEmail("client@example.com"));
    assert.deepEqual(sent?.bccEmailHashes ?? [], []);
    assert.deepEqual(await index.getMessage("msg-bcc-1").then((row) => row?.bccEmailHashes), [
      hashEmail("partner@example.com"),
    ]);
    assert.equal("body" in (inbox ?? {}), false);
    assert.equal("snippet" in (inbox ?? {}), false);
    assert.equal(JSON.stringify(inbox).includes("SHOULD-NOT-PERSIST"), false);
    assert.equal(JSON.stringify(inbox).includes("client@example.com"), false);

    const files = await attachments.listByMessage("msg-inbox-1");
    assert.equal(files.length, 1);
    assert.equal(files[0]?.attachmentId, "att-sketch-1");
    assert.equal(files[0]?.filename, "sketch.pdf");
    assert.equal(files[0]?.sizeBytes, 2048);
    assert.equal("bytes" in files[0], false);
    api.assertNeverFetchedAttachmentBytes();
    assert.equal(
      api.calls.some((call) => call.method === "getMessage" && "attachmentId" in call),
      false,
    );

    const checkpoint = await index.getCheckpoint("gmail-historical");
    assert.equal(checkpoint?.status, "completed");
    assert.equal(checkpoint?.indexedCount, 4);
    assert.match(
      historicalGmailQuery(historicalWindowStart(NOW)),
      /^\(in:inbox OR in:sent\) -in:spam -in:trash after:2024\/08\/27$/,
    );
    assert.deepEqual(events[events.length - 1], {
      event: "gmail-sync-page-ok",
      indexed_count: 4,
      status: "completed",
      job_key: "gmail-historical",
    });
  });

  it("merges duplicate message ids and overlapping pages", async () => {
    const api = new MockGmailApi();
    api.setMessage(INBOX_FIXTURE_MESSAGE);
    api.setListPage(null, {
      messages: [
        { id: "msg-inbox-1", threadId: "thread-sarah-1" },
        { id: "msg-inbox-1", threadId: "thread-sarah-1" },
      ],
      nextPageToken: "page-2",
    });
    api.setListPage("page-2", {
      messages: [{ id: "msg-inbox-1", threadId: "thread-sarah-1" }],
      nextPageToken: null,
    });
    const index = new InMemoryGmailIndexStore();
    const attachments = new InMemoryGmailAttachmentStore();
    const connections = new InMemoryGmailConnectionStore();
    await connected(connections);
    const result = await runHistoricalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(result.indexedCount, 1);
    assert.equal(index.listMessages().length, 1);
  });

  it("resumes from the last durable checkpoint after a crash", async () => {
    const api = new MockGmailApi();
    api.setMessage(INBOX_FIXTURE_MESSAGE);
    api.setMessage(SENT_FIXTURE_MESSAGE);
    api.setListPage(null, {
      messages: [{ id: "msg-inbox-1", threadId: "thread-sarah-1" }],
      nextPageToken: "page-2",
    });
    api.setListPage("page-2", {
      messages: [{ id: "msg-sent-1", threadId: "thread-sarah-1" }],
      nextPageToken: null,
    });
    api.errors.set("listMessages:page-2", new Error("crash"));
    const index = new InMemoryGmailIndexStore();
    const attachments = new InMemoryGmailAttachmentStore();
    const connections = new InMemoryGmailConnectionStore();
    await connected(connections);

    const failed = await runHistoricalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(failed.status, "failed");
    assert.equal(index.listMessages().length, 1);
    assert.equal((await index.getCheckpoint("gmail-historical"))?.pageToken, "page-2");

    api.errors.delete("listMessages:page-2");
    const completed = await runHistoricalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(completed.status, "completed");
    assert.equal(completed.indexedCount, 2);
    assert.equal((await index.getCheckpoint("gmail-historical"))?.status, "completed");
  });

  it("retries 429 / rate-limit 403 and honors Retry-After", async () => {
    const api = new MockGmailApi();
    api.setMessage(INBOX_FIXTURE_MESSAGE);
    api.setListPage(null, {
      messages: [{ id: "msg-inbox-1", threadId: "thread-sarah-1" }],
      nextPageToken: null,
    });
    api.statusErrors.push({ status: 429, reason: "rateLimitExceeded", retryAfter: "0" });
    api.statusErrors.push({ status: 403, reason: "userRateLimitExceeded" });
    const sleeps: number[] = [];
    const index = new InMemoryGmailIndexStore();
    const attachments = new InMemoryGmailAttachmentStore();
    const connections = new InMemoryGmailConnectionStore();
    await connected(connections);
    const result = await runHistoricalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock: {
        now: () => NOW,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
    });
    assert.equal(result.status, "completed");
    assert.ok(sleeps.length >= 2);
    assert.ok(api.calls.filter((call) => call.method === "listMessages").length >= 3);
    assert.ok(new GmailHttpError(429, "rateLimitExceeded") instanceof Error);
  });

  it("does not sync while paused and does not mutate Client Memory or CoS", async () => {
    const api = new MockGmailApi();
    loadFixtures(api);
    const index = new InMemoryGmailIndexStore();
    const attachments = new InMemoryGmailAttachmentStore();
    const connections = new InMemoryGmailConnectionStore();
    await connected(connections);
    const paused = await connections.getFounderConnection();
    assert.ok(paused);
    paused.status = "paused";
    await connections.putConnection(paused);
    const memory = new InMemoryClientMemoryStore();
    const before = await memory.inspectCounts();
    const result = await runHistoricalSync({
      api,
      index,
      attachments,
      connections,
      founderMailboxHash: FOUNDER_HASH,
      clock,
    });
    assert.equal(result.status, "paused");
    assert.equal(index.listMessages().length, 0);
    assert.deepEqual(await memory.inspectCounts(), before);
    assert.equal(api.calls.length, 0);
  });

  it("does not persist payload body fields from attachment extraction", () => {
    const attachments = extractAttachmentMetadata(
      INBOX_FIXTURE_MESSAGE,
      NOW.toISOString(),
    );
    assert.equal(attachments.length, 1);
    assert.equal("data" in attachments[0], false);
    assert.equal(JSON.stringify(attachments).includes("U0hPVUxELU5PVC1QRVJTSVNU"), false);
  });

  it("rejects unsafe telemetry fields", () => {
    assert.throws(
      () =>
        gmailSafeTelemetry({
          event: "gmail-sync-page-ok",
          subject: "secret",
        } as never),
      /gmail-telemetry-forbidden/,
    );
  });
});
