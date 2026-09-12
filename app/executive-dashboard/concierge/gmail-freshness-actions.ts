"use server";

import { revalidatePath } from "next/cache";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import {
  failedGmailFreshnessCycle,
  type GmailFreshnessCycleResult,
} from "@/lib/continuum/gmail/freshness-cycle";
import { executeLiveGmailFreshnessCycle } from "@/lib/continuum/gmail/freshness-run";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";

export async function refreshGmailOperatingFreshness(): Promise<GmailFreshnessCycleResult> {
  const auth = await getAuthenticatedGmailHistoryStores();
  if (!auth.ok) {
    return failedGmailFreshnessCycle(
      auth.reason === "unauthorized" ? "unauthorized" : "unavailable",
    );
  }
  const result = await executeLiveGmailFreshnessCycle({
    founderSessionOk: true,
  });
  if (result.docketMayHaveChanged) {
    revalidatePath(CONCIERGE_HOME_PATH);
  }
  return result;
}
