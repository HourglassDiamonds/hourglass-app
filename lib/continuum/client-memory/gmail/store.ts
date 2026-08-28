/**
 * Protected Gmail source-index persistence port and in-memory adapter.
 * Indexes Gmail metadata only. Does not write Persons, facts, or kernel rows.
 *
 * Checkpoint writes are a separate call. Callers must index a batch until
 * durable, then putCheckpoint. This store does not wrap both in one
 * transaction.
 */

import {
  assertGmailCheckpoint,
  buildGmailIndexedMessage,
  mergeIndexedGmailMessage,
} from "./record";
import {
  GMAIL_SYNC_ALREADY_RUNNING,
  type GmailCheckpoint,
  type GmailCheckpointJobKey,
  type GmailIndexInput,
  type GmailIndexedMessage,
  type IndexGmailMessageResult,
} from "./types";

export type GmailIndexStore = {
  indexMessage(
    input: GmailIndexInput,
    indexedAt: string,
  ): Promise<IndexGmailMessageResult>;
  getMessage(messageId: string): Promise<GmailIndexedMessage | null>;
  listMessagesByThread(threadId: string): Promise<GmailIndexedMessage[]>;
  getCheckpoint(jobKey: GmailCheckpointJobKey): Promise<GmailCheckpoint | null>;
  putCheckpoint(row: GmailCheckpoint): Promise<GmailCheckpoint>;
  tryClaimHistoricalChunk(nowIso: string, leaseMs: number): Promise<boolean>;
  releaseHistoricalChunk(nowIso: string): Promise<void>;
};

function cloneMessage(row: GmailIndexedMessage): GmailIndexedMessage {
  return {
    ...row,
    toEmailHashes: [...row.toEmailHashes],
    ccEmailHashes: [...row.ccEmailHashes],
    bccEmailHashes: [...row.bccEmailHashes],
    labelIds: [...row.labelIds],
  };
}

function cloneCheckpoint(row: GmailCheckpoint): GmailCheckpoint {
  return { ...row };
}

export class InMemoryGmailIndexStore implements GmailIndexStore {
  private readonly messages = new Map<string, GmailIndexedMessage>();
  private readonly checkpoints = new Map<GmailCheckpointJobKey, GmailCheckpoint>();
  private chunkClaimHeld = false;

  async indexMessage(
    input: GmailIndexInput,
    indexedAt: string,
  ): Promise<IndexGmailMessageResult> {
    const incoming = buildGmailIndexedMessage(input, indexedAt);
    const existing = this.messages.get(incoming.messageId);
    if (!existing) {
      this.messages.set(incoming.messageId, cloneMessage(incoming));
      return { status: "inserted", record: cloneMessage(incoming) };
    }
    const merged = mergeIndexedGmailMessage(existing, incoming);
    if (merged.status === "updated") {
      this.messages.set(incoming.messageId, cloneMessage(merged.record));
    }
    return {
      ...merged,
      record: cloneMessage(merged.record),
    };
  }

  async getMessage(messageId: string): Promise<GmailIndexedMessage | null> {
    const existing = this.messages.get(messageId.trim());
    return existing ? cloneMessage(existing) : null;
  }

  async listMessagesByThread(threadId: string): Promise<GmailIndexedMessage[]> {
    const id = threadId.trim();
    return [...this.messages.values()]
      .filter((row) => row.threadId === id)
      .map(cloneMessage);
  }

  async getCheckpoint(
    jobKey: GmailCheckpointJobKey,
  ): Promise<GmailCheckpoint | null> {
    const existing = this.checkpoints.get(jobKey);
    return existing ? cloneCheckpoint(existing) : null;
  }

  async putCheckpoint(row: GmailCheckpoint): Promise<GmailCheckpoint> {
    assertGmailCheckpoint(row);
    const stored = cloneCheckpoint(row);
    this.checkpoints.set(row.jobKey, stored);
    return cloneCheckpoint(stored);
  }

  async tryClaimHistoricalChunk(nowIso: string, leaseMs: number): Promise<boolean> {
    if (this.chunkClaimHeld) return false;
    const existing = this.checkpoints.get("gmail-historical");
    if (existing?.errorCode === GMAIL_SYNC_ALREADY_RUNNING) {
      const age = Date.parse(nowIso) - Date.parse(existing.updatedAt);
      if (Number.isFinite(age) && age >= 0 && age < leaseMs) return false;
    }
    this.chunkClaimHeld = true;
    return true;
  }

  async releaseHistoricalChunk(_nowIso: string): Promise<void> {
    this.chunkClaimHeld = false;
  }

  listMessages(): GmailIndexedMessage[] {
    return [...this.messages.values()].map(cloneMessage);
  }
}
