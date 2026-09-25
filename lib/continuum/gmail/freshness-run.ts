/**
 * Live Gmail operating-freshness runner.
 * Secret-protected or founder-session callers only. Kill-switched.
 * Does not log mailbox content. Does not mint People/Projects.
 */

import "server-only";

import { createLiveGmailApi } from "@/lib/continuum/gmail/adapter";
import { probeCandidateStorage } from "@/lib/continuum/candidates/activation";
import { createSupabaseCandidateStore } from "@/lib/continuum/candidates/server";
import { createSupabaseGmailIndexStore } from "@/lib/continuum/client-memory/gmail/server";
import { loadGmailPersonWorldFromAdmin } from "@/lib/continuum/client-memory/founder-project/gmail-world";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { isGmailIncrementalSyncEnabled } from "./env";
import {
  failedGmailFreshnessCycle,
  runGmailFreshnessCycle,
  sanitizeGmailFreshnessCycleResult,
  type GmailFreshnessCycleResult,
} from "./freshness-cycle";
import {
  liveGmailAccessTokenRefresher,
  type GmailRefreshFailureCategory,
} from "./oauth";
import {
  createSupabaseGmailAttachmentStore,
  createSupabaseGmailConnectionStore,
} from "./server";
import { decryptRefreshToken, loadGmailTokenKek } from "./token-crypto";

export type GmailRefreshTrace = {
  refreshFailureCategory: GmailRefreshFailureCategory | null;
  refreshRequestAttempted: boolean;
  refreshRequestSucceeded: boolean;
  tokenDecryptSucceeded: boolean | null;
  refreshedAccessTokenPresent: boolean | null;
};

export type LiveGmailFreshnessExecution = {
  result: GmailFreshnessCycleResult;
  refreshTrace: GmailRefreshTrace;
};

function emptyRefreshTrace(): GmailRefreshTrace {
  return {
    refreshFailureCategory: null,
    refreshRequestAttempted: false,
    refreshRequestSucceeded: false,
    tokenDecryptSucceeded: null,
    refreshedAccessTokenPresent: null,
  };
}

export async function executeLiveGmailFreshnessCycle(input: {
  founderSessionOk: boolean;
  secretProtectedOk?: boolean;
  force?: boolean;
}): Promise<LiveGmailFreshnessExecution> {
  if (!input.founderSessionOk && !input.secretProtectedOk) {
    return { result: failedGmailFreshnessCycle("unauthorized"), refreshTrace: emptyRefreshTrace() };
  }
  if (!isGmailIncrementalSyncEnabled()) {
    return { result: failedGmailFreshnessCycle("sync-disabled"), refreshTrace: emptyRefreshTrace() };
  }
  const kek = loadGmailTokenKek();
  if (!kek.ok) {
    return {
      result: failedGmailFreshnessCycle("decrypt-failed"),
      refreshTrace: { ...emptyRefreshTrace(), tokenDecryptSucceeded: false },
    };
  }
  const client = getSupabaseAdmin();
  const activation = await probeCandidateStorage(client);
  if (activation === "not-activated" || activation !== "activated" || !client) {
    return {
      result: failedGmailFreshnessCycle("candidate-store-unavailable"),
      refreshTrace: emptyRefreshTrace(),
    };
  }
  const refreshTrace = emptyRefreshTrace();
  try {
    const connections = createSupabaseGmailConnectionStore();
    const connection = await connections.getFounderConnection();
    const loaded = await loadGmailPersonWorldFromAdmin(
      connection?.mailboxEmailHash ? [connection.mailboxEmailHash] : [],
    );
    const result = await runGmailFreshnessCycle({
      founderSessionOk: input.founderSessionOk,
      secretProtectedOk: input.secretProtectedOk,
      enabled: true,
      connections,
      index: createSupabaseGmailIndexStore(),
      attachments: createSupabaseGmailAttachmentStore(),
      decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, kek.key),
      refreshAccessToken: async (refreshToken) => {
        refreshTrace.refreshRequestAttempted = true;
        refreshTrace.tokenDecryptSucceeded = true;
        const refreshed = await liveGmailAccessTokenRefresher.refreshAccessToken(refreshToken);
        if (refreshed.ok) {
          refreshTrace.refreshRequestSucceeded = true;
          refreshTrace.refreshedAccessTokenPresent = refreshed.accessToken.length > 0;
          refreshTrace.refreshFailureCategory = null;
          return refreshed;
        }
        refreshTrace.refreshRequestSucceeded = refreshed.refreshRequestSucceeded === true;
        refreshTrace.refreshedAccessTokenPresent = false;
        refreshTrace.refreshFailureCategory = refreshed.refreshFailureCategory ?? "unknown";
        return refreshed;
      },
      createApi: (accessToken) => createLiveGmailApi(accessToken),
      world: loaded.world,
      store: createSupabaseCandidateStore(client),
      nowIso: new Date().toISOString(),
      force: input.force,
    });
    return { result: sanitizeGmailFreshnessCycleResult(result), refreshTrace };
  } catch {
    return { result: failedGmailFreshnessCycle("unavailable"), refreshTrace };
  }
}
