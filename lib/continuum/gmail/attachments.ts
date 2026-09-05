/**
 * Attachment metadata persistence. Bytes are never stored.
 */

import type { GmailAttachmentMeta } from "./types";

export const ATTACHMENT_FILENAME_TOKEN_LIMIT = 24 as const;
export const ATTACHMENT_FILENAME_HIT_CAP = 400 as const;
export const ATTACHMENT_THREAD_ID_BATCH = 50 as const;

export type GmailAttachmentStore = {
  putAttachment(row: GmailAttachmentMeta): Promise<GmailAttachmentMeta>;
  listByMessage(messageId: string): Promise<GmailAttachmentMeta[]>;
  listByThread(threadId: string): Promise<GmailAttachmentMeta[]>;
  listByThreadIds(threadIds: readonly string[]): Promise<GmailAttachmentMeta[]>;
  listByFilenameTokens(tokens: readonly string[]): Promise<GmailAttachmentMeta[]>;
  deleteByMessage(messageId: string): Promise<void>;
};

function cloneAttachment(row: GmailAttachmentMeta): GmailAttachmentMeta {
  return { ...row };
}

function attachmentKey(row: Pick<GmailAttachmentMeta, "messageId" | "attachmentId">): string {
  return `${row.messageId}\0${row.attachmentId}`;
}

export class InMemoryGmailAttachmentStore implements GmailAttachmentStore {
  private readonly rows = new Map<string, GmailAttachmentMeta>();

  async putAttachment(row: GmailAttachmentMeta): Promise<GmailAttachmentMeta> {
    const stored = cloneAttachment(row);
    this.rows.set(attachmentKey(stored), stored);
    return cloneAttachment(stored);
  }

  async listByMessage(messageId: string): Promise<GmailAttachmentMeta[]> {
    const id = messageId.trim();
    return [...this.rows.values()]
      .filter((row) => row.messageId === id)
      .map(cloneAttachment);
  }

  async listByThread(threadId: string): Promise<GmailAttachmentMeta[]> {
    const id = threadId.trim();
    return [...this.rows.values()]
      .filter((row) => row.threadId === id)
      .map(cloneAttachment);
  }

  async listByThreadIds(
    threadIds: readonly string[],
  ): Promise<GmailAttachmentMeta[]> {
    const wanted = new Set(
      threadIds.map((id) => id.trim()).filter(Boolean),
    );
    if (wanted.size === 0) return [];
    return [...this.rows.values()]
      .filter((row) => wanted.has(row.threadId))
      .map(cloneAttachment);
  }

  async listByFilenameTokens(
    tokens: readonly string[],
  ): Promise<GmailAttachmentMeta[]> {
    const needles = [
      ...new Set(
        tokens
          .map((token) => token.trim().toLowerCase())
          .filter((token) => token.length >= 2),
      ),
    ].slice(0, ATTACHMENT_FILENAME_TOKEN_LIMIT);
    if (needles.length === 0) return [];
    const hits: GmailAttachmentMeta[] = [];
    for (const row of this.rows.values()) {
      const filename = (row.filename ?? "").toLowerCase();
      if (!filename) continue;
      if (!needles.some((needle) => filename.includes(needle))) continue;
      hits.push(cloneAttachment(row));
      if (hits.length >= ATTACHMENT_FILENAME_HIT_CAP) break;
    }
    return hits;
  }

  async deleteByMessage(messageId: string): Promise<void> {
    const id = messageId.trim();
    for (const [key, row] of this.rows) {
      if (row.messageId === id) this.rows.delete(key);
    }
  }

  listAll(): GmailAttachmentMeta[] {
    return [...this.rows.values()].map(cloneAttachment);
  }
}
