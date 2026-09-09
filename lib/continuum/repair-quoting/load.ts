/**
 * Server-only founder repair-quote reader.
 * Quotes stay disconnected if the live Repair Quotes relation is missing.
 */

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { REPAIR_QUOTE_COLUMNS, rowToRepairQuote } from "./rows";
import type { RepairQuote } from "./types";

export type AuthenticatedRepairQuoteReader =
  | { ok: true; connected: true; listQuotes: (projectId: string) => Promise<RepairQuote[]>; getQuote: (projectId: string, quoteId: string) => Promise<RepairQuote | null> }
  | { ok: true; connected: false }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function getAuthenticatedRepairQuoteReader(): Promise<AuthenticatedRepairQuoteReader> {
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) return { ok: false, reason: "unauthorized" };
  const client = getSupabaseAdmin();
  if (!client) return { ok: false, reason: "unavailable" };
  const probe = await client.from("continuum_repair_quotes").select("quote_id").limit(1);
  if (probe.error && missingRelation(probe.error.message)) {
    return { ok: true, connected: false };
  }
  if (probe.error) return { ok: false, reason: "unavailable" };
  return {
    ok: true,
    connected: true,
    async listQuotes(projectId: string) {
      const { data, error } = await client
        .from("continuum_repair_quotes")
        .select(REPAIR_QUOTE_COLUMNS)
        .eq("project_id", projectId)
        .order("quote_number", { ascending: false });
      if (error) throw error;
      return (data ?? []).flatMap((row) => {
        const mapped = rowToRepairQuote(row as Record<string, unknown>);
        return mapped ? [mapped] : [];
      });
    },
    async getQuote(projectId: string, quoteId: string) {
      const { data, error } = await client
        .from("continuum_repair_quotes")
        .select(REPAIR_QUOTE_COLUMNS)
        .eq("project_id", projectId)
        .eq("quote_id", quoteId)
        .maybeSingle();
      if (error) throw error;
      const mapped = rowToRepairQuote((data ?? null) as Record<string, unknown> | null);
      return mapped && mapped.projectId === projectId ? mapped : null;
    },
  };
}

function missingRelation(message: string): boolean {
  return /could not find the table|relation .* does not exist|schema cache/i.test(
    message,
  );
}
