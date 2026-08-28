/**
 * Server-only Gmail connection loader.
 * Founder executive-dashboard session required before service-role access.
 */

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { createSupabaseGmailConnectionStore } from "./server";
import type { GmailConnectionStore } from "./connection";

export type AuthenticatedGmailConnectionStore =
  | { ok: true; store: GmailConnectionStore; username: string }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function getAuthenticatedGmailConnectionStore(): Promise<AuthenticatedGmailConnectionStore> {
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) {
    return { ok: false, reason: "unauthorized" };
  }
  try {
    return {
      ok: true,
      store: createSupabaseGmailConnectionStore(),
      username: session.username,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
