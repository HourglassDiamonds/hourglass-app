import {
  formatNoteDate,
  noteContextLabel,
  noteProjectTitle,
  noteSourceLabel,
} from "@/lib/continuum/client-memory/read/presentation";
import type { SourceNoteSummary } from "@/lib/continuum/client-memory/read/types";
import {
  ClientNoteActions,
  type NoteActionReturnTo,
} from "./client-note-actions";

export function ClientNoteList({
  notes,
  projectTitles,
  personId,
  actions,
  returnTo = "cockpit",
  source,
  page,
  lifecycle,
}: {
  notes: SourceNoteSummary[];
  projectTitles: Map<string, string>;
  personId?: string;
  actions?: boolean;
  returnTo?: NoteActionReturnTo;
  source?: string | null;
  page?: number;
  lifecycle?: "trashed" | null;
}) {
  if (notes.length === 0) return null;
  return (
    <ol className="space-y-5">
      {notes.map((note) => {
        const context = noteContextLabel(note.contextLayer);
        const sourceLabel = noteSourceLabel(note);
        const date = formatNoteDate(note.createdAt);
        const project = noteProjectTitle(note, projectTitles);
        const provenance = [context, sourceLabel, date, project]
          .filter(Boolean)
          .join(" · ");
        const mode = note.lifecycleStatus === "trashed" ? "trashed" : "active";
        return (
          <li
            key={note.id}
            className="border-t border-white/[0.06] pt-5 first:border-t-0 first:pt-0"
          >
            <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.55] text-[#e9dfd4]">
              {note.noteText}
            </p>
            {provenance ? (
              <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                {provenance}
              </p>
            ) : null}
            {actions && personId ? (
              <ClientNoteActions
                personId={personId}
                noteId={note.id}
                mode={mode}
                returnTo={returnTo}
                source={source}
                page={page}
                lifecycle={lifecycle}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
