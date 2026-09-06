/**
 * Founder-facing Gmail copy-in preview. Metadata only. No attachment bytes.
 */

import type { GmailIndexedMessage } from "../gmail/types";
import type { GmailAttachmentMeta } from "@/lib/continuum/gmail/types";
import { previewGmailCopyMime } from "./mime";
import {
  parseGmailAttachmentId,
  parseGmailCopyId,
} from "./source-ref";

export type GmailCopyPreview =
  | { ok: false; reason: "invalid-input" | "attachment-not-indexed" }
  | {
      ok: true;
      messageId: string;
      attachmentId: string;
      threadId: string;
      filename: string;
      mimeType: string | null;
      sizeBytes: number | null;
      sentAt: string | null;
      subject: string | null;
      mimePreview: "allowed" | "needs-bytes" | "unsupported-mime";
    };

export function presentGmailCopyPreview(input: {
  messageId: string;
  attachmentId: string;
  indexedMessage: GmailIndexedMessage | null;
  indexedAttachment: GmailAttachmentMeta | null;
}): GmailCopyPreview {
  const messageId = parseGmailCopyId(input.messageId);
  const attachmentId = parseGmailAttachmentId(input.attachmentId);
  if (!messageId || !attachmentId) return { ok: false, reason: "invalid-input" };
  const attachment = input.indexedAttachment;
  const message = input.indexedMessage;
  if (!attachment || !message) {
    return { ok: false, reason: "attachment-not-indexed" };
  }
  if (
    attachment.messageId !== messageId ||
    attachment.attachmentId !== attachmentId ||
    message.messageId !== messageId ||
    message.threadId !== attachment.threadId
  ) {
    return { ok: false, reason: "attachment-not-indexed" };
  }
  const filename = (attachment.filename ?? "").trim();
  if (!filename) return { ok: false, reason: "invalid-input" };
  return {
    ok: true,
    messageId,
    attachmentId,
    threadId: attachment.threadId,
    filename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    sentAt: message.sentAt,
    subject: message.subject,
    mimePreview: previewGmailCopyMime(attachment.mimeType),
  };
}
