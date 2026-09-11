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
import { liveGmailAccessTokenRefresher } from "./oauth";
import {
  createSupabaseGmailAttachmentStore,
  createSupabaseGmailConnectionStore,
} from "./server";
import { decryptRefreshToken, loadGmailTokenKek } from "./token-crypto";

export async function executeLiveGmailFreshnessCycle(input: {
  founderSessionOk: boolean;
  secretProtectedOk?: boolean;
  force?: boolean;
}): Promise<GmailFreshnessCycleResult> {
  if (!input.founderSessionOk && !input.secretProtectedOk) {
    return failedGmailFreshnessCycle("unauthorized");
  }
  if (!isGmailIncrementalSyncEnabled()) {
    return failedGmailFreshnessCycle("sync-disabled");
  }
  const kek = loadGmailTokenKek();
  if (!kek.ok) {
    return failedGmailFreshnessCycle("decrypt-failed");
  }
  const client = getSupabaseAdmin();
  const activation = await probeCandidateStorage(client);
  if (activation === "not-activated" || activation !== "activated" || !client) {
    return failedGmailFreshnessCycle("candidate-store-unavailable");
  }
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
      refreshAccessToken: (refreshToken) =>
        liveGmailAccessTokenRefresher.refreshAccessToken(refreshToken),
      createApi: (accessToken) => createLiveGmailApi(accessToken),
      world: loaded.world,
      store: createSupabaseCandidateStore(client),
      nowIso: new Date().toISOString(),
      force: input.force,
    });
    return sanitizeGmailFreshnessCycleResult(result);
  } catch {
    return failedGmailFreshnessCycle("unavailable");
  }
}
