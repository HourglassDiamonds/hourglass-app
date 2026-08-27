import Link from "next/link";
import {
  conciergeEditNotePath,
  conciergeMoveNotePath,
  conciergeRestoreNotePath,
  conciergeTrashNotePath,
} from "@/lib/continuum/client-memory/read/presentation";
import type { NoteActionReturnTo } from "./client-note-actions-types";

export type { NoteActionReturnTo };

export function ClientNoteActions({
  personId,
  noteId,
  mode,
  returnTo,
}: {
  personId: string;
  noteId: string;
  mode: "active" | "trashed";
  returnTo: NoteActionReturnTo;
  source?: string | null;
  page?: number;
  lifecycle?: "trashed" | null;
}) {
  const from = returnTo === "history" ? "?from=history" : "";
  return (
    <div className="mt-3">
      <details className="group">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]">
          Actions
        </summary>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          {mode === "active" ? (
            <>
              <Link
                href={`${conciergeEditNotePath(personId, noteId)}${from}`}
                className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
              >
                Edit
              </Link>
              <Link
                href={`${conciergeMoveNotePath(personId, noteId)}${from}`}
                className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
              >
                Move
              </Link>
              <Link
                href={`${conciergeTrashNotePath(personId, noteId)}${from}`}
                className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
              >
                Trash
              </Link>
            </>
          ) : (
            <Link
              href={`${conciergeRestoreNotePath(personId, noteId)}${from}`}
              className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
            >
              Restore
            </Link>
          )}
        </div>
      </details>
    </div>
  );
}
