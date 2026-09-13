/**
 * Live wiring for the in-app source viewer.
 * Founder-session only. Read-only Gmail getThread for an indexed identity.
 */

import "server-only";

import { createLiveGmailApi } from "@/lib/continuum/gmail/adapter";
import { createSupabaseGmailIndexStore } from "@/lib/continuum/client-memory/gmail/server";
import { liveGmailAccessTokenRefresher } from "./oauth";
import { createSupabaseGmailConnectionStore } from "./server";
import { decryptRefreshToken, loadGmailTokenKek } from "./token-crypto";
import {
  runSourceViewerFetch,
  type SourceViewerErrorCode,
  type SourceViewerFetchResult,
} from "./source-viewer";

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
