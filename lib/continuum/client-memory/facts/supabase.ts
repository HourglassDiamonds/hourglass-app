/**
 * Supabase Client Memory structured-fact writer.
 * App Router / server entry: import from `./server` (enforces `server-only`).
 * Do not import from client components or public routes.
 * Service-role RPC only. Never writes Notes, Wishes, or kernel Event/Evidence/Observation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { createSupabaseClientMemoryStore } from "../persistence/supabase";
import { setManualBirthday } from "./write";
import type { ClientMemoryFactWriter } from "./writer";
import type { SetManualBirthdayInput, SetManualBirthdayResult } from "./write";

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

export class SupabaseClientMemoryFactWriter implements ClientMemoryFactWriter {
  constructor(private readonly client: SupabaseClient) {}

  setManualBirthday(input: SetManualBirthdayInput): Promise<SetManualBirthdayResult> {
    const store = createSupabaseClientMemoryStore(this.client);
    return setManualBirthday(
      {
        nowIso: () => new Date().toISOString(),
        getEntity: (id) => store.getEntity(id),
        setCurrentPersonFact: (fact) => store.setCurrentPersonFact(fact),
      },
      input,
    );
  }
}

export function createSupabaseClientMemoryFactWriter(
  client?: SupabaseClient | null,
): SupabaseClientMemoryFactWriter {
  return new SupabaseClientMemoryFactWriter(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}
