import type { SupabaseClient } from "@supabase/supabase-js";
import { SOURCE_NOTE_COLUMNS, rowToSourceNote } from "@/lib/continuum/client-memory/source-note-row";
import { sterlingFounderDirectiveFromNote, STERLING_FOUNDER_DIRECTIVE_PREFIX } from "./founder-directive";
import type { SterlingFounderDirectiveRecord } from "./types";

/** Authenticated, bounded read of durable Sterling founder authority. */
export async function loadSterlingFounderDirectives(
  client: SupabaseClient,
): Promise<SterlingFounderDirectiveRecord[]> {
  const directives: SterlingFounderDirectiveRecord[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("continuum_source_notes")
      .select(SOURCE_NOTE_COLUMNS)
      .eq("source_system", "concierge-manual")
      .eq("lifecycle_status", "kept")
      .like("note_text", `${STERLING_FOUNDER_DIRECTIVE_PREFIX}%`)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    for (const row of data ?? []) {
      const directive = sterlingFounderDirectiveFromNote(rowToSourceNote(row as Record<string, unknown>));
      if (directive) directives.push(directive);
    }
    if ((data ?? []).length < 1000) return directives;
  }
}
