import { createHash } from "node:crypto";
import type { LiveSourceViewerBatch } from "@/lib/continuum/gmail/source-viewer-run";
import type { GmailBodyExtractionStatus } from "@/lib/continuum/gmail/live-extraction-diagnostics";

export const CONNECTOR_EVIDENCE_ENVELOPE_VERSION = "continuum-gmail-connector-evidence-v1" as const;

export type ConnectorCoverageBasis = "provider_complete" | "pagination_exhausted" | "unknown";

export type ConnectorEvidenceMessage = {
  threadId: string;
  messageId: string;
  sentAt: string;
  fromRaw: string | null;
  fromEmail: string | null;
  to: readonly string[];
  cc: readonly string[];
  subject: string | null;
  plainText: string | null;
  bodyExtractionStatus: GmailBodyExtractionStatus;
  snippet: string | null;
  attachments: readonly { filename: string | null; mimeType: string | null }[];
};

export type ConnectorEvidenceThread = {
  threadId: string;
  retrievedAt: string;
  coverage: {
    status: "complete" | "unknown";
    basis: ConnectorCoverageBasis;
    pageCount: number;
    returnedMessageCount: number;
    nextPageTokenPresent: boolean | null;
  };
  messages: readonly ConnectorEvidenceMessage[];
};

export type ConnectorEvidenceEnvelope = {
  version: typeof CONNECTOR_EVIDENCE_ENVELOPE_VERSION;
  mailbox: {
    emailHash: string;
    verifiedAt: string;
    verificationSource: "gmail_connector_profile";
  };
  retrieval: {
    startedAt: string;
    completedAt: string;
  };
  threads: readonly ConnectorEvidenceThread[];
};

export class ConnectorEvidenceValidationError extends Error {
  constructor(readonly safeCode: string) {
    super(safeCode);
    this.name = "ConnectorEvidenceValidationError";
  }
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConnectorEvidenceValidationError(code);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ConnectorEvidenceValidationError(code);
  return value;
}

function nullableText(value: unknown, code: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new ConnectorEvidenceValidationError(code);
  return value;
}

function stringList(value: unknown, code: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new ConnectorEvidenceValidationError(code);
  }
  return [...value] as string[];
}

function isoTimestamp(value: unknown, code: string): string {
  const candidate = text(value, code);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(candidate) ||
      !Number.isFinite(Date.parse(candidate))) {
    throw new ConnectorEvidenceValidationError(code);
  }
  return candidate;
}

function nullableBoolean(value: unknown, code: string): boolean | null {
  if (value === null || typeof value === "boolean") return value;
  throw new ConnectorEvidenceValidationError(code);
}

function integer(value: unknown, code: string, minimum: number): number {
  if (!Number.isInteger(value) || Number(value) < minimum) throw new ConnectorEvidenceValidationError(code);
  return Number(value);
}

function parseMessage(value: unknown, threadId: string): ConnectorEvidenceMessage {
  const row = record(value, "connector-message-invalid");
  if (text(row.threadId, "connector-message-thread-id-invalid") !== threadId) {
    throw new ConnectorEvidenceValidationError("connector-message-thread-mismatch");
  }
  const bodyExtractionStatus = text(row.bodyExtractionStatus, "connector-message-body-status-invalid");
  if (!["decoded_plaintext", "decoded_html", "empty", "unsupported", "decode_failed"].includes(bodyExtractionStatus)) {
    throw new ConnectorEvidenceValidationError("connector-message-body-status-invalid");
  }
  if (!Array.isArray(row.attachments)) throw new ConnectorEvidenceValidationError("connector-message-attachments-invalid");
  const attachments = row.attachments.map((value) => {
    const attachment = record(value, "connector-message-attachment-invalid");
    return {
      filename: nullableText(attachment.filename, "connector-message-attachment-invalid"),
      mimeType: nullableText(attachment.mimeType, "connector-message-attachment-invalid"),
    };
  });
  return {
    threadId,
    messageId: text(row.messageId, "connector-message-id-invalid"),
    sentAt: isoTimestamp(row.sentAt, "connector-message-timestamp-invalid"),
    fromRaw: nullableText(row.fromRaw, "connector-message-from-invalid"),
    fromEmail: nullableText(row.fromEmail, "connector-message-from-invalid"),
    to: stringList(row.to, "connector-message-recipients-invalid"),
    cc: stringList(row.cc, "connector-message-recipients-invalid"),
    subject: nullableText(row.subject, "connector-message-subject-invalid"),
    plainText: nullableText(row.plainText, "connector-message-body-invalid"),
    bodyExtractionStatus: bodyExtractionStatus as GmailBodyExtractionStatus,
    snippet: nullableText(row.snippet, "connector-message-snippet-invalid"),
    attachments,
  };
}

