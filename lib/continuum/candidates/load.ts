/**
 * Server-only durable Candidate store loader.
 * Checks the founder session, then probes continuum_candidates activation.
 * Does not fall back to InMemoryCandidateStore.
 */

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { probeCandidateStorage } from "./activation";
import { createSupabaseCandidateStore } from "./server";
import type { CandidateStore } from "./types";

export type AuthenticatedCandidateStore =
  | { ok: true; store: CandidateStore; username: string }
  | {
      ok: false;
      reason: "unauthorized" | "unavailable" | "not-activated";
    };

export async function getAuthenticatedCandidateStore(): Promise<AuthenticatedCandidateStore> {
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) {
    return { ok: false, reason: "unauthorized" };
  }
  try {
    const client = getSupabaseAdmin();
    const activation = await probeCandidateStorage(client);
    if (activation === "not-activated") {
      return { ok: false, reason: "not-activated" };
    }
    if (activation !== "activated" || !client) {
      return { ok: false, reason: "unavailable" };
    }
    return {
      ok: true,
      store: createSupabaseCandidateStore(client),
      username: session.username,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
