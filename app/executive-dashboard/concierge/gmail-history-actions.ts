"use server";

import { createLiveGmailApi } from "@/lib/continuum/gmail/adapter";
import {
  failedGmailHistoryChunk,
  runGmailHistoryChunk,
  type GmailHistoryChunkResult,
} from "@/lib/continuum/gmail/history";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { liveGmailAccessTokenRefresher } from "@/lib/continuum/gmail/oauth";
import { decryptRefreshToken, loadGmailTokenKek } from "@/lib/continuum/gmail/token-crypto";

export async function runGmailHistoryChunkAction(
  _prev: GmailHistoryChunkResult | null,
  _formData: FormData,
): Promise<GmailHistoryChunkResult> {
  const auth = await getAuthenticatedGmailHistoryStores();
  if (!auth.ok) {
    return failedGmailHistoryChunk(
      auth.reason === "unauthorized" ? "unauthorized" : "unavailable",
      { checkpointStatus: "idle" },
    );
  }
  const kek = loadGmailTokenKek();
  if (!kek.ok) return failedGmailHistoryChunk("decrypt-failed", { checkpointStatus: "idle" });
  return runGmailHistoryChunk({
    founderSessionOk: true,
    connections: auth.connections,
    index: auth.index,
    attachments: auth.attachments,
    decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, kek.key),
    refreshAccessToken: (refreshToken) =>
      liveGmailAccessTokenRefresher.refreshAccessToken(refreshToken),
    createApi: (accessToken) => createLiveGmailApi(accessToken),
  });
}
