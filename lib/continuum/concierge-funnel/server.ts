import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { createSupabaseWebsiteIntakeStore } from "../website-intake/supabase";
import { preparePersistentConciergeAcceptance } from "./application";
import type { WebsiteInquiry } from "../website-intake/types";
import type {
  AcknowledgementCopy,
  CommunicationConsent,
} from "./types";
import { SupabaseConciergeFunnelStore } from "./supabase";

export function createSupabaseConciergeFunnelStore(
  client: SupabaseClient | null = getSupabaseAdmin(),
): SupabaseConciergeFunnelStore {
  if (!client) throw new Error("supabase-admin-unavailable");
  return new SupabaseConciergeFunnelStore(client);
}

export async function preparePersistentConciergeAcceptanceServer(input: {
  inquiry: WebsiteInquiry;
  emailVerificationEvidence?: Parameters<
    typeof preparePersistentConciergeAcceptance
  >[0]["emailVerificationEvidence"];
  acknowledgementCopy: AcknowledgementCopy;
  consent: CommunicationConsent;
  requestedWindow: { start: string; end: string };
  now: string;
}) {
  const websiteStore = createSupabaseWebsiteIntakeStore();
  if (!websiteStore) {
    return { ok: false as const, stage: "website-intake" as const, reason: "unavailable" as const };
  }
  return preparePersistentConciergeAcceptance({
    ...input,
    websiteStore,
    funnelStore: createSupabaseConciergeFunnelStore(),
  });
}

/** Read-only founder-action seam for Sterling Today; it does not publish. */
export async function loadPersistentConciergeFounderActions(limit = 100) {
  return createSupabaseConciergeFunnelStore().listFounderActions(limit);
}
