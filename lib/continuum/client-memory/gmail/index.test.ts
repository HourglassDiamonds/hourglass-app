import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findPiiViolation } from "../../contracts/validation";
import { hashEmail } from "../hashes";
import { InMemoryClientMemoryStore } from "../store";
import {
  GMAIL_SOURCE_SYSTEM,
  buildGmailIndexedMessage,
  gmailParticipantHashesFromAddresses,
  gmailSourceRecordPointers,
} from "./index";
import { InMemoryGmailIndexStore } from "./store";

const NOW = "2026-08-25T12:00:00.000Z";
const SENT = "2026-08-24T15:04:05.000Z";

function sampleInput(
  overrides: Partial<Parameters<typeof buildGmailIndexedMessage>[0]> = {},
): Parameters<typeof buildGmailIndexedMessage>[0] {
  return {
    messageId: "18abc123def456",
    threadId: "thread-sarah-1",
    sentAt: SENT,
    subject: "Anniversary band",
    fromEmail: "client@example.com",
    toEmails: ["justin@example.com", "justin@example.com"],
    ccEmails: ["studio@example.com"],
    direction: "inbound",
    labelIds: ["INBOX", "INBOX"],
    hasAttachments: false,
    ...overrides,
  };
}

describe("Protected Gmail source index", () => {
  it("indexes one message id once and hashes participants", async () => {
    const store = new InMemoryGmailIndexStore();
    const first = await store.indexMessage(sampleInput(), NOW);
    assert.equal(first.status, "inserted");
    const second = await store.indexMessage(sampleInput(), "2026-08-25T13:00:00.000Z");
    assert.equal(second.status, "already-present");
    assert.equal(store.listMessages().length, 1);
    assert.equal(first.record.sourceSystem, GMAIL_SOURCE_SYSTEM);
    assert.equal(first.record.fromEmailHash, hashEmail("client@example.com"));
    assert.deepEqual(first.record.toEmailHashes, [
      hashEmail("justin@example.com"),
    ]);
    assert.equal(first.record.toEmailHashes.length, 1);
    const serialized = JSON.stringify(first.record);
    assert.equal(serialized.includes("client@example.com"), false);
    assert.equal(serialized.includes("justin@example.com"), false);
    assert.equal("body" in first.record, false);
  });

  it("stores two messages on the same thread", async () => {
    const store = new InMemoryGmailIndexStore();
    await store.indexMessage(sampleInput({ messageId: "msg-1" }), NOW);
    await store.indexMessage(
      sampleInput({
        messageId: "msg-2",
        sentAt: "2026-08-24T16:00:00.000Z",
        direction: "outbound",
      }),
      NOW,
    );
    const thread = await store.listMessagesByThread("thread-sarah-1");
    assert.equal(thread.length, 2);
    assert.equal(store.listMessages().length, 2);
  });

  it("keeps historical and daily checkpoints separate", async () => {
    const store = new InMemoryGmailIndexStore();
    await store.putCheckpoint({
      jobKey: "gmail-historical",
      status: "running",
      windowStart: "2024-01-01T00:00:00.000Z",
      windowEnd: "2024-02-01T00:00:00.000Z",
      pageToken: "page-a",
      historyId: null,
      cursorMessageId: "msg-1",
      indexedCount: 12,
      updatedAt: NOW,
      errorCode: null,
    });
    await store.putCheckpoint({
      jobKey: "gmail-memory-daily",
      status: "completed",
      windowStart: "2026-08-24T00:00:00.000Z",
      windowEnd: "2026-08-25T00:00:00.000Z",
      pageToken: null,
      historyId: "12345678901234567",
      cursorMessageId: "msg-9",
      indexedCount: 4,
      updatedAt: NOW,
      errorCode: null,
    });
    const historical = await store.getCheckpoint("gmail-historical");
    const daily = await store.getCheckpoint("gmail-memory-daily");
    assert.equal(historical?.pageToken, "page-a");
    assert.equal(daily?.historyId, "12345678901234567");
    assert.notEqual(historical?.jobKey, daily?.jobKey);
  });

  it("updates safe metadata and rejects immutable identifier drift", async () => {
    const store = new InMemoryGmailIndexStore();
    await store.indexMessage(sampleInput(), NOW);
    const labels = await store.indexMessage(
      sampleInput({ labelIds: ["INBOX", "IMPORTANT"], hasAttachments: true }),
      "2026-08-25T13:00:00.000Z",
    );
    assert.equal(labels.status, "updated");
    assert.equal(labels.record.hasAttachments, true);
    assert.equal(labels.record.indexedAt, NOW);
    assert.deepEqual([...labels.record.labelIds], ["INBOX", "IMPORTANT"]);

    const conflict = await store.indexMessage(
      sampleInput({ threadId: "other-thread" }),
      NOW,
    );
    assert.equal(conflict.status, "conflict");
    if (conflict.status === "conflict") {
      assert.equal(conflict.field, "threadId");
    }
    assert.equal((await store.getMessage("18abc123def456"))?.threadId, "thread-sarah-1");
  });

  it("hashes the same address deterministically and skips invalid emails", () => {
    const once = gmailParticipantHashesFromAddresses({
      fromEmail: "Ada@Example.COM",
      toEmails: ["not-an-email", "ada@example.com"],
    });
    const twice = gmailParticipantHashesFromAddresses({
      fromEmail: "ada@example.com",
      toEmails: ["ada@example.com"],
    });
    assert.equal(once.fromEmailHash, twice.fromEmailHash);
    assert.equal(once.fromEmailHash, hashEmail("ada@example.com"));
    assert.deepEqual([...once.toEmailHashes], [hashEmail("ada@example.com")]);
    assert.throws(
      () =>
        buildGmailIndexedMessage(
          sampleInput({ messageId: "client@example.com" }),
          NOW,
        ),
      /gmail-message-id-invalid/,
    );
  });

  it("exposes kernel evidence pointers without subject or addresses", () => {
    const message = buildGmailIndexedMessage(sampleInput(), NOW);
    const pointers = gmailSourceRecordPointers(message);
    assert.equal(pointers.sourceSystem, "gmail");
    assert.equal(pointers.sourceKind, "source-record");
    assert.equal(pointers.sourceRecordId, message.messageId);
    assert.equal(pointers.supportingPointer, message.threadId);
    assert.equal(findPiiViolation(pointers), null);
    assert.equal("subject" in pointers, false);
  });

  it("does not write canonical Client Memory when indexing", async () => {
    const memory = new InMemoryClientMemoryStore();
    const gmail = new InMemoryGmailIndexStore();
    const before = await memory.inspectCounts();
    await gmail.indexMessage(sampleInput(), NOW);
    const after = await memory.inspectCounts();
    assert.deepEqual(after, before);
    assert.equal(after.persons, 0);
    assert.equal(after.facts, 0);
    assert.equal(after.wishes, 0);
    assert.equal(after.notes, 0);
    assert.equal(after.relationships, 0);
    assert.equal(after.projects, 0);
    assert.equal(after.identities, 0);
    assert.equal(after.reviews, 0);
  });
});
