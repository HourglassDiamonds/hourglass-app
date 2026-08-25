/**
 * Protected Gmail source-index contracts.
 * Gmail remains authoritative for raw mail. This module stores metadata only.
 * Do not import Gmail SDK types here.
 */

import type { ContinuumSourceSystem, EvidenceSourceKind } from "../../contracts/types";

export const GMAIL_SOURCE_SYSTEM = "gmail" as const satisfies ContinuumSourceSystem;

export const GMAIL_INDEX_SCHEMA_VERSION = 1 as const;

export type GmailMessageDirection = "inbound" | "outbound" | "unknown";

export const GMAIL_MESSAGE_DIRECTIONS = [
  "inbound",
  "outbound",
  "unknown",
] as const satisfies readonly GmailMessageDirection[];

export const GMAIL_CHECKPOINT_JOB_KEYS = [
  "gmail-historical",
  "gmail-memory-daily",
] as const;

export type GmailCheckpointJobKey = (typeof GMAIL_CHECKPOINT_JOB_KEYS)[number];

export const GMAIL_CHECKPOINT_STATUSES = [
  "idle",
  "running",
  "failed",
  "completed",
] as const;

export type GmailCheckpointStatus = (typeof GMAIL_CHECKPOINT_STATUSES)[number];

/**
 * SHA-256 hashes from hashEmail (continuum:client-memory:v1).
 * Never raw addresses.
 */
export type GmailParticipantHashes = {
  fromEmailHash: string | null;
  toEmailHashes: readonly string[];
  ccEmailHashes: readonly string[];
};

/**
 * Protected-plane indexed message. Subject is PII-capable.
 * No mailbox payload or excerpt field. Do not copy this shape into kernel evidence.
 */
export type GmailIndexedMessage = {
  messageId: string;
  threadId: string;
  sentAt: string;
  indexedAt: string;
  subject: string | null;
  fromEmailHash: string | null;
  toEmailHashes: readonly string[];
  ccEmailHashes: readonly string[];
  direction: GmailMessageDirection;
  labelIds: readonly string[];
  hasAttachments: boolean;
  sourceSystem: typeof GMAIL_SOURCE_SYSTEM;
};

/**
 * Normalized adapter input. Raw addresses are hashed before persist.
 * Future Gmail adapter must map provider payloads into this shape.
 */
export type GmailIndexInput = {
  messageId: string;
  threadId: string;
  sentAt: string;
  subject?: string | null;
  fromEmail?: string | null;
  toEmails?: readonly string[];
  ccEmails?: readonly string[];
  direction: GmailMessageDirection;
  labelIds?: readonly string[];
  hasAttachments?: boolean;
};

export type GmailCheckpoint = {
  jobKey: GmailCheckpointJobKey;
  status: GmailCheckpointStatus;
  windowStart: string | null;
  windowEnd: string | null;
  pageToken: string | null;
  historyId: string | null;
  cursorMessageId: string | null;
  indexedCount: number;
  updatedAt: string;
  errorCode: string | null;
};

export type IndexGmailMessageResult =
  | { status: "inserted"; record: GmailIndexedMessage }
  | { status: "already-present"; record: GmailIndexedMessage }
  | { status: "updated"; record: GmailIndexedMessage }
  | {
      status: "conflict";
      field: "threadId" | "sentAt" | "fromEmailHash";
      record: GmailIndexedMessage;
    };

/**
 * Kernel evidence pointers for a later candidate write.
 * summary must be redacted by the caller. Subject is not included.
 */
export type GmailSourceRecordPointers = {
  sourceSystem: typeof GMAIL_SOURCE_SYSTEM;
  sourceKind: Extract<EvidenceSourceKind, "source-record">;
  sourceRecordId: string;
  supportingPointer: string;
};
