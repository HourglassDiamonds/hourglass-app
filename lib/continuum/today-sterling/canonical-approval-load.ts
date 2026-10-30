import "server-only";

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { SupabaseSterlingCanonicalApprovalRepository } from "./canonical-approval-repository";

export type AuthenticatedCanonicalApprovalRepository =
  | { ok: true; repository: SupabaseSterlingCanonicalApprovalRepository; username: string }
  | { ok: false; reason: "unauthorized" | "unavailable" };

/**
 * Founder-session authorization is checked independently from possession of
 * the server credential. The repository is never constructed in client code.
 */
export async function getAuthenticatedCanonicalApprovalRepository(): Promise<AuthenticatedCanonicalApprovalRepository> {
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) return { ok: false, reason: "unauthorized" };
  const client = getSupabaseAdmin();
  if (!client) return { ok: false, reason: "unavailable" };
  return {
    ok: true,
    repository: new SupabaseSterlingCanonicalApprovalRepository(client),
    username: session.username,
  };
}
