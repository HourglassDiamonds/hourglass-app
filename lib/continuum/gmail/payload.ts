/**
 * Extract Gmail headers + attachment metadata from a message payload.
 * Drops body data, HTML, snippet. Never calls attachments.get.
 */

import type { GmailApiMessage, GmailAttachmentMeta, GmailPayloadPart } from "./types";

export type ParsedGmailAddresses = {
  fromEmail: string | null;
  toEmails: string[];
  ccEmails: string[];
  bccEmails: string[];
};

function headerValue(
  message: GmailApiMessage,
  name: string,
): string | null {
  const headers = message.payload?.headers ?? [];
  const match = headers.find(
    (header) => header.name.toLowerCase() === name.toLowerCase(),
  );
  const value = match?.value?.trim();
  return value ? value : null;
}

function splitAddresses(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => {
      const angle = part.match(/<([^>]+)>/);
      return (angle ? angle[1] : part).trim();
    })
    .filter((item) => item.length > 0);
}

export function parseGmailAddresses(message: GmailApiMessage): ParsedGmailAddresses {
  return {
    fromEmail: splitAddresses(headerValue(message, "From"))[0] ?? null,
    toEmails: splitAddresses(headerValue(message, "To")),
    ccEmails: splitAddresses(headerValue(message, "Cc")),
    bccEmails: splitAddresses(headerValue(message, "Bcc")),
  };
}

export function parseGmailSubject(message: GmailApiMessage): string | null {
  return headerValue(message, "Subject");
}

export function sentAtFromInternalDate(message: GmailApiMessage): string {
  if (!message.internalDate?.trim()) throw new Error("gmail-internal-date-required");
  const ms = Number(message.internalDate);
  if (!Number.isFinite(ms)) throw new Error("gmail-internal-date-invalid");
  return new Date(ms).toISOString();
}

function walkParts(
  part: GmailPayloadPart | null | undefined,
  into: GmailAttachmentMeta[],
  messageId: string,
  threadId: string,
  indexedAt: string,
): void {
  if (!part) return;
  const attachmentId = part.body?.attachmentId?.trim();
  const filename = part.filename?.trim();
  if (attachmentId) {
    into.push({
      attachmentId,
      messageId,
      threadId,
      filename: filename || null,
      mimeType: part.mimeType?.trim() || null,
      sizeBytes:
        typeof part.body?.size === "number" && Number.isFinite(part.body.size)
          ? part.body.size
          : null,
      indexedAt,
    });
  }
  for (const child of part.parts ?? []) {
    walkParts(child, into, messageId, threadId, indexedAt);
  }
}

export function extractAttachmentMetadata(
  message: GmailApiMessage,
  indexedAt: string,
): GmailAttachmentMeta[] {
  const attachments: GmailAttachmentMeta[] = [];
  walkParts(message.payload, attachments, message.id, message.threadId, indexedAt);
  return attachments;
}

export function stripMailboxPayload<T extends GmailApiMessage>(
  message: T,
): Omit<T, "snippet" | "payload"> & { payload?: undefined; snippet?: undefined } {
  const { snippet: _snippet, payload: _payload, ...rest } = message;
  return rest;
}
