import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultAuthorityRegister } from "@/lib/intelligence/review-velocity/corroboration-register";
import { loadReviewVelocityEvidence } from "@/lib/intelligence/review-velocity/repository";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { LocalAuthorityInput } from "./types";

/**
 * Local Authority consumes the canonical Review Velocity tables. Corroboration
 * remains an explicit typed register until a reviewed persistence contract exists;
 * no optional shadow tables or silent schema fallbacks are queried here.
 */
export async function readLocalAuthorityEvidence(
  client: SupabaseClient | null = getSupabaseAdmin(),
  now = new Date(),
): Promise<Omit<LocalAuthorityInput, "searchSignals">> {
  const evidence = await loadReviewVelocityEvidence(client);
  return {
    ...evidence,
    corroboration: defaultAuthorityRegister(),
    loadedAt: now.toISOString(),
  };
}
