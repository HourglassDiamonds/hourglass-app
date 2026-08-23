import {
  formatNoteDate,
  noteProjectTitle,
  noteSourceLabel,
} from "@/lib/continuum/client-memory/read/presentation";
import type { SourceNoteSummary } from "@/lib/continuum/client-memory/read/types";

export function ClientNoteList({
  notes,
  projectTitles,
}: {
  notes: SourceNoteSummary[];
  projectTitles: Map<string, string>;
}) {
  if (notes.length === 0) return null;
  return (
    <ol className="space-y-5">
      {notes.map((note) => {
        const source = noteSourceLabel(note);
        const date = formatNoteDate(note.createdAt);
        const project = noteProjectTitle(note, projectTitles);
        const provenance = [source, date, project].filter(Boolean).join(" · ");
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
          </li>
        );
      })}
    </ol>
  );
}