function parseThread(value: unknown): ConnectorEvidenceThread {
  const row = record(value, "connector-thread-invalid");
  const threadId = text(row.threadId, "connector-thread-id-invalid");
  const coverageRow = record(row.coverage, "connector-thread-coverage-invalid");
  const status = text(coverageRow.status, "connector-thread-coverage-invalid");
  const basis = text(coverageRow.basis, "connector-thread-coverage-invalid");
  if (status !== "complete" && status !== "unknown") {
    throw new ConnectorEvidenceValidationError("connector-thread-coverage-invalid");
  }
  if (basis !== "provider_complete" && basis !== "pagination_exhausted" && basis !== "unknown") {
    throw new ConnectorEvidenceValidationError("connector-thread-coverage-invalid");
  }
  const nextPageTokenPresent = nullableBoolean(
    coverageRow.nextPageTokenPresent,
    "connector-thread-coverage-invalid",
  );
  const pageCount = integer(coverageRow.pageCount, "connector-thread-coverage-invalid", 1);
  const returnedMessageCount = integer(coverageRow.returnedMessageCount, "connector-thread-coverage-invalid", 0);
  if (status === "complete" &&
      (basis === "unknown" || nextPageTokenPresent !== false)) {
    throw new ConnectorEvidenceValidationError("connector-thread-completeness-unproven");
  }
  if (status === "unknown" && basis !== "unknown") {
    throw new ConnectorEvidenceValidationError("connector-thread-coverage-contradictory");
  }
  if (!Array.isArray(row.messages)) throw new ConnectorEvidenceValidationError("connector-thread-messages-invalid");
  const messages = row.messages.map((message) => parseMessage(message, threadId));
  if (returnedMessageCount !== messages.length) {
    throw new ConnectorEvidenceValidationError("connector-thread-message-count-mismatch");
  }
  if (status === "complete" && messages.length === 0) {
    throw new ConnectorEvidenceValidationError("connector-thread-complete-empty");
  }
  for (let index = 1; index < messages.length; index += 1) {
    const prior = messages[index - 1]!;
    const current = messages[index]!;
    if (Date.parse(current.sentAt) < Date.parse(prior.sentAt)) {
      throw new ConnectorEvidenceValidationError("connector-message-chronology-invalid");
    }
  }
  return {
    threadId,
    retrievedAt: isoTimestamp(row.retrievedAt, "connector-thread-retrieved-at-invalid"),
    coverage: {
      status,
      basis: basis as ConnectorCoverageBasis,
      pageCount,
      returnedMessageCount,
      nextPageTokenPresent,
    },
    messages,
  };
}

