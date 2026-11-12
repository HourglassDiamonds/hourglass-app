import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";
import {
  ConnectorEvidenceValidationError,
  createConnectorEvidenceBatch,
  validateConnectorEvidenceEnvelope,
} from "./connector-evidence-envelope";
import { NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS } from "./operational-reconciliation-scope";

const MAILBOX_HASH = createHash("sha256").update("founder@example.test").digest("hex");

function envelope() {
  return {
    version: "continuum-gmail-connector-evidence-v1",
    mailbox: { emailHash: MAILBOX_HASH, verifiedAt: "2026-11-12T14:00:00Z",
      verificationSource: "gmail_connector_profile" },
    retrieval: { startedAt: "2026-11-12T14:00:01Z", completedAt: "2026-11-12T14:01:00Z" },
    threads: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS.map((threadId, index) => ({
      threadId,
      retrievedAt: `2026-11-12T14:00:${String(index + 3).padStart(2, "0")}Z`,
      coverage: { status: "complete", basis: "pagination_exhausted", pageCount: 1,
        returnedMessageCount: index === 0 ? 2 : 1, nextPageTokenPresent: false },
      messages: [
        {
          threadId,
          messageId: `${threadId}-message-1`,
          sentAt: "2026-11-11T12:00:00Z",
          fromRaw: "Synthetic Sender <sender@example.test>",
          fromEmail: "sender@example.test",
          to: ["founder@example.test"],
          cc: [],
          subject: "Synthetic evidence",
          plainText: "Synthetic correspondence body",
          bodyExtractionStatus: "decoded_plaintext",
          snippet: "Synthetic snippet",
          attachments: [],
        },
        ...(index === 0 ? [{
          threadId,
          messageId: `${threadId}-newer-unindexed-message`,
          sentAt: "2026-11-12T12:00:00+00:00",
          fromRaw: "Synthetic Sender <sender@example.test>",
          fromEmail: "sender@example.test",
          to: ["founder@example.test"],
          cc: [],
          subject: "Newer synthetic evidence",
          plainText: "Newer synthetic correspondence body",
          bodyExtractionStatus: "decoded_plaintext",
          snippet: null,
          attachments: [],
        }] : []),
      ],
    })),
  };
}

function rejects(value: unknown, code: string) {
  assert.throws(
    () => validateConnectorEvidenceEnvelope({ value, expectedMailboxHash: MAILBOX_HASH,
      allowedThreadIds: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS }),
    (error) => error instanceof ConnectorEvidenceValidationError && error.safeCode === code,
  );
}

describe("connector evidence envelope", () => {
  it("validates exact scope and returns newer messages absent from the index", async () => {
    const parsed = validateConnectorEvidenceEnvelope({ value: envelope(), expectedMailboxHash: MAILBOX_HASH,
      allowedThreadIds: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS });
    const batch = createConnectorEvidenceBatch(parsed);
    const threadId = NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS[0];
    const fetched = await batch.fetchCompleteThread!({ threadId, indexed: [{
      threadId, messageId: `${threadId}-message-1`, sentAt: "2026-11-11T12:00:00Z", subject: "Synthetic evidence",
    }] });
    assert.equal(fetched.ok, true);
    if (!fetched.ok) return;
    assert.deepEqual(fetched.messages.map((row) => row.messageId), [
      `${threadId}-message-1`, `${threadId}-newer-unindexed-message`,
    ]);
    assert.equal(fetched.retrievedAt, "2026-11-12T14:00:03Z");
  });

  it("rejects wrong mailbox, missing or extra threads, duplicate messages, malformed timestamps and chronology", () => {
    const wrongMailbox = envelope(); wrongMailbox.mailbox.emailHash = "0".repeat(64);
    rejects(wrongMailbox, "connector-mailbox-mismatch");

    const missing = envelope(); missing.threads.pop();
    rejects(missing, "connector-thread-scope-mismatch");

    const extra = envelope();
    const extraThreads = extra.threads as unknown as Array<{ threadId: string; messages: Array<{
      threadId: string; messageId: string; [key: string]: unknown;
    }>; [key: string]: unknown }>;
    extraThreads.push({ ...extraThreads[0]!, threadId: "outside-scope",
      messages: extraThreads[0]!.messages.map((row) => ({ ...row, threadId: "outside-scope",
        messageId: `outside-${row.messageId}` })) });
    rejects(extra, "connector-thread-scope-mismatch");

    const duplicate = envelope(); duplicate.threads[1]!.messages[0]!.messageId = duplicate.threads[0]!.messages[0]!.messageId;
    rejects(duplicate, "connector-message-duplicate");

    const malformed = envelope(); malformed.threads[0]!.messages[0]!.sentAt = "not-a-time";
    rejects(malformed, "connector-message-timestamp-invalid");

    const chronology = envelope(); chronology.threads[0]!.messages[1]!.sentAt = "2026-11-10T12:00:00Z";
    rejects(chronology, "connector-message-chronology-invalid");
  });

  it("does not accept an invented completeness claim and blocks unknown coverage", async () => {
    const invented = envelope();
    invented.threads[0]!.coverage.basis = "unknown";
    rejects(invented, "connector-thread-completeness-unproven");

    const unknown = envelope();
    const unknownCoverage = unknown.threads[0]!.coverage as {
      status: string; basis: string; pageCount: number; returnedMessageCount: number;
      nextPageTokenPresent: boolean | null;
    };
    unknownCoverage.status = "unknown";
    unknownCoverage.basis = "unknown";
    unknownCoverage.nextPageTokenPresent = null;
    const parsed = validateConnectorEvidenceEnvelope({ value: unknown, expectedMailboxHash: MAILBOX_HASH,
      allowedThreadIds: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS });
    const threadId = NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS[0];
    const fetched = await createConnectorEvidenceBatch(parsed).fetchCompleteThread!({ threadId, indexed: [] });
    assert.deepEqual(fetched, { ok: false, safeErrorCode: "unavailable" });
  });

  it("preserves body-incomplete status for the existing evidence gate", async () => {
    const input = envelope();
    input.threads[0]!.messages[0]!.bodyExtractionStatus = "decode_failed";
    const parsed = validateConnectorEvidenceEnvelope({ value: input, expectedMailboxHash: MAILBOX_HASH,
      allowedThreadIds: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS });
    const threadId = NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS[0];
    const fetched = await createConnectorEvidenceBatch(parsed).fetchCompleteThread!({ threadId, indexed: [] });
    assert.equal(fetched.ok && fetched.messages[0]?.bodyExtractionStatus, "decode_failed");
  });
});
