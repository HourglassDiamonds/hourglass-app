/**
 * Live wiring for the in-app source viewer.
 * Founder-session only. Read-only Gmail getThread for an indexed identity.
 */

import "server-only";

import { createLiveGmailApi } from "@/lib/continuum/gmail/adapter";
import { exactThreadOnlyApi } from "./exact-thread";
import { createSupabaseGmailIndexStore } from "@/lib/continuum/client-memory/gmail/server";
import { liveGmailAccessTokenRefresher } from "./oauth";
import { createSupabaseGmailConnectionStore } from "./server";
import { decryptRefreshToken, loadGmailTokenKek } from "./token-crypto";
import {
  createPreparedSourceViewerBatch,
  runSourceViewerFetch,
  type PreparedIndexedMessage,
  type SourceViewerErrorCode,
  type SourceViewerFetchResult,
} from "./source-viewer";

const TODAY_LIVE_ENRICHMENT_TIMEOUT_MS = 8_000;

export type LiveSourceViewerBatch = {
  credentialLoads: 1;
  metrics: { threadFetches: number };
  fetchThread(input: {
    threadId: string;
    indexed: readonly PreparedIndexedMessage[];
  }): Promise<SourceViewerFetchResult>;
};

async function withTimeout<T>(
  work: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), Math.max(1, ms));
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** One credential/token context shared by every exact thread read in a rebuild. */
export async function createLiveSourceViewerBatch(
  timeoutMs = TODAY_LIVE_ENRICHMENT_TIMEOUT_MS,
): Promise<LiveSourceViewerBatch | null> {
  const startedAt = Date.now();
  const kek = loadGmailTokenKek();
  if (!kek.ok) return null;
  try {
    const connection = await createSupabaseGmailConnectionStore().getFounderConnection();
    if (!connection || connection.status !== "connected" || !connection.refreshToken)
      return null;
    const refreshToken = decryptRefreshToken(connection.refreshToken, kek.key);
    if (!refreshToken) return null;
    const refreshed = await withTimeout(
      liveGmailAccessTokenRefresher.refreshAccessToken(refreshToken),
      timeoutMs,
      null,
    );
    if (!refreshed?.ok) return null;
    const remaining = Math.max(1, timeoutMs - (Date.now() - startedAt));
    const prepared = createPreparedSourceViewerBatch(
      exactThreadOnlyApi(createLiveGmailApi(refreshed.accessToken)),
      remaining,
    );
    return {
      credentialLoads: 1,
      metrics: prepared.metrics,
      fetchThread: prepared.fetchThread,
    };
  } catch {
    return null;
  }
}

export async function executeLiveSourceViewerFetch(input: {
  founderSessionOk: boolean;
  threadId: string;
  messageId?: string | null;
}): Promise<SourceViewerFetchResult> {
  if (!input.founderSessionOk) {
    return { ok: false, safeErrorCode: "unauthorized" };
  }
  const kek = loadGmailTokenKek();
  if (!kek.ok) {
    return { ok: false, safeErrorCode: "decrypt-failed" };
  }
  try {
    return await runSourceViewerFetch({
      founderSessionOk: true,
      threadId: input.threadId,
      messageId: input.messageId,
      index: createSupabaseGmailIndexStore(),
      connections: createSupabaseGmailConnectionStore(),
      decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, kek.key),
      refreshAccessToken: (refreshToken) =>
        liveGmailAccessTokenRefresher.refreshAccessToken(refreshToken),
      createApi: (accessToken) => createLiveGmailApi(accessToken),
    });
  } catch {
    const code: SourceViewerErrorCode = "unavailable";
    return { ok: false, safeErrorCode: code };
  }
}
