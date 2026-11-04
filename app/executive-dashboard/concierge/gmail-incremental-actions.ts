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
import {
  blockedManualPreviewChunk,
  executeOneManualPreviewChunk,
  isBetaRecoveryPreviewRuntime,
  MANUAL_PREVIEW_GMAIL_MAX_GETS_PER_SEC,
  MANUAL_PREVIEW_GMAIL_MAX_RETRIES,
  MANUAL_PREVIEW_GMAIL_MAX_RETRY_DELAY_MS,
  MANUAL_PREVIEW_GMAIL_RETRY_JITTER_RATIO,
  type ManualPreviewChunkResult,
} from "@/lib/continuum/gmail/manual-preview-chunk";
import { resolveContinuumIsolationState } from "@/lib/continuum/runtime-env";

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

/**
 * One explicit founder invocation, one existing bounded History API chunk.
 * This is intentionally separate from the recurring kill switch and runner.
 * It is available only on the isolated Beta Recovery Preview deployment.
 */
export async function runOnePreviewGmailIngestionChunk(
  _previous: ManualPreviewChunkResult,
  _formData: FormData,
): Promise<ManualPreviewChunkResult> {
  void _previous;
  void _formData;
  const auth = await getAuthenticatedGmailHistoryStores();
  if (!auth.ok) {
    return blockedManualPreviewChunk(
      auth.reason === "unauthorized" ? "unauthorized" : "unavailable",
    );
  }
  const betaRecoveryPreviewVerified = isBetaRecoveryPreviewRuntime({
    vercel: process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV,
    continuumEnv: process.env.CONTINUUM_ENV,
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF,
    isolationState: resolveContinuumIsolationState(),
  });
  return executeOneManualPreviewChunk({
    founderAuthenticated: true,
    betaRecoveryPreviewVerified,
    runChunk: async () => {
      const kek = loadGmailTokenKek();
      if (!kek.ok) throw new Error("gmail-token-kek-unavailable");
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
        maxGetsPerSec: MANUAL_PREVIEW_GMAIL_MAX_GETS_PER_SEC,
        maxRetries: MANUAL_PREVIEW_GMAIL_MAX_RETRIES,
        retryJitterRatio: MANUAL_PREVIEW_GMAIL_RETRY_JITTER_RATIO,
        maxRetryDelayMs: MANUAL_PREVIEW_GMAIL_MAX_RETRY_DELAY_MS,
      });
    },
  });
}
