import "server-only";

import { ingestWebsiteInquiry } from "./ingest";
import { createSupabaseWebsiteIntakeStore } from "./supabase";
import type { HubSpotIntakeOutcome, WebsiteInquiry } from "./types";

export async function ingestWebsiteInquiryServer(inquiry: WebsiteInquiry) {
  try {
    const store = createSupabaseWebsiteIntakeStore();
    if (!store) return { ok: false as const, reason: "unavailable" as const };
    return ingestWebsiteInquiry(store, inquiry);
  } catch {
    return { ok: false as const, reason: "unavailable" as const };
  }
}

export async function recordWebsiteIntakeHubSpotOutcome(outcome: HubSpotIntakeOutcome): Promise<void> {
  const store = createSupabaseWebsiteIntakeStore();
  if (!store) return;
  await store.recordHubSpotOutcome(outcome);
}
