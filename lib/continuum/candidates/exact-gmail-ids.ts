/**
 * Exact Gmail thread/message recovery for Today composition.
 * Read-only. Fail closed. No fuzzy subject, surname, sender, or body search.
 */

import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";

const GMAIL_CANDIDATE_SOURCE_VERSION = "gc1";
const GMAIL_HEX_ID = /^[0-9a-f]{10,}$/i;
const GMAIL_WEB_THREAD = "https://mail.google.com/mail/u/0/#all/";

export type ExactGmailIds = {
  threadIds: string[];
  messageIds: string[];
};

export function isExactGmailHexId(value: string): boolean {
  return GMAIL_HEX_ID.test(value.trim());
}

export function exactGmailIdsFromPointer(value: string): {
  threadId: string | null;
  messageId: string | null;
} {
  const trimmed = value.trim();
  if (!trimmed) return { threadId: null, messageId: null };
  const parts = trimmed.split("|");
  if (parts[0] === GMAIL_CANDIDATE_SOURCE_VERSION) {
    const threadId = (parts[1] ?? "").trim();
    const messageId = (parts[2] ?? "").trim();
    return {
      threadId: threadId || null,
      messageId: messageId || null,
    };
  }
  if (!trimmed.startsWith(GMAIL_WEB_THREAD)) {
    return { threadId: null, messageId: null };
  }
  const rest = trimmed.slice(GMAIL_WEB_THREAD.length);
  const [rawThread, rawMessage] = rest.split("/");
  const threadId = decodeURIComponent(rawThread ?? "").trim();
  const messageId = decodeURIComponent(rawMessage ?? "").trim();
  return {
    threadId: isExactGmailHexId(threadId) ? threadId : null,
    messageId: isExactGmailHexId(messageId) ? messageId : null,
  };
}

function pushUnique(list: string[], seen: Set<string>, value: string | null): void {
  if (!value || seen.has(value)) return;
  seen.add(value);
  list.push(value);
}

export function exactGmailIdsFromCandidate(row: ContinuumCandidate): ExactGmailIds {
  const threadIds: string[] = [];
  const messageIds: string[] = [];
  const seenThreads = new Set<string>();
  const seenMessages = new Set<string>();
  const add = (pointer: string) => {
    const parsed = exactGmailIdsFromPointer(pointer);
    pushUnique(threadIds, seenThreads, parsed.threadId);
    pushUnique(messageIds, seenMessages, parsed.messageId);
  };
  add(row.sourceRef);
  for (const ref of row.evidenceBasis.supportingSourceRefs ?? []) add(ref);
  return { threadIds, messageIds };
}

export function collectExactGmailIds(
  candidates: readonly ContinuumCandidate[],
): ExactGmailIds {
  const threadIds: string[] = [];
  const messageIds: string[] = [];
  const seenThreads = new Set<string>();
  const seenMessages = new Set<string>();
  for (const row of candidates) {
    if (row.sourceSystem !== "gmail") continue;
    const ids = exactGmailIdsFromCandidate(row);
    for (const threadId of ids.threadIds) {
      pushUnique(threadIds, seenThreads, threadId);
    }
    for (const messageId of ids.messageIds) {
      pushUnique(messageIds, seenMessages, messageId);
    }
  }
  return { threadIds, messageIds };
}
