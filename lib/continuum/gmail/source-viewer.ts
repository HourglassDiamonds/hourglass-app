/**
 * Read-only in-app source viewer fetch.
 * Retrieves one already-indexed Gmail thread on demand.
 * Does not persist bodies, list mail, or change Gmail labels.
 */

import { GmailHttpError, type GmailApi } from "./adapter";
import type { GmailConnectionStore } from "./connection";
import { exactThreadOnlyApi } from "./exact-thread";
import { protectExactThread } from "./exact-thread-payload";
import type { GmailAccessTokenRefresh } from "./oauth";
import { parseGmailFrom } from "./payload";
import type {
  GmailApiMessage,
  GmailConnection,
  GmailTokenCiphertext,
} from "./types";
import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import type { SourceViewerMessageInput } from "@/lib/continuum/chief-of-staff/operating-loop/email-viewer";

export const SOURCE_VIEWER_ERROR_CODES = [
  "unauthorized",
  "unavailable",
  "gmail-not-connected",
  "decrypt-failed",
  "token-refresh-failed",
  "refresh-token-rotated",
  "oauth-not-configured",
  "blank-pointer",
  "not-indexed",
  "thread-not-found",
  "thread-inaccessible",
  "thread-fetch-failed",
] as const;

export type SourceViewerErrorCode = (typeof SOURCE_VIEWER_ERROR_CODES)[number];

export type SourceViewerIndex = {
  getMessage(messageId: string): Promise<GmailIndexedMessage | null>;
  listMessagesByThread(threadId: string): Promise<GmailIndexedMessage[]>;
};

export type SourceViewerFetchInput = {
  founderSessionOk: boolean;
  threadId: string;
  messageId?: string | null;
  index: SourceViewerIndex;
  connections: GmailConnectionStore;
  decryptRefreshToken: (wrapped: GmailTokenCiphertext) => string;
  refreshAccessToken: (refreshToken: string) => Promise<GmailAccessTokenRefresh>;
  createApi: (accessToken: string) => GmailApi;
};

export type SourceViewerFetchFailure = {
  ok: false;
  safeErrorCode: SourceViewerErrorCode;
};

export type SourceViewerFetchSuccess = {
  ok: true;
  safeErrorCode: null;
  threadId: string;
  indexedSubject: string | null;
  messages: SourceViewerMessageInput[];
  plaintextPersisted: false;
  gmailMutation: false;
  cursorUnchanged: true;
  readOnly: true;
};

export type SourceViewerFetchResult =
  | SourceViewerFetchFailure
  | SourceViewerFetchSuccess;

function isConnectedCredential(
  row: GmailConnection | null,
): row is GmailConnection & { refreshToken: GmailTokenCiphertext } {
  return Boolean(row && row.status === "connected" && row.refreshToken);
}

function failed(code: SourceViewerErrorCode): SourceViewerFetchFailure {
  return { ok: false, safeErrorCode: code };
}

function threadFetchErrorCode(error: unknown): SourceViewerErrorCode {
  if (error instanceof GmailHttpError) {
    if (error.status === 404) return "thread-not-found";
    if (error.status === 403) return "thread-inaccessible";
  }
  if (error instanceof Error && error.message === "gmail-thread-missing") {
    return "thread-not-found";
  }
  return "thread-fetch-failed";
}

function fromRaw(message: GmailApiMessage): string | null {
  const headers = message.payload?.headers ?? [];
  const match = headers.find((header) => header.name.toLowerCase() === "from");
  return match?.value?.trim() || null;
}

export async function runSourceViewerFetch(
  input: SourceViewerFetchInput,
): Promise<SourceViewerFetchResult> {
  if (!input.founderSessionOk) return failed("unauthorized");
  const threadId = input.threadId.trim();
  const messageId = input.messageId?.trim() || null;
  if (!threadId) return failed("blank-pointer");

  let indexed: GmailIndexedMessage[];
  try {
    if (messageId) {
      const row = await input.index.getMessage(messageId);
      if (row && row.threadId === threadId) {
        indexed = [row];
        const rest = await input.index.listMessagesByThread(threadId);
        const seen = new Set([row.messageId]);
        for (const other of rest) {
          if (seen.has(other.messageId)) continue;
          seen.add(other.messageId);
          indexed.push(other);
        }
      } else {
        indexed = await input.index.listMessagesByThread(threadId);
      }
    } else {
      indexed = await input.index.listMessagesByThread(threadId);
    }
  } catch {
    return failed("unavailable");
  }
  if (indexed.length === 0) return failed("not-indexed");

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
  try {
    const raw = await api.getThread(threadId);
    if (!raw?.id || raw.id !== threadId || !Array.isArray(raw.messages)) {
      return failed("thread-fetch-failed");
    }
    const protectedThread = protectExactThread(raw);
    const byRaw = new Map(raw.messages.map((row) => [row.id, row]));
    const indexedIds = new Set(indexed.map((row) => row.messageId));
    const messages: SourceViewerMessageInput[] = [];
    for (const row of protectedThread.messages) {
      if (!indexedIds.has(row.messageId)) continue;
      const live = byRaw.get(row.messageId);
      const parsedFrom = live ? parseGmailFrom(live) : { email: row.from, displayName: null };
      messages.push({
        messageId: row.messageId,
        fromRaw: live ? fromRaw(live) : row.from,
        fromEmail: parsedFrom.email ?? row.from,
        to: row.to,
        cc: row.cc,
        subject: row.subject,
        sentAt: row.internalDate,
        plainText: row.plainText,
        snippet: live?.snippet?.trim() || null,
        attachments: row.attachments.map((attachment) => ({
          filename: attachment.filename,
          mimeType: attachment.mimeType,
        })),
      });
    }
    if (messages.length === 0) return failed("not-indexed");
    const focus =
      indexed.find((row) => row.messageId === messageId) ??
      indexed.reduce((latest, row) =>
        row.sentAt > latest.sentAt ? row : latest,
      );
    return {
      ok: true,
      safeErrorCode: null,
      threadId,
      indexedSubject: focus?.subject ?? null,
      messages,
      plaintextPersisted: false,
      gmailMutation: false,
      cursorUnchanged: true,
      readOnly: true,
    };
  } catch (error) {
    return failed(threadFetchErrorCode(error));
  }
}
