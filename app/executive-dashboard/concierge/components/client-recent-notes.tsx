"use client";

import { useMemo, useState } from "react";
import {
  RELATIONSHIP_CONTEXT_LAYER_LABELS,
} from "@/lib/continuum/client-memory/read/presentation";
import type { SourceNoteSummary } from "@/lib/continuum/client-memory/read/types";
import {
  RELATIONSHIP_CONTEXT_LAYERS,
  type RelationshipContextLayer,
} from "@/lib/continuum/client-memory/types";
import { ClientNoteList } from "./client-note-list";

type Filter = "all" | RelationshipContextLayer;

const FILTERS: Filter[] = ["all", ...RELATIONSHIP_CONTEXT_LAYERS];

export function ClientRecentNotes({
  notes,
  projectTitles,
}: {
  notes: SourceNoteSummary[];
  projectTitles: Record<string, string>;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = useMemo(
    () =>
      filter === "all"
        ? notes
        : notes.filter((note) => note.contextLayer === filter),
    [filter, notes],
  );
  const titles = useMemo(
    () => new Map(Object.entries(projectTitles)),
    [projectTitles],
  );

  return (
    <div>
      <div
        className="hg-concierge-note-filters mb-5"
        role="group"
        aria-label="Filter notes by context"
      >
        {FILTERS.map((item) => {
          const selected = filter === item;
          const label =
            item === "all" ? "All" : RELATIONSHIP_CONTEXT_LAYER_LABELS[item];
          return (
            <button
              key={item}
              type="button"
              aria-pressed={selected}
              onClick={() => setFilter(item)}
              className={`hg-concierge-note-filter ${selected ? "is-selected" : ""}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {visible.length > 0 ? (
        <ClientNoteList notes={visible} projectTitles={titles} />
      ) : (
        <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
          No notes in this context.
        </p>
      )}
    </div>
  );
}
