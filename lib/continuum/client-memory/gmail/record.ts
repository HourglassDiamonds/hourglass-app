/**
 * Domain helpers for the protected Gmail source index.
 * Hashes participants with the existing Client Memory email contract.
 * Does not call Gmail, OAuth, or write canonical Client Memory.
 */

import { hashEmail } from "../hashes";
import {
  GMAIL_CHECKPOINT_JOB_KEYS,
  GMAIL_CHECKPOINT_STATUSES,
  GMAIL_MESSAGE_DIRECTIONS,
  GMAIL_SOURCE_SYSTEM,
  type GmailCheckpoint,
  type GmailCheckpointJobKey,
  type GmailCheckpointStatus,
  type GmailIndexInput,
  type GmailIndexedMessage,
  type GmailMessageDirection,
  type GmailParticipantHashes,
  type GmailSourceRecordPointers,
  type IndexGmailMessageResult,
} from "./types";

const EMAIL_HASH_RE = /^[a-f0-9]{64}$/;

function canonicalizeGmailId(raw: string, label: string): string {
  const text = raw.trim();
  if (!text) throw new Error(`${label}-required`);
  if (text.includes("@") || /\s/.test(text)) {
    throw new Error(`${label}-invalid`);
  }
  return text;
}

export function isGmailMessageDirection(
  value: unknown,
): value is GmailMessageDirection {
  return (
    typeof value === "string" &&
    (GMAIL_MESSAGE_DIRECTIONS as readonly string[]).includes(value)
  );
}

export function isGmailCheckpointJobKey(
  value: unknown,
): value is GmailCheckpointJobKey {
  return (
    typeof value === "string" &&
    (GMAIL_CHECKPOINT_JOB_KEYS as readonly string[]).includes(value)
  );
}

export function isGmailCheckpointStatus(
  value: unknown,
): value is GmailCheckpointStatus {
  return (
    typeof value === "string" &&
    (GMAIL_CHECKPOINT_STATUSES as readonly string[]).includes(value)
  );
}

export function isEmailHash(value: string): boolean {
  return EMAIL_HASH_RE.test(value);
}

function uniqueHashes(values: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    if (!isEmailHash(value)) continue;
    seen.add(value);
  }
  return [...seen].sort();
}

function hashesFromAddresses(emails: readonly string[] | undefined): string[] {
  if (!emails) return [];
  const hashed: string[] = [];
  for (const email of emails) {
    const hash = hashEmail(email);
    if (hash) hashed.push(hash);
  }
  return uniqueHashes(hashed);
}

export function gmailParticipantHashesFromAddresses(input: {
  fromEmail?: string | null;
  toEmails?: readonly string[];
  ccEmails?: readonly string[];
  bccEmails?: readonly string[];
}): GmailParticipantHashes {
  return {
    fromEmailHash: hashEmail(input.fromEmail),
    toEmailHashes: hashesFromAddresses(input.toEmails),
    ccEmailHashes: hashesFromAddresses(input.ccEmails),
    bccEmailHashes: hashesFromAddresses(input.bccEmails),
  };
}

export function buildGmailIndexedMessage(
  input: GmailIndexInput,
  indexedAt: string,
): GmailIndexedMessage {
  const messageId = canonicalizeGmailId(input.messageId, "gmail-message-id");
  const threadId = canonicalizeGmailId(input.threadId, "gmail-thread-id");
  if (!input.sentAt.trim()) throw new Error("gmail-sent-at-required");
  if (!isGmailMessageDirection(input.direction)) {
    throw new Error("gmail-direction-invalid");
  }

  const participants = gmailParticipantHashesFromAddresses({
    fromEmail: input.fromEmail,
    toEmails: input.toEmails,
    ccEmails: input.ccEmails,
    bccEmails: input.bccEmails,
  });
  const subject = input.subject == null ? null : input.subject.trim() || null;
  const labelIds = [
    ...new Set(
      (input.labelIds ?? [])
        .map((label) => label.trim())
        .filter((label) => label.length > 0),
    ),
  ];

  return {
    messageId,
    threadId,
    sentAt: input.sentAt,
    indexedAt,
    subject,
    fromEmailHash: participants.fromEmailHash,
    toEmailHashes: participants.toEmailHashes,
    ccEmailHashes: participants.ccEmailHashes,
    bccEmailHashes: participants.bccEmailHashes,
    direction: input.direction,
    labelIds,
    hasAttachments: Boolean(input.hasAttachments),
    sourceSystem: GMAIL_SOURCE_SYSTEM,
  };
}

function sameInstant(a: string, b: string): boolean {
  return Date.parse(a) === Date.parse(b);
}

function sameStringList(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export function mergeIndexedGmailMessage(
  existing: GmailIndexedMessage,
  incoming: GmailIndexedMessage,
): IndexGmailMessageResult {
  if (existing.messageId !== incoming.messageId) {
    throw new Error("gmail-message-id-mismatch");
  }
  if (existing.threadId !== incoming.threadId) {
    return { status: "conflict", field: "threadId", record: existing };
  }
  if (!sameInstant(existing.sentAt, incoming.sentAt)) {
    return { status: "conflict", field: "sentAt", record: existing };
  }
  if (
    existing.fromEmailHash &&
    incoming.fromEmailHash &&
    existing.fromEmailHash !== incoming.fromEmailHash
  ) {
    return { status: "conflict", field: "fromEmailHash", record: existing };
  }

  const next: GmailIndexedMessage = {
    ...existing,
    fromEmailHash: existing.fromEmailHash ?? incoming.fromEmailHash,
    subject: incoming.subject,
    toEmailHashes: incoming.toEmailHashes,
    ccEmailHashes: incoming.ccEmailHashes,
    bccEmailHashes: incoming.bccEmailHashes,
    direction: incoming.direction,
    labelIds: incoming.labelIds,
    hasAttachments: incoming.hasAttachments,
    indexedAt: existing.indexedAt,
    sourceSystem: GMAIL_SOURCE_SYSTEM,
  };

  const unchanged =
    next.subject === existing.subject &&
    next.fromEmailHash === existing.fromEmailHash &&
    sameStringList(next.toEmailHashes, existing.toEmailHashes) &&
    sameStringList(next.ccEmailHashes, existing.ccEmailHashes) &&
    sameStringList(next.bccEmailHashes, existing.bccEmailHashes) &&
    next.direction === existing.direction &&
    sameStringList(next.labelIds, existing.labelIds) &&
    next.hasAttachments === existing.hasAttachments;

  if (unchanged) {
    return { status: "already-present", record: existing };
  }
  return { status: "updated", record: next };
}

export function gmailSourceRecordPointers(
  message: Pick<GmailIndexedMessage, "messageId" | "threadId">,
): GmailSourceRecordPointers {
  return {
    sourceSystem: GMAIL_SOURCE_SYSTEM,
    sourceKind: "source-record",
    sourceRecordId: message.messageId,
    supportingPointer: message.threadId,
  };
}

export function assertGmailCheckpoint(row: GmailCheckpoint): void {
  if (!isGmailCheckpointJobKey(row.jobKey)) {
    throw new Error("gmail-checkpoint-job-invalid");
  }
  if (!isGmailCheckpointStatus(row.status)) {
    throw new Error("gmail-checkpoint-status-invalid");
  }
  if (!Number.isInteger(row.indexedCount) || row.indexedCount < 0) {
    throw new Error("gmail-checkpoint-count-invalid");
  }
}
