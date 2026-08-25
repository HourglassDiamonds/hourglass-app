/**
 * Supabase Client Memory Person writer.
 * App Router / server entry: import from `./server` (enforces `server-only`).
 * Do not import from client components or public routes.
 * Service-role only. Never writes Notes, Facts, Wishes, or kernel Event/Evidence/Observation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { createSupabaseClientMemoryStore } from "../persistence/supabase";
import { addManualClient } from "./add-manual-client";
import { editPersonProfile } from "./edit-person";
import type { ClientMemoryPersonWriter } from "./writer";
import type {
  AddManualClientInput,
  AddManualClientResult,
  EditPersonProfileInput,
  EditPersonProfileResult,
} from "./types";

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

export class SupabaseClientMemoryPersonWriter implements ClientMemoryPersonWriter {
  constructor(private readonly client: SupabaseClient) {}

  addManualClient(input: AddManualClientInput): Promise<AddManualClientResult> {
    const store = createSupabaseClientMemoryStore(this.client);
    return addManualClient(
      {
        nowIso: () => new Date().toISOString(),
        findActiveIdentities: (query) => store.findActiveIdentities(query),
        createPersonAtomic: (row) => store.createPersonAtomic(row),
        getPersonProfile: (personId) => store.getPersonProfile(personId),
        updatePersonProfile: (personId, patch) =>
          store.updatePersonProfile(personId, patch),
      },
      input,
    );
  }

  editPersonProfile(input: EditPersonProfileInput): Promise<EditPersonProfileResult> {
    const store = createSupabaseClientMemoryStore(this.client);
    return editPersonProfile(
      {
        nowIso: () => new Date().toISOString(),
        findActiveIdentities: (query) => store.findActiveIdentities(query),
        getPersonProfile: (personId) => store.getPersonProfile(personId),
        updatePersonContactAtomic: (row) => store.updatePersonContactAtomic(row),
      },
      input,
    );
  }
}

export function createSupabaseClientMemoryPersonWriter(
  client?: SupabaseClient | null,
): SupabaseClientMemoryPersonWriter {
  return new SupabaseClientMemoryPersonWriter(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}
