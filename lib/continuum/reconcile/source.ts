/**
 * PII-safe reader for Studio identified rows used by Continuum reconciliation.
 * Selects only non-PII columns. Never returns email, name, or hash.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { mapStudioConfiguration } from "../ingest/studio-view-emailed";
import type { StudioIdentifiedSourceRef } from "../ingest/studio-view-emailed";
import type {
  StudioIdentifiedSourcePage,
  StudioIdentifiedSourceReader,
} from "./studio-identified";

const SAFE_COLUMNS =
  "id, created_at, configuration, studio_share_path, event, status";

type SafeRow = {
  id: string;
  created_at: string;
  configuration: StudioIdentifiedSourceRef["configuration"];
  studio_share_path: string;
  event: string;
  status: string;
};

export function createMemoryStudioIdentifiedSource(
  rows: StudioIdentifiedSourceRef[],
): StudioIdentifiedSourceReader {
  return {
    async list(input) {
      const slice = rows.slice(input.offset, input.offset + input.limit);
      return {
        rows: slice,
        done: input.offset + slice.length >= rows.length,
      };
    },
  };
}

export function createSupabaseStudioIdentifiedSource(
  client?: SupabaseClient | null,
): StudioIdentifiedSourceReader | null {
  const resolved = client === undefined ? getSupabaseAdmin() : client;
  if (!resolved) return null;
  return {
    async list(input): Promise<StudioIdentifiedSourcePage> {
      const { data, error } = await resolved
        .from("diamond_studio_identified_events")
        .select(SAFE_COLUMNS)
        .eq("event", "studio_view_emailed")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(input.offset, input.offset + input.limit - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []).map((row) => {
        const r = row as SafeRow;
        return {
          identifiedRecordId: r.id,
          occurredAt: r.created_at,
          sharePath: r.studio_share_path,
          configuration: mapStudioConfiguration(r.configuration),
        };
      });
      return { rows, done: rows.length < input.limit };
    },
  };
}
