"use server";

import { createSupabaseClientMemoryStore } from "@/lib/continuum/client-memory/persistence/supabase";
import { createLiveGmailApi } from "@/lib/continuum/gmail/adapter";
import {
  ACHEDEKAL_PROJECT_ID,
  isPermittedAchedekalProjectId,
} from "@/lib/continuum/gmail/achedekal-acceptance";
import {
  executeAchedekalEvidenceReview,
  failedAchedekalReview,
  pointerFromProjectHistory,
  type AchedekalReviewState,
} from "@/lib/continuum/gmail/achedekal-review";
import { lookupFromGetProjectHistory } from "@/lib/continuum/gmail/exact-thread";
import { getAuthenticatedGmailConnectionStore } from "@/lib/continuum/gmail/load";
import { liveGmailAccessTokenRefresher } from "@/lib/continuum/gmail/oauth";
import { decryptRefreshToken, loadGmailTokenKek } from "@/lib/continuum/gmail/token-crypto";

export async function reviewAchedekalGmailEvidence(
  _prev: AchedekalReviewState | null,
  _formData: FormData,
): Promise<AchedekalReviewState> {
  const auth = await getAuthenticatedGmailConnectionStore();
  if (!auth.ok) {
    return failedAchedekalReview(
      auth.reason === "unauthorized" ? "unauthorized" : "connection-unavailable",
    );
  }

  const kek = loadGmailTokenKek();
  if (!kek.ok) return failedAchedekalReview("connection-unavailable");

  let memory: ReturnType<typeof createSupabaseClientMemoryStore>;
  try {
    memory = createSupabaseClientMemoryStore();
  } catch {
    return failedAchedekalReview("connection-unavailable");
  }

  return executeAchedekalEvidenceReview({
    founderSessionOk: true,
    projectId: ACHEDEKAL_PROJECT_ID,
    projects: lookupFromGetProjectHistory(async (projectId) => {
      if (!isPermittedAchedekalProjectId(projectId)) return null;
      const history = await memory.getProjectHistory(projectId);
      return pointerFromProjectHistory(history);
    }),
    connections: auth.store,
    decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, kek.key),
    refreshAccessToken: (refreshToken) =>
      liveGmailAccessTokenRefresher.refreshAccessToken(refreshToken),
    createApi: (accessToken) => createLiveGmailApi(accessToken),
  });
}
