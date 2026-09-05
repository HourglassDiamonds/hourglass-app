"use server";

import { createLiveGmailApi } from "@/lib/continuum/gmail/adapter";
import { isGmailIncrementalSyncEnabled } from "@/lib/continuum/gmail/env";
import {
  failedGmailIncrementalChunk,
  runGmailIncrementalChunk,
  type GmailIncrementalChunkResult,
} from "@/lib/continuum/gmail/incremental";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { liveGmailAccessTokenRefresher } from "@/lib/continuum/gmail/oauth";
import { decryptRefreshToken, loadGmailTokenKek } from "@/lib/continuum/gmail/token-crypto";

async function executeGmailIncrementalChunk(): Promise<GmailIncrementalChunkResult> {
  const auth = await getAuthenticatedGmailHistoryStores();
  if (!auth.ok) {
    return failedGmailIncrementalChunk(
      auth.reason === "unauthorized" ? "unauthorized" : "unavailable",
      { checkpointStatus: "idle" },
    );
  }
  if (!isGmailIncrementalSyncEnabled()) {
    return failedGmailIncrementalChunk("sync-disabled", { checkpointStatus: "idle" });
  }
  const kek = loadGmailTokenKek();
  if (!kek.ok) {
    return failedGmailIncrementalChunk("decrypt-failed", { checkpointStatus: "idle" });
  }
  return runGmailIncrementalChunk({
    founderSessionOk: true,
    enabled: true,
    connections: auth.connections,
    index: auth.index,
    attachments: auth.attachments,
    decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, kek.key),
    refreshAccessToken: (refreshToken) =>
      liveGmailAccessTokenRefresher.refreshAccessToken(refreshToken),
    createApi: (accessToken) => createLiveGmailApi(accessToken),
  });
}

export async function runNextGmailIncrementalChunk(): Promise<GmailIncrementalChunkResult> {
  return executeGmailIncrementalChunk();
}
