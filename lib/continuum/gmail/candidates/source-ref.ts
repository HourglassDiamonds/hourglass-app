/**
 * Full Gmail provenance pointer for candidates.
 * Message and thread ids are retained in full. Fail closed rather than truncate.
 */

import { CANDIDATE_SOURCE_REF_MAX } from "@/lib/continuum/candidates/types";

export const GMAIL_CANDIDATE_SOURCE_VERSION = "gc1" as const;

export type GmailCandidateSourceRef = {
  threadId: string;
  messageId: string;
};

export function packGmailCandidateSourceRef(
  input: GmailCandidateSourceRef,
): { ok: true; sourceRef: string } | { ok: false; reason: "identity-too-long" } {
  const threadId = input.threadId.trim();
  const messageId = input.messageId.trim();
  if (!threadId || !messageId) return { ok: false, reason: "identity-too-long" };
  const packed = [GMAIL_CANDIDATE_SOURCE_VERSION, threadId, messageId].join("|");
  if (packed.length > CANDIDATE_SOURCE_REF_MAX) {
    return { ok: false, reason: "identity-too-long" };
  }
  return { ok: true, sourceRef: packed };
}

export function parseGmailCandidateSourceRef(
  sourceRef: string,
): GmailCandidateSourceRef | null {
  const raw = sourceRef.trim();
  const parts = raw.split("|");
  if (parts[0] !== GMAIL_CANDIDATE_SOURCE_VERSION) return null;
  if (parts.length < 3) return null;
  const threadId = (parts[1] ?? "").trim();
  const messageId = (parts[2] ?? "").trim();
  if (!threadId || !messageId) return null;
  return { threadId, messageId };
}
