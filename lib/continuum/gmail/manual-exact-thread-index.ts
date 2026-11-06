import type { GmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import type { GmailApi } from "./adapter";
import type { GmailAttachmentStore } from "./attachments";
import type { GmailConnectionStore } from "./connection";
import { exactThreadOnlyApi } from "./exact-thread";
import { persistFetchedMessage } from "./incremental-sync";
import type { GmailAccessTokenRefresh } from "./oauth";
import type { GmailTokenCiphertext } from "./types";

export const PENNOCK_DIRECT_THREAD_ID = "19fdca18f516310d" as const;
export const MANUAL_EXACT_THREAD_MAX_MESSAGES = 50 as const;

export type ManualExactThreadIndexResult = {
  ok: boolean;
  status: "indexed" | "blocked" | "failed";
  messageCount: number;
  insertedCount: number;
  updatedCount: number;
  alreadyPresentCount: number;
  droppedCount: number;
  safeErrorCode: string | null;
};

function result(
  status: ManualExactThreadIndexResult["status"],
  safeErrorCode: string | null,
  counts = { messageCount: 0, insertedCount: 0, updatedCount: 0, alreadyPresentCount: 0, droppedCount: 0 },
): ManualExactThreadIndexResult {
  return { ok: status === "indexed", status, safeErrorCode, ...counts };
}

export async function indexOneFounderReviewedThread(input: {
  founderAuthenticated: boolean;
  betaRecoveryPreviewVerified: boolean;
  threadId: string;
  connections: GmailConnectionStore;
  index: GmailIndexStore;
  attachments: GmailAttachmentStore;
  decryptRefreshToken: (wrapped: GmailTokenCiphertext) => string;
  refreshAccessToken: (refreshToken: string) => Promise<GmailAccessTokenRefresh>;
  createApi: (accessToken: string) => GmailApi;
  nowIso?: string;
}): Promise<ManualExactThreadIndexResult> {
  if (!input.founderAuthenticated) return result("blocked", "unauthorized");
  if (!input.betaRecoveryPreviewVerified) return result("blocked", "not-beta-recovery-preview");
  if (input.threadId !== PENNOCK_DIRECT_THREAD_ID) return result("blocked", "thread-not-approved");

  try {
    const connection = await input.connections.getFounderConnection();
    if (!connection || connection.status !== "connected" || !connection.refreshToken) {
      return result("failed", "gmail-not-connected");
    }
    const refreshToken = input.decryptRefreshToken(connection.refreshToken);
    if (!refreshToken) return result("failed", "decrypt-failed");
    const refreshed = await input.refreshAccessToken(refreshToken);
    if (!refreshed.ok) return result("failed", refreshed.error);

    const thread = await exactThreadOnlyApi(input.createApi(refreshed.accessToken)).getThread(
      PENNOCK_DIRECT_THREAD_ID,
    );
    if (
      thread.id !== PENNOCK_DIRECT_THREAD_ID ||
      thread.messages.length === 0 ||
      thread.messages.length > MANUAL_EXACT_THREAD_MAX_MESSAGES ||
      thread.messages.some((message) => message.threadId !== PENNOCK_DIRECT_THREAD_ID)
    ) {
      return result("failed", "thread-integrity-failed");
    }

    const counts = {
      messageCount: thread.messages.length,
      insertedCount: 0,
      updatedCount: 0,
      alreadyPresentCount: 0,
      droppedCount: 0,
    };
    const nowIso = input.nowIso ?? new Date().toISOString();
    for (const message of thread.messages) {
      const indexed = await persistFetchedMessage(
        {
          index: input.index,
          attachments: input.attachments,
          founderMailboxHash: connection.mailboxEmailHash,
        },
        message,
        nowIso,
      );
      if (indexed === "inserted") counts.insertedCount += 1;
      else if (indexed === "updated") counts.updatedCount += 1;
      else if (indexed === "already-present") counts.alreadyPresentCount += 1;
      else counts.droppedCount += 1;
    }
    if (counts.droppedCount > 0) return result("failed", "thread-index-incomplete", counts);
    return result("indexed", null, counts);
  } catch {
    return result("failed", "thread-index-failed");
  }
}
