import "server-only";

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { isVerifiedSterlingTodayPreviewRuntime } from "./server-config";
import { SupabaseSterlingCanonicalApprovalReviewReader } from "./canonical-approval-review";
import { SupabaseSterlingCanonicalApprovalRepository } from "./canonical-approval-repository";

export type AuthenticatedCanonicalApprovalRepository =
  | { ok: true; repository: SupabaseSterlingCanonicalApprovalRepository; username: string }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export type AuthenticatedCanonicalApprovalReviewAccess =
  | {
      ok: true;
      repository: SupabaseSterlingCanonicalApprovalRepository;
      reader: SupabaseSterlingCanonicalApprovalReviewReader;
      username: string;
    }
  | { ok: false; reason: "unauthorized" | "unavailable" | "not-preview" };

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

/** Founder-only and Preview-only access for the actionable review surface. */
export async function getAuthenticatedCanonicalApprovalReviewAccess(): Promise<AuthenticatedCanonicalApprovalReviewAccess> {
  if (!isVerifiedSterlingTodayPreviewRuntime()) return { ok: false, reason: "not-preview" };
  const access = await getAuthenticatedCanonicalApprovalRepository();
  if (!access.ok) return access;
  const client = getSupabaseAdmin();
  if (!client) return { ok: false, reason: "unavailable" };
  return {
    ...access,
    reader: new SupabaseSterlingCanonicalApprovalReviewReader(client),
  };
}
