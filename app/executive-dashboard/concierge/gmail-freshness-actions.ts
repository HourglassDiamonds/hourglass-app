"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedCandidateStore } from "@/lib/continuum/candidates/load";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import { createLiveGmailApi } from "@/lib/continuum/gmail/adapter";
import { isGmailIncrementalSyncEnabled } from "@/lib/continuum/gmail/env";
import {
  failedGmailFreshnessCycle,
  runGmailFreshnessCycle,
  sanitizeGmailFreshnessCycleResult,
  type GmailFreshnessCycleResult,
} from "@/lib/continuum/gmail/freshness-cycle";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { liveGmailAccessTokenRefresher } from "@/lib/continuum/gmail/oauth";
import { decryptRefreshToken, loadGmailTokenKek } from "@/lib/continuum/gmail/token-crypto";
import { loadGmailPersonWorldFromAdmin } from "@/lib/continuum/client-memory/founder-project/gmail-world";

export type { GmailFreshnessCycleResult };

export async function refreshGmailOperatingFreshness(): Promise<GmailFreshnessCycleResult> {
  const [gmail, candidates] = await Promise.all([
    getAuthenticatedGmailHistoryStores(),
    getAuthenticatedCandidateStore(),
  ]);
  if (!gmail.ok) {
    return failedGmailFreshnessCycle(
      gmail.reason === "unauthorized" ? "unauthorized" : "unavailable",
    );
  }
  if (!candidates.ok) {
    return failedGmailFreshnessCycle(
      candidates.reason === "unauthorized"
        ? "unauthorized"
        : "candidate-store-unavailable",
    );
  }
  if (!isGmailIncrementalSyncEnabled()) {
    return failedGmailFreshnessCycle("sync-disabled");
  }
  const kek = loadGmailTokenKek();
  if (!kek.ok) return failedGmailFreshnessCycle("decrypt-failed");
  try {
    const connection = await gmail.connections.getFounderConnection();
    const loaded = await loadGmailPersonWorldFromAdmin(
      connection?.mailboxEmailHash ? [connection.mailboxEmailHash] : [],
    );
    const result = await runGmailFreshnessCycle({
      founderSessionOk: true,
      enabled: true,
      connections: gmail.connections,
      index: gmail.index,
      attachments: gmail.attachments,
      decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, kek.key),
      refreshAccessToken: (refreshToken) =>
        liveGmailAccessTokenRefresher.refreshAccessToken(refreshToken),
      createApi: (accessToken) => createLiveGmailApi(accessToken),
      world: loaded.world,
      store: candidates.store,
      nowIso: new Date().toISOString(),
    });
    const safe = sanitizeGmailFreshnessCycleResult(result);
    if (safe.docketMayHaveChanged) {
      revalidatePath(CONCIERGE_HOME_PATH);
    }
    return safe;
  } catch {
    return failedGmailFreshnessCycle("unavailable");
  }
}
