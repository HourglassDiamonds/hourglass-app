/**
 * Live wiring for the in-app source viewer.
 * Founder-session only. Read-only Gmail getThread for an indexed identity.
 */

import "server-only";

import { createLiveGmailApi } from "@/lib/continuum/gmail/adapter";
import { exactThreadOnlyApi } from "./exact-thread";
import { createSupabaseGmailIndexStore } from "@/lib/continuum/client-memory/gmail/server";
import { liveGmailAccessTokenRefresher, type GmailAccessTokenRefresh } from "./oauth";
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
  fetchCompleteThread?(input: {
    threadId: string;
    indexed: readonly PreparedIndexedMessage[];
  }): Promise<SourceViewerFetchResult>;
};

export type LiveSourceViewerBatchUnavailableReason =
  | "token-kek-missing"
  | "token-kek-invalid"
  | "gmail-connection-missing"
  | "gmail-connection-disconnected"
  | "gmail-refresh-token-missing"
  | "decrypt-failed"
  | "token-refresh-timeout"
  | "oauth-not-configured"
  | "token-refresh-failed"
  | "refresh-token-rotated"
  | "batch-initialization-failed";

export type LiveSourceViewerBatchResult =
  | { ok: true; batch: LiveSourceViewerBatch }
  | { ok: false; safeErrorCategory: LiveSourceViewerBatchUnavailableReason };

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
export async function createLiveSourceViewerBatchResult(
  timeoutMs = TODAY_LIVE_ENRICHMENT_TIMEOUT_MS,
): Promise<LiveSourceViewerBatchResult> {
  const startedAt = Date.now();
  const kek = loadGmailTokenKek();
  if (!kek.ok) return { ok: false, safeErrorCategory: kek.error };
  try {
    const connection = await createSupabaseGmailConnectionStore().getFounderConnection();
    if (!connection) return { ok: false, safeErrorCategory: "gmail-connection-missing" };
    if (connection.status !== "connected") {
      return { ok: false, safeErrorCategory: "gmail-connection-disconnected" };
    }
    if (!connection.refreshToken) {
      return { ok: false, safeErrorCategory: "gmail-refresh-token-missing" };
    }
    let refreshToken: string;
    try {
      refreshToken = decryptRefreshToken(connection.refreshToken, kek.key);
    } catch {
      return { ok: false, safeErrorCategory: "decrypt-failed" };
    }
    if (!refreshToken) return { ok: false, safeErrorCategory: "decrypt-failed" };
    const timeout = Symbol("gmail-refresh-timeout");
    const refreshed = await withTimeout<GmailAccessTokenRefresh | typeof timeout>(
      liveGmailAccessTokenRefresher.refreshAccessToken(refreshToken),
      timeoutMs,
      timeout,
    );
    if (refreshed === timeout) {
      return { ok: false, safeErrorCategory: "token-refresh-timeout" };
    }
    if (!refreshed.ok) return { ok: false, safeErrorCategory: refreshed.error };
    const remaining = Math.max(1, timeoutMs - (Date.now() - startedAt));
    const prepared = createPreparedSourceViewerBatch(
      exactThreadOnlyApi(createLiveGmailApi(refreshed.accessToken)),
      remaining,
    );
    return { ok: true, batch: {
      credentialLoads: 1,
      metrics: prepared.metrics,
      fetchThread: prepared.fetchThread,
      fetchCompleteThread: prepared.fetchCompleteThread,
    } };
  } catch {
    return { ok: false, safeErrorCategory: "batch-initialization-failed" };
  }
}

/** Compatibility wrapper for source-viewer callers that only need availability. */
export async function createLiveSourceViewerBatch(
  timeoutMs = TODAY_LIVE_ENRICHMENT_TIMEOUT_MS,
): Promise<LiveSourceViewerBatch | null> {
  const result = await createLiveSourceViewerBatchResult(timeoutMs);
  return result.ok ? result.batch : null;
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
