"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedFounderProjectWriter } from "@/lib/continuum/client-memory/founder-project/load-writer";
import {
  createSupabaseFounderAssociationDecisionStore,
  persistFounderAssociationDecision,
} from "@/lib/continuum/today-sterling/founder-association-decision";
import { isVerifiedSterlingTodayPreviewRuntime } from "@/lib/continuum/today-sterling/server-config";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { createLiveGmailApi } from "@/lib/continuum/gmail/adapter";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import {
  indexOneFounderReviewedThread,
  PENNOCK_DIRECT_THREAD_ID,
} from "@/lib/continuum/gmail/manual-exact-thread-index";
import { liveGmailAccessTokenRefresher } from "@/lib/continuum/gmail/oauth";
import { decryptRefreshToken, loadGmailTokenKek } from "@/lib/continuum/gmail/token-crypto";
import { isBetaRecoveryPreviewRuntime } from "@/lib/continuum/gmail/manual-preview-chunk";
import { resolveContinuumIsolationState } from "@/lib/continuum/runtime-env";

const PATH = "/executive-dashboard/concierge/sterling-today/associations";

export async function reviewFounderCorrespondenceAssociation(formData: FormData): Promise<void> {
  if (!isVerifiedSterlingTodayPreviewRuntime()) redirect(`${PATH}?association=not-preview`);
  const auth = await getAuthenticatedFounderProjectWriter();
  const client = getSupabaseAdmin();
  if (!auth.ok || !client) redirect(`${PATH}?association=unauthorized`);
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "confirm" && decision !== "reject") redirect(`${PATH}?association=invalid`);
  const result = await persistFounderAssociationDecision({
    threadId: String(formData.get("threadId") ?? ""),
    personId: String(formData.get("personId") ?? ""),
    projectId: String(formData.get("projectId") ?? ""),
    jobId: String(formData.get("jobId") ?? "").trim() || null,
    reviewKey: String(formData.get("reviewKey") ?? ""),
    decision,
    reviewedBy: auth.username,
    store: createSupabaseFounderAssociationDecisionStore(client),
  });
  revalidatePath(PATH);
  redirect(`${PATH}?association=${result.ok ? result.status : result.reason}`);
}

export async function indexPennockDirectThread(_formData: FormData): Promise<void> {
  void _formData;
  const previewVerified = isBetaRecoveryPreviewRuntime({
    vercel: process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV,
    continuumEnv: process.env.CONTINUUM_ENV,
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF,
    isolationState: resolveContinuumIsolationState(),
  });
  if (!previewVerified) redirect(`${PATH}?client=pennock&threadIndex=not-beta-recovery-preview`);
  const auth = await getAuthenticatedGmailHistoryStores();
  const kek = loadGmailTokenKek();
  if (!auth.ok || !kek.ok) redirect(`${PATH}?client=pennock&threadIndex=unavailable`);
  const indexed = await indexOneFounderReviewedThread({
    founderAuthenticated: true,
    betaRecoveryPreviewVerified: previewVerified,
    threadId: PENNOCK_DIRECT_THREAD_ID,
    connections: auth.connections,
    index: auth.index,
    attachments: auth.attachments,
    decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, kek.key),
    refreshAccessToken: (refreshToken) => liveGmailAccessTokenRefresher.refreshAccessToken(refreshToken),
    createApi: (accessToken) => createLiveGmailApi(accessToken),
  });
  revalidatePath(PATH);
  redirect(`${PATH}?client=pennock&threadIndex=${indexed.ok ? "indexed" : indexed.safeErrorCode ?? "failed"}`);
}
