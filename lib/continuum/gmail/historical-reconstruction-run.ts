/**
 * Live historical Gmail reconstruction chunk.
 * Founder session or secret-protected callers only. No cron. No whole-mailbox run.
 */

import "server-only";

import type { CandidateStore } from "@/lib/continuum/candidates/types";
import type { GmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import type { GmailApi } from "./adapter";
import type { GmailCandidateWorld } from "./candidates/types";
import type { GmailConnectionStore } from "./connection";
import { runIndexedThreadEvidenceFetch } from "./indexed-thread-evidence";
import type { GmailAccessTokenRefresh } from "./oauth";
import type { GmailTokenCiphertext } from "./types";
import {
  runHistoricalGmailReconstructionChunk,
  type GmailReconstructionChunkResult,
} from "./historical-reconstruction";

export async function executeHistoricalGmailReconstructionChunk(input: {
  founderSessionOk: boolean;
  secretProtectedOk?: boolean;
  index: GmailIndexStore;
  store: CandidateStore;
  world: GmailCandidateWorld;
  nowIso: string;
  connections: GmailConnectionStore;
  decryptRefreshToken: (wrapped: GmailTokenCiphertext) => string;
  refreshAccessToken: (refreshToken: string) => Promise<GmailAccessTokenRefresh>;
  createApi: (accessToken: string) => GmailApi;
  cursor?: string | null;
}): Promise<GmailReconstructionChunkResult> {
  return runHistoricalGmailReconstructionChunk({
    founderSessionOk: input.founderSessionOk,
    secretProtectedOk: input.secretProtectedOk,
    index: input.index,
    store: input.store,
    world: input.world,
    nowIso: input.nowIso,
    cursor: input.cursor,
    fetchEvidence: async (threadIds) => {
      const fetched = await runIndexedThreadEvidenceFetch({
        founderSessionOk: input.founderSessionOk,
        secretProtectedOk: input.secretProtectedOk,
        threadIds,
        index: input.index,
        connections: input.connections,
        decryptRefreshToken: input.decryptRefreshToken,
        refreshAccessToken: input.refreshAccessToken,
        createApi: input.createApi,
      });
      if (!fetched.ok) return { ok: false, safeErrorCode: fetched.safeErrorCode };
      return { ok: true, evidence: fetched.evidence };
    },
  });
}
