import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { probeSterlingLedger } from "./activation";
import { createSupabaseSterlingProposalRepository } from "./server";
import type { SterlingProposalRepository } from "./types";

export type AuthenticatedSterlingProposalRepository =
  | { ok: true; repository: SterlingProposalRepository; username: string }
  | { ok: false; reason: "unauthorized" | "unavailable" | "not-activated" };

export async function getAuthenticatedSterlingProposalRepository(): Promise<AuthenticatedSterlingProposalRepository> {
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) return { ok: false, reason: "unauthorized" };
  const client = getSupabaseAdmin();
  const activation = await probeSterlingLedger(client);
  if (activation !== "activated" || !client) {
    return {
      ok: false,
      reason: activation === "not-activated" ? "not-activated" : "unavailable",
    };
  }
  try {
    return { ok: true, repository: createSupabaseSterlingProposalRepository(client), username: session.username };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
