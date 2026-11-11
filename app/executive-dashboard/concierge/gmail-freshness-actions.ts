"use server";

import { revalidatePath } from "next/cache";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import {
  failedGmailFreshnessCycle,
  type GmailFreshnessCycleResult,
} from "@/lib/continuum/gmail/freshness-cycle";
import { executeLiveGmailFreshnessCycle } from "@/lib/continuum/gmail/freshness-run";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import {
  withDurableTodayGmailSourceHealth,
  type GmailOperatingFreshnessResult,
} from "@/lib/continuum/gmail/today-durable-source-health";

export async function refreshGmailOperatingFreshness(): Promise<GmailOperatingFreshnessResult> {
  const auth = await getAuthenticatedGmailHistoryStores();
  if (!auth.ok) {
    const failed: GmailFreshnessCycleResult = failedGmailFreshnessCycle(
      auth.reason === "unauthorized" ? "unauthorized" : "unavailable",
    );
    return withDurableTodayGmailSourceHealth(
      failed,
    );
  }
  const execution = await executeLiveGmailFreshnessCycle({
    authorization: "founder-manual",
    founderSessionOk: true,
  });
  if (execution.result.docketMayHaveChanged) {
    revalidatePath(CONCIERGE_HOME_PATH);
  }
  const result = await withDurableTodayGmailSourceHealth(execution.result);
  console.info(
    JSON.stringify({
      event: "continuum.gmail_freshness.foreground",
      safeErrorCode: result.safeErrorCode,
      durableSourceHealth: result.durableSourceHealth,
      lastSuccessfulSyncAt: result.lastSuccessfulSyncAt,
    }),
  );
  return result;
}