export function validateConnectorEvidenceEnvelope(input: {
  value: unknown;
  expectedMailboxHash: string;
  allowedThreadIds: readonly string[];
}): ConnectorEvidenceEnvelope {
  const root = record(input.value, "connector-envelope-invalid");
  if (root.version !== CONNECTOR_EVIDENCE_ENVELOPE_VERSION) {
    throw new ConnectorEvidenceValidationError("connector-envelope-version-invalid");
  }
  const mailbox = record(root.mailbox, "connector-mailbox-invalid");
  const emailHash = text(mailbox.emailHash, "connector-mailbox-invalid").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(emailHash) || emailHash !== input.expectedMailboxHash.toLowerCase()) {
    throw new ConnectorEvidenceValidationError("connector-mailbox-mismatch");
  }
  if (mailbox.verificationSource !== "gmail_connector_profile") {
    throw new ConnectorEvidenceValidationError("connector-mailbox-verification-invalid");
  }
  const retrieval = record(root.retrieval, "connector-retrieval-invalid");
  const startedAt = isoTimestamp(retrieval.startedAt, "connector-retrieval-start-invalid");
  const completedAt = isoTimestamp(retrieval.completedAt, "connector-retrieval-complete-invalid");
  if (Date.parse(completedAt) < Date.parse(startedAt)) {
    throw new ConnectorEvidenceValidationError("connector-retrieval-chronology-invalid");
  }
  if (!Array.isArray(root.threads)) throw new ConnectorEvidenceValidationError("connector-threads-invalid");
  const threads = root.threads.map(parseThread);
  if (threads.some((thread) => Date.parse(thread.retrievedAt) < Date.parse(startedAt) ||
      Date.parse(thread.retrievedAt) > Date.parse(completedAt))) {
    throw new ConnectorEvidenceValidationError("connector-thread-retrieval-time-outside-envelope");
  }
  const expected = [...input.allowedThreadIds];
  const actual = threads.map((thread) => thread.threadId);
  if (new Set(actual).size !== actual.length) throw new ConnectorEvidenceValidationError("connector-thread-duplicate");
  if (actual.length !== expected.length || expected.some((threadId) => !actual.includes(threadId)) ||
      actual.some((threadId) => !expected.includes(threadId))) {
    throw new ConnectorEvidenceValidationError("connector-thread-scope-mismatch");
  }
  const messageIds = threads.flatMap((thread) => thread.messages.map((message) => message.messageId));
  if (new Set(messageIds).size !== messageIds.length) {
    throw new ConnectorEvidenceValidationError("connector-message-duplicate");
  }
  return {
    version: CONNECTOR_EVIDENCE_ENVELOPE_VERSION,
    mailbox: {
      emailHash,
      verifiedAt: isoTimestamp(mailbox.verifiedAt, "connector-mailbox-verified-at-invalid"),
      verificationSource: "gmail_connector_profile",
    },
    retrieval: { startedAt, completedAt },
    threads,
  };
}

export function connectorEvidenceSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function createConnectorEvidenceBatch(envelope: ConnectorEvidenceEnvelope): LiveSourceViewerBatch {
  const byThread = new Map(envelope.threads.map((thread) => [thread.threadId, thread]));
  const metrics = { threadFetches: 0 };
  const fetchCompleteThread: LiveSourceViewerBatch["fetchThread"] = async ({ threadId, indexed }) => {
    metrics.threadFetches += 1;
    const thread = byThread.get(threadId);
    if (!thread || thread.coverage.status !== "complete") {
      return { ok: false, safeErrorCode: "unavailable" };
    }
    return {
      ok: true,
      safeErrorCode: null,
      threadId,
      indexedSubject: indexed.at(-1)?.subject ?? thread.messages.at(-1)?.subject ?? null,
      messages: thread.messages.map((message) => ({
        messageId: message.messageId,
        fromRaw: message.fromRaw,
        fromEmail: message.fromEmail,
        to: message.to,
        cc: message.cc,
        subject: message.subject,
        sentAt: message.sentAt,
        plainText: message.plainText,
        bodyExtractionStatus: message.bodyExtractionStatus,
        snippet: message.snippet,
        attachments: message.attachments,
      })),
      retrievedAt: thread.retrievedAt,
      plaintextPersisted: false,
      gmailMutation: false,
      cursorUnchanged: true,
      readOnly: true,
    };
  };
  return { credentialLoads: 1, metrics, fetchThread: fetchCompleteThread, fetchCompleteThread };
}
