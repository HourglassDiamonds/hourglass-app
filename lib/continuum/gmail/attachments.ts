/**
 * Attachment metadata persistence. Bytes are never stored.
 */

import type { GmailAttachmentMeta } from "./types";

export type GmailAttachmentStore = {
  putAttachment(row: GmailAttachmentMeta): Promise<GmailAttachmentMeta>;
  listByMessage(messageId: string): Promise<GmailAttachmentMeta[]>;
  listByThread(threadId: string): Promise<GmailAttachmentMeta[]>;
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

  listAll(): GmailAttachmentMeta[] {
    return [...this.rows.values()].map(cloneAttachment);
  }
}
