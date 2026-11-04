import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { SupabaseConciergeFunnelStore } from "./supabase";

export function createSupabaseConciergeFunnelStore(
  client: SupabaseClient | null = getSupabaseAdmin(),
): SupabaseConciergeFunnelStore {
  if (!client) throw new Error("supabase-admin-unavailable");
  return new SupabaseConciergeFunnelStore(client);
}
