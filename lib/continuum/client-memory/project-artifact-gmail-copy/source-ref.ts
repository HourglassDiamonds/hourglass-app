/**
 * Gmail copy-in identity packed into #14 source_ref.
 * Unique per destination Project + Gmail message id + attachment id.
 * Does not store email body.
 */

import { PROJECT_ARTIFACT_SOURCE_REF_MAX } from "../project-artifacts/types";

export const GMAIL_COPY_SOURCE_VERSION = "gm1" as const;
export const GMAIL_COPY_SOURCE_SYSTEM = "gmail" as const;

const GMAIL_ID_RE = /^[A-Za-z0-9._=-]+$/;
const MESSAGE_ID_MAX = 64;
const THREAD_ID_MAX = 64;
const ATTACHMENT_ID_MAX = 180;
const HASH_MAX = 64;

export type GmailCopyProvenance = {
  messageId: string;
  attachmentId: string;
  threadId: string;
  sentAt: string | null;
  fromEmailHash: string | null;
};

export type GmailCopyIdentity = {
  messageId: string;
  attachmentId: string;
};

function validId(value: string, max: number): boolean {
  return value.length >= 1 && value.length <= max && GMAIL_ID_RE.test(value);
}

export function parseGmailCopyId(
  value: string | null | undefined,
  max = MESSAGE_ID_MAX,
): string | null {
  const id = (value ?? "").trim();
  if (!validId(id, max)) return null;
  return id;
}

export function parseGmailAttachmentId(
  value: string | null | undefined,
): string | null {
  return parseGmailCopyId(value, ATTACHMENT_ID_MAX);
}

export function gmailCopyIdentityPrefix(
  messageId: string,
  attachmentId: string,
): string {
  return `${GMAIL_COPY_SOURCE_VERSION}|${messageId}|${attachmentId}`;
}

export function packGmailCopySourceRef(
  provenance: GmailCopyProvenance,
): { ok: true; sourceRef: string } | { ok: false; reason: "identity-too-long" } {
  const identity = gmailCopyIdentityPrefix(
    provenance.messageId,
    provenance.attachmentId,
  );
  if (identity.length > PROJECT_ARTIFACT_SOURCE_REF_MAX) {
    return { ok: false, reason: "identity-too-long" };
  }
  const extras: string[] = [];
  if (
    provenance.threadId &&
    validId(provenance.threadId, THREAD_ID_MAX) &&
    provenance.threadId !== provenance.messageId
  ) {
    extras.push(provenance.threadId);
  } else if (provenance.threadId && validId(provenance.threadId, THREAD_ID_MAX)) {
    extras.push(provenance.threadId);
  }
  if (provenance.sentAt && /^\d{4}-\d{2}-\d{2}T/.test(provenance.sentAt)) {
    extras.push(provenance.sentAt);
  }
  if (
    provenance.fromEmailHash &&
    validId(provenance.fromEmailHash, HASH_MAX)
  ) {
    extras.push(provenance.fromEmailHash);
  }
  let packed = identity;
  for (const extra of extras) {
    const next = `${packed}|${extra}`;
    if (next.length > PROJECT_ARTIFACT_SOURCE_REF_MAX) break;
    packed = next;
  }
  return { ok: true, sourceRef: packed };
}

export function parseGmailCopySourceRef(
  sourceRef: string | null | undefined,
): GmailCopyProvenance | null {
  const raw = (sourceRef ?? "").trim();
  if (!raw) return null;
  const parts = raw.split("|");
  if (parts[0] !== GMAIL_COPY_SOURCE_VERSION) return null;
  if (parts.length < 3) return null;
  const messageId = parseGmailCopyId(parts[1]);
  const attachmentId = parseGmailAttachmentId(parts[2]);
  if (!messageId || !attachmentId) return null;
  const threadId = parseGmailCopyId(parts[3] ?? "", THREAD_ID_MAX);
  const sentAt = parts[4] && /^\d{4}-\d{2}-\d{2}T/.test(parts[4]) ? parts[4] : null;
  const fromEmailHash =
    parts[5] && validId(parts[5], HASH_MAX) ? parts[5] : null;
  return {
    messageId,
    attachmentId,
    threadId: threadId ?? messageId,
    sentAt,
    fromEmailHash,
  };
}

export function sourceRefMatchesGmailIdentity(
  sourceRef: string | null | undefined,
  identity: GmailCopyIdentity,
): boolean {
  const prefix = gmailCopyIdentityPrefix(identity.messageId, identity.attachmentId);
  const raw = (sourceRef ?? "").trim();
  return raw === prefix || raw.startsWith(`${prefix}|`);
}
