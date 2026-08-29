/**
 * Narrow Gmail attachment-byte adapter for the Achedekal known-artifact
 * harness. Exposes getAttachment only. Access token stays in server memory.
 * Does not list mailbox rows, read full messages, open threads, search,
 * send, or modify.
 */

import { GmailHttpError } from "./adapter";

export type KnownArtifactGmailAttachment = {
  size: number | null;
  data: string;
};

export type KnownArtifactGmailApi = {
  getAttachment(
    messageId: string,
    attachmentId: string,
  ): Promise<KnownArtifactGmailAttachment>;
};

export type KnownArtifactGmailCall = {
  method: "getAttachment";
  messageId: string;
  attachmentId: string;
};

const GMAIL_API_ROOT = "https://gmail.googleapis.com/gmail/v1/users/me";

export class MockKnownArtifactGmailApi implements KnownArtifactGmailApi {
  readonly calls: KnownArtifactGmailCall[] = [];
  private readonly attachments = new Map<string, KnownArtifactGmailAttachment>();
  errors = new Map<string, Error>();

  setAttachment(
    messageId: string,
    attachmentId: string,
    row: KnownArtifactGmailAttachment,
  ): void {
    this.attachments.set(`${messageId}\0${attachmentId}`, row);
  }

  async getAttachment(
    messageId: string,
    attachmentId: string,
  ): Promise<KnownArtifactGmailAttachment> {
    this.calls.push({ method: "getAttachment", messageId, attachmentId });
    const error = this.errors.get(`getAttachment:${messageId}:${attachmentId}`);
    if (error) throw error;
    const row = this.attachments.get(`${messageId}\0${attachmentId}`);
    if (!row) throw new Error("gmail-attachment-missing");
    return { size: row.size, data: row.data };
  }
}

export function decodeGmailAttachmentBytes(data: string): Buffer | null {
  const raw = data.trim();
  if (!raw) return null;
  try {
    const bytes = Buffer.from(raw, "base64url");
    if (bytes.length === 0) return null;
    return bytes;
  } catch {
    return null;
  }
}

export function createLiveKnownArtifactGmailApi(
  accessToken: string,
): KnownArtifactGmailApi {
  return {
    async getAttachment(messageId, attachmentId) {
      const path = `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`;
      const response = await fetch(`${GMAIL_API_ROOT}${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (!response.ok) {
        const retryAfter = response.headers.get("Retry-After") ?? undefined;
        throw new GmailHttpError(response.status, "http", retryAfter);
      }
      const payload = (await response.json()) as {
        size?: number;
        data?: string;
      };
      return {
        size: typeof payload.size === "number" ? payload.size : null,
        data: typeof payload.data === "string" ? payload.data : "",
      };
    },
  };
}
