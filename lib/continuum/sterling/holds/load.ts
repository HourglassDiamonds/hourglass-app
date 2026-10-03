import "server-only";
import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { ConditionalHoldRepository } from "./types";
import { CONDITIONAL_HOLDS_TABLE, SupabaseConditionalHoldRepository } from "./supabase";

export async function getAuthenticatedConditionalHoldRepository(): Promise<{ ok: true; repository: ConditionalHoldRepository } | { ok: false; reason: "unauthorized" | "unavailable" | "not-activated" }> {
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value);
  if (!session.ok) return { ok: false, reason: "unauthorized" };
  const client = getSupabaseAdmin(); if (!client) return { ok: false, reason: "unavailable" };
  const { error } = await client.from(CONDITIONAL_HOLDS_TABLE).select("hold_id").limit(1);
  if (error) return { ok: false, reason: error.code === "42P01" || error.code === "PGRST205" ? "not-activated" : "unavailable" };
  return { ok: true, repository: new SupabaseConditionalHoldRepository(client) };
}
