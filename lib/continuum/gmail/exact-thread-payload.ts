/**
 * Map a Gmail users.threads.get payload into a protected in-memory
 * representation for one founder-authorized project thread.
 * Decodes plaintext for that exact thread only. Never persists mailbox
 * bodies. Never retrieve attachment bytes.
 */

import {
  extractAttachmentMetadata,
  parseGmailAddresses,
  parseGmailSubject,
  sentAtFromInternalDate,
} from "./payload";
import type { GmailApiMessage, GmailApiThread, GmailPayloadPart } from "./types";

export type ProtectedMimePartMeta = {
  mimeType: string | null;
  filename: string | null;
  sizeBytes: number | null;
  attachmentId: string | null;
};

export type ProtectedExactThreadAttachment = {
  attachmentId: string;
  messageId: string;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
};

export type ProtectedExactThreadMessage = {
  messageId: string;
  internalDate: string | null;
  direction: "inbound" | "outbound" | "unknown";
  from: string | null;
  to: readonly string[];
  cc: readonly string[];
  bcc: readonly string[];
  subject: string | null;
  plainText: string | null;
  mimeParts: readonly ProtectedMimePartMeta[];
  attachments: readonly ProtectedExactThreadAttachment[];
};

export type ProtectedExactThread = {
  threadId: string;
  messages: readonly ProtectedExactThreadMessage[];
};

function decodeGmailBodyData(data: string): string {
  const trimmed = data.trim();
  if (!trimmed) return "";
  const decoded = Buffer.from(trimmed, "base64url").toString("utf8");
  if (decoded) return decoded;
  return Buffer.from(trimmed, "base64").toString("utf8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function walkParts(
  part: GmailPayloadPart | null | undefined,
  acc: {
    plain: string[];
    html: string[];
    mime: ProtectedMimePartMeta[];
  },
): void {
  if (!part) return;
  const mimeType = part.mimeType?.trim() || null;
  const filename = part.filename?.trim() || null;
  const attachmentId = part.body?.attachmentId?.trim() || null;
  const sizeBytes =
    typeof part.body?.size === "number" && Number.isFinite(part.body.size)
      ? part.body.size
      : null;
  acc.mime.push({ mimeType, filename, sizeBytes, attachmentId });

  const data = part.body?.data?.trim();
  if (data && !attachmentId && !filename) {
    const decoded = decodeGmailBodyData(data);
    if (decoded) {
      if (!mimeType || /^text\/plain(?:;|$)/i.test(mimeType)) {
        acc.plain.push(decoded);
      } else if (/^text\/html(?:;|$)/i.test(mimeType)) {
        acc.html.push(decoded);
      }
    }
  }

  for (const child of part.parts ?? []) {
    walkParts(child, acc);
  }
}

function internalDateIso(message: GmailApiMessage): string | null {
  try {
    return sentAtFromInternalDate(message);
  } catch {
    return null;
  }
}

function directionFromLabels(
  labelIds: readonly string[] | undefined,
): ProtectedExactThreadMessage["direction"] {
  const labels = new Set(
    (labelIds ?? []).map((label) => label.trim().toUpperCase()),
  );
  if (labels.has("SENT")) return "outbound";
  if (labels.has("INBOX")) return "inbound";
  return "unknown";
}

export function protectExactThreadMessage(
  message: GmailApiMessage,
): ProtectedExactThreadMessage {
  const addresses = parseGmailAddresses(message);
  const walked = { plain: [] as string[], html: [] as string[], mime: [] as ProtectedMimePartMeta[] };
  walkParts(message.payload, walked);
  const plainJoined = walked.plain.join("\n\n").trim();
  const htmlJoined = walked.html.join("\n\n").trim();
  const internalDate = internalDateIso(message);
  const attachments = extractAttachmentMetadata(
    message,
    internalDate ?? "1970-01-01T00:00:00.000Z",
  ).map((row) => ({
    attachmentId: row.attachmentId,
    messageId: row.messageId,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
  }));
  return {
    messageId: message.id,
    internalDate,
    direction: directionFromLabels(message.labelIds),
    from: addresses.fromEmail,
    to: addresses.toEmails,
    cc: addresses.ccEmails,
    bcc: addresses.bccEmails,
    subject: parseGmailSubject(message),
    plainText: plainJoined || (htmlJoined ? stripHtml(htmlJoined) : null) || null,
    mimeParts: walked.mime,
    attachments,
  };
}

function messageSortKey(message: ProtectedExactThreadMessage): number {
  if (!message.internalDate) return Number.POSITIVE_INFINITY;
  const ms = Date.parse(message.internalDate);
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

export function protectExactThread(thread: GmailApiThread): ProtectedExactThread {
  const messages = [...thread.messages]
    .map(protectExactThreadMessage)
    .sort((left, right) => {
      const delta = messageSortKey(left) - messageSortKey(right);
      if (delta !== 0) return delta;
      return left.messageId.localeCompare(right.messageId);
    });
  return {
    threadId: thread.id,
    messages,
  };
}
