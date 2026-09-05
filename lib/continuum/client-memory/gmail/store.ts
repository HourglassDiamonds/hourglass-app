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
  type GmailMessageDirection,
  type IndexGmailMessageResult,
} from "./types";

export type GmailIndexStore = {
  indexMessage(
    input: GmailIndexInput,
    indexedAt: string,
  ): Promise<IndexGmailMessageResult>;
  getMessage(messageId: string): Promise<GmailIndexedMessage | null>;
  deleteMessage(
    messageId: string,
  ): Promise<"deleted" | "already-absent">;
  listMessagesByThread(threadId: string): Promise<GmailIndexedMessage[]>;
  listMessagesMatchingSubjectTokens(
    tokens: readonly string[],
  ): Promise<GmailIndexedMessage[]>;
  listMessagesTouchingEmailHash(emailHash: string): Promise<GmailIndexedMessage[]>;
  listLatestByDirection(
    direction: GmailMessageDirection,
    limit: number,
  ): Promise<GmailIndexedMessage[]>;
  getCheckpoint(jobKey: GmailCheckpointJobKey): Promise<GmailCheckpoint | null>;
  putCheckpoint(row: GmailCheckpoint): Promise<GmailCheckpoint>;
  tryClaimHistoricalChunk(nowIso: string, leaseMs: number): Promise<boolean>;
  releaseHistoricalChunk(nowIso: string): Promise<void>;
  tryClaimIncrementalChunk(nowIso: string, leaseMs: number): Promise<boolean>;
  releaseIncrementalChunk(nowIso: string): Promise<void>;
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
  private readonly chunkClaims = new Set<GmailCheckpointJobKey>();

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

  async deleteMessage(
    messageId: string,
  ): Promise<"deleted" | "already-absent"> {
    const id = messageId.trim();
    if (!this.messages.has(id)) return "already-absent";
    this.messages.delete(id);
    return "deleted";
  }

  async listMessagesByThread(threadId: string): Promise<GmailIndexedMessage[]> {
    const id = threadId.trim();
    return [...this.messages.values()]
      .filter((row) => row.threadId === id)
      .map(cloneMessage);
  }

  async listMessagesMatchingSubjectTokens(
    tokens: readonly string[],
  ): Promise<GmailIndexedMessage[]> {
    const needles = [
      ...new Set(
        tokens
          .map((token) => token.trim().toLowerCase())
          .filter((token) => token.length >= 2),
      ),
    ].slice(0, 24);
    if (needles.length === 0) return [];
    return [...this.messages.values()]
      .filter((row) => {
        const subject = (row.subject ?? "").toLowerCase();
        return needles.some((needle) => subject.includes(needle));
      })
      .map(cloneMessage);
  }

  async listMessagesTouchingEmailHash(
    emailHash: string,
  ): Promise<GmailIndexedMessage[]> {
    const hash = emailHash.trim();
    if (!hash) return [];
    return [...this.messages.values()]
      .filter(
        (row) =>
          row.fromEmailHash === hash ||
          row.toEmailHashes.includes(hash) ||
          row.ccEmailHashes.includes(hash) ||
          row.bccEmailHashes.includes(hash),
      )
      .map(cloneMessage);
  }

  async listLatestByDirection(
    direction: GmailMessageDirection,
    limit: number,
  ): Promise<GmailIndexedMessage[]> {
    const cap = Number.isInteger(limit) && limit > 0 ? limit : 0;
    if (cap === 0) return [];
    return [...this.messages.values()]
      .filter((row) => row.direction === direction)
      .sort((a, b) => {
        const sent = Date.parse(b.sentAt) - Date.parse(a.sentAt);
        if (sent !== 0) return sent;
        return a.messageId < b.messageId ? -1 : a.messageId > b.messageId ? 1 : 0;
      })
      .slice(0, cap)
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
    return this.tryClaimJob("gmail-historical", nowIso, leaseMs);
  }

  async releaseHistoricalChunk(_nowIso: string): Promise<void> {
    this.chunkClaims.delete("gmail-historical");
  }

  async tryClaimIncrementalChunk(nowIso: string, leaseMs: number): Promise<boolean> {
    return this.tryClaimJob("gmail-memory-daily", nowIso, leaseMs);
  }

  async releaseIncrementalChunk(_nowIso: string): Promise<void> {
    this.chunkClaims.delete("gmail-memory-daily");
  }

  private async tryClaimJob(
    jobKey: GmailCheckpointJobKey,
    nowIso: string,
    leaseMs: number,
  ): Promise<boolean> {
    if (this.chunkClaims.has(jobKey)) return false;
    const existing = this.checkpoints.get(jobKey);
    if (existing?.errorCode === GMAIL_SYNC_ALREADY_RUNNING) {
      const age = Date.parse(nowIso) - Date.parse(existing.updatedAt);
      if (Number.isFinite(age) && age >= 0 && age < leaseMs) return false;
    }
    this.chunkClaims.add(jobKey);
    return true;
  }

  listMessages(): GmailIndexedMessage[] {
    return [...this.messages.values()].map(cloneMessage);
  }
}
