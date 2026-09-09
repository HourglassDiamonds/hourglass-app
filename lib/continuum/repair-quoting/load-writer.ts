/**
 * Server-only founder repair-quote writer loader.
 */

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { createSupabaseRepairQuoteWriter } from "./server";
import type { RepairQuoteWriter } from "./writer";

export type AuthenticatedRepairQuoteWriter =
  | { ok: true; writer: RepairQuoteWriter; username: string }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function getAuthenticatedRepairQuoteWriter(): Promise<AuthenticatedRepairQuoteWriter> {
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) return { ok: false, reason: "unauthorized" };
  try {
    return {
      ok: true,
      writer: createSupabaseRepairQuoteWriter(),
      username: session.username,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
