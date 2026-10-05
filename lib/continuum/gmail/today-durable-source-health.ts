import "server-only";

import { createSupabaseGmailIndexStore } from "@/lib/continuum/client-memory/gmail/server";
import { readGmailCurrentState } from "./current-state";
import type { GmailFreshnessCycleResult } from "./freshness-cycle";
import {
  durableTodayGmailSourceHealth,
  type TodaySourceHealth,
} from "@/lib/continuum/chief-of-staff/operating-loop/today-refresh";

export type GmailOperatingFreshnessResult = GmailFreshnessCycleResult & {
  durableSourceHealth: TodaySourceHealth;
  lastSuccessfulSyncAt: string | null;
};

export async function withDurableTodayGmailSourceHealth(
  result: GmailFreshnessCycleResult,
): Promise<GmailOperatingFreshnessResult> {
  try {
    const state = await readGmailCurrentState(createSupabaseGmailIndexStore());
    return {
      ...result,
      durableSourceHealth: durableTodayGmailSourceHealth({
        lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
        nowIso: new Date().toISOString(),
      }),
      lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
    };
  } catch {
    // A failed checkpoint read is unknown health, not evidence that Gmail is
    // delayed. Keep the UI in its neutral checking state until a durable read
    // proves either current or delayed.
    return { ...result, durableSourceHealth: "checking", lastSuccessfulSyncAt: null };
  }
}
