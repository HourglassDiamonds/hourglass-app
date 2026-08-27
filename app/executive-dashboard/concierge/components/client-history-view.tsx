import Link from "next/link";
import {
  conciergeClientPath,
  conciergeHistoryPath,
} from "@/lib/continuum/client-memory/read/presentation";
import { COCKPIT_MANUAL_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/read/types";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/types";
import type { PersonSourceHistory } from "@/lib/continuum/client-memory/read/types";
import { ClientMemorySection } from "./client-memory-section";
import { ClientNoteList } from "./client-note-list";

const SOURCE_FILTERS = [
  { id: null, label: "All sources", lifecycle: null },
  { id: COCKPIT_MANUAL_SOURCE_SYSTEM, label: "Concierge", lifecycle: null },
  { id: CLIENT_MEMORY_SOURCE_SYSTEM, label: "Imported", lifecycle: null },
  { id: null, label: "Trashed", lifecycle: "trashed" as const },
] as const;

export function ClientHistoryView({
  history,
  justTrashed = false,
  justRestored = false,
  justSavedNote = false,
}: {
  history: PersonSourceHistory;
  justTrashed?: boolean;
  justRestored?: boolean;
  justSavedNote?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(history.total / history.pageSize));
  const titles = new Map(Object.entries(history.projectTitles));

  return (
    <article>
      <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#efe8de]">
        History / Sources
      </h1>
      <p className="mt-3 font-serif text-[1.15rem] leading-snug tracking-[-0.02em] text-[#d8cfc4]">
        {history.displayName}
      </p>
      <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
        Raw notes and imported evidence. PLAUD and other captures remain in Inbox.
      </p>
      {justSavedNote ? (
        <p className="mt-4 text-[13px] tracking-[0.04em] text-[#c4b7aa]" role="status">
          Note updated.
        </p>
      ) : null}
      {justTrashed ? (
        <p className="mt-4 text-[13px] tracking-[0.04em] text-[#c4b7aa]" role="status">
          Note moved to trash.
        </p>
      ) : null}
      {justRestored ? (
        <p className="mt-4 text-[13px] tracking-[0.04em] text-[#c4b7aa]" role="status">
          Note restored.
        </p>
      ) : null}

      <div
        className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2"
        role="group"
        aria-label="Filter sources"
      >
        {SOURCE_FILTERS.map((item) => {
          const selected =
            (history.sourceSystem ?? null) === item.id &&
            (history.lifecycle ?? null) === item.lifecycle;
          return (
            <Link
              key={item.label}
              href={conciergeHistoryPath(history.personId, {
                source: item.id,
                lifecycle: item.lifecycle,
              })}
              aria-current={selected ? "page" : undefined}
              className={`inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] outline-none ${
                selected
                  ? "text-[#efe8de]"
                  : "text-[#8d8073] hover:text-[#efe8de] focus-visible:text-[#efe8de]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <ClientMemorySection title="Source notes">
        {history.notes.length > 0 ? (
          <ClientNoteList
            notes={history.notes}
            projectTitles={titles}
            personId={history.personId}
            actions
            returnTo="history"
            source={history.sourceSystem}
            page={history.page}
            lifecycle={history.lifecycle}
          />
        ) : (
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            No source notes in this view.
          </p>
        )}
      </ClientMemorySection>

      {totalPages > 1 ? (
        <nav
          className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2"
          aria-label="Source note pages"
        >
          {history.page > 1 ? (
            <Link
              href={conciergeHistoryPath(history.personId, {
                page: history.page - 1,
                source: history.sourceSystem,
                lifecycle: history.lifecycle,
              })}
              className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
            >
              Previous
            </Link>
          ) : null}
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            Page {history.page} of {totalPages}
          </p>
          {history.page < totalPages ? (
            <Link
              href={conciergeHistoryPath(history.personId, {
                page: history.page + 1,
                source: history.sourceSystem,
                lifecycle: history.lifecycle,
              })}
              className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}

      <p className="mt-10">
        <Link
          href={conciergeClientPath(history.personId)}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
        >
          Back to profile
        </Link>
      </p>
    </article>
  );
}
