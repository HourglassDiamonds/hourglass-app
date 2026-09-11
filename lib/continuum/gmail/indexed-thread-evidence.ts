/**
 * Transient Gmail body reader for already-indexed thread identities.
 * Reuses exact-thread payload protection. Does not persist bodies.
 * Does not change #16B cursor/history. Does not list or discover mail.
 */

import { GmailHttpError, type GmailApi } from "./adapter";
import type { GmailConnectionStore } from "./connection";
import { exactThreadOnlyApi } from "./exact-thread";
import { protectExactThread, type ProtectedExactThread } from "./exact-thread-payload";
import type { GmailAccessTokenRefresh } from "./oauth";
import type { GmailConnection, GmailTokenCiphertext } from "./types";
import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import { evidenceFromExactMessage, type GmailCandidateEvidence } from "./candidates/types";

export const INDEXED_THREAD_EVIDENCE_ERROR_CODES = [
  "unauthorized",
  "unavailable",
  "gmail-not-connected",
  "decrypt-failed",
  "token-refresh-failed",
  "refresh-token-rotated",
  "oauth-not-configured",
  "blank-pointer",
  "thread-not-found",
  "thread-inaccessible",
  "thread-fetch-failed",
] as const;

export type IndexedThreadEvidenceErrorCode =
  (typeof INDEXED_THREAD_EVIDENCE_ERROR_CODES)[number];

export type IndexedThreadEvidenceLookup = {
  listMessagesByThread(threadId: string): Promise<GmailIndexedMessage[]>;
};

export type IndexedThreadEvidenceInput = {
  founderSessionOk: boolean;
  secretProtectedOk?: boolean;
  threadIds: readonly string[];
  index: IndexedThreadEvidenceLookup;
  connections: GmailConnectionStore;
  decryptRefreshToken: (wrapped: GmailTokenCiphertext) => string;
  refreshAccessToken: (refreshToken: string) => Promise<GmailAccessTokenRefresh>;
  createApi: (accessToken: string) => GmailApi;
};

export type IndexedThreadEvidenceFailure = {
  ok: false;
  safeErrorCode: IndexedThreadEvidenceErrorCode;
};

export type IndexedThreadItemFailure = {
  threadId: string;
  safeErrorCode: IndexedThreadEvidenceErrorCode;
};

export type IndexedThreadEvidenceSuccess = {
  ok: true;
  safeErrorCode: null;
  evidence: GmailCandidateEvidence[];
  unreadThreads: IndexedThreadItemFailure[];
  plaintextPersisted: false;
  gmailMutation: false;
  cursorUnchanged: true;
};

export type IndexedThreadEvidenceResult =
  | IndexedThreadEvidenceFailure
  | IndexedThreadEvidenceSuccess;

function isConnectedCredential(
  row: GmailConnection | null,
): row is GmailConnection & { refreshToken: GmailTokenCiphertext } {
  return Boolean(row && row.status === "connected" && row.refreshToken);
}

function failed(
  code: IndexedThreadEvidenceErrorCode,
): IndexedThreadEvidenceFailure {
  return { ok: false, safeErrorCode: code };
}

function threadFetchErrorCode(error: unknown): IndexedThreadEvidenceErrorCode {
  if (error instanceof GmailHttpError) {
    if (error.status === 404) return "thread-not-found";
    if (error.status === 403) return "thread-inaccessible";
  }
  return "thread-fetch-failed";
}

function evidenceFromProtected(
  indexed: readonly GmailIndexedMessage[],
  thread: ProtectedExactThread,
): GmailCandidateEvidence[] {
  const byId = new Map(indexed.map((row) => [row.messageId, row]));
  const out: GmailCandidateEvidence[] = [];
  for (const message of thread.messages) {
    const row = byId.get(message.messageId);
    if (!row) continue;
    out.push(evidenceFromExactMessage(row, message));
  }
  return out;
}

export async function runIndexedThreadEvidenceFetch(
  input: IndexedThreadEvidenceInput,
): Promise<IndexedThreadEvidenceResult> {
  if (!input.founderSessionOk && !input.secretProtectedOk) {
    return failed("unauthorized");
  }
  const threadIds = [
    ...new Set(input.threadIds.map((row) => row.trim()).filter(Boolean)),
  ];
  if (threadIds.length === 0) return failed("blank-pointer");

  let connection: GmailConnection | null;
  try {
    connection = await input.connections.getFounderConnection();
  } catch {
    return failed("unavailable");
  }
  if (!isConnectedCredential(connection)) return failed("gmail-not-connected");

  let refreshToken: string;
  try {
    refreshToken = input.decryptRefreshToken(connection.refreshToken);
    if (!refreshToken) return failed("decrypt-failed");
  } catch {
    return failed("decrypt-failed");
  }

  let refreshed: GmailAccessTokenRefresh;
  try {
    refreshed = await input.refreshAccessToken(refreshToken);
  } catch {
    return failed("token-refresh-failed");
  }
  if (!refreshed.ok) return failed(refreshed.error);

  const api = exactThreadOnlyApi(input.createApi(refreshed.accessToken));
  const evidence: GmailCandidateEvidence[] = [];
  const unreadThreads: IndexedThreadItemFailure[] = [];
  for (const threadId of threadIds) {
    let indexed: GmailIndexedMessage[];
    try {
      indexed = await input.index.listMessagesByThread(threadId);
    } catch {
      unreadThreads.push({ threadId, safeErrorCode: "unavailable" });
      continue;
    }
    if (indexed.length === 0) continue;
    try {
      const raw = await api.getThread(threadId);
      if (!raw?.id || raw.id !== threadId || !Array.isArray(raw.messages)) {
        unreadThreads.push({ threadId, safeErrorCode: "thread-fetch-failed" });
        continue;
      }
      evidence.push(...evidenceFromProtected(indexed, protectExactThread(raw)));
    } catch (error) {
      unreadThreads.push({
        threadId,
        safeErrorCode: threadFetchErrorCode(error),
      });
    }
  }

  return {
    ok: true,
    safeErrorCode: null,
    evidence,
    unreadThreads,
    plaintextPersisted: false,
    gmailMutation: false,
    cursorUnchanged: true,
  };
}
