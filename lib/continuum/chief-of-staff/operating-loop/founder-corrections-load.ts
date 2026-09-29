import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SOURCE_NOTE_COLUMNS,
  rowToSourceNote,
} from "@/lib/continuum/client-memory/source-note-row";
import { correctionEventsFromNotes } from "@/lib/continuum/concierge-sol/founder-command";
import type { SourceCommunicationEvent } from "@/lib/continuum/source-events/types";

/** Called only by the authenticated Today loader; one paginated read, not one full desk read per project. */
export async function loadFounderCorrectionEvents(
  client: SupabaseClient,
): Promise<SourceCommunicationEvent[]> {
  const events: SourceCommunicationEvent[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("continuum_source_notes")
      .select(SOURCE_NOTE_COLUMNS)
      .eq("source_system", "concierge-manual")
      .eq("lifecycle_status", "kept")
      .like("note_text", "Founder current truth v1: %")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    for (const row of data ?? []) {
      const note = rowToSourceNote(row as Record<string, unknown>);
      if (note.projectId && !note.deletedAt)
        events.push(
          ...correctionEventsFromNotes(note.projectId, [
            { ...note, personName: null },
          ]),
        );
    }
    if ((data ?? []).length < 1000) return events;
  }
}
