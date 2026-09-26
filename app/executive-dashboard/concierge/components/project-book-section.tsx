"use client";

import { useState } from "react";
import type { ProjectBookView, ProjectBookViewEvidence } from "@/lib/continuum/project-book/present";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "client", label: "Client" },
  { id: "founder", label: "Founder" },
  { id: "shop", label: "Shop" },
  { id: "attachments", label: "Attachments" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function matches(
  filter: FilterId,
  actor: string,
  attachmentLabels: readonly string[],
): boolean {
  if (filter === "all") return true;
  if (filter === "attachments") return attachmentLabels.length > 0;
  if (filter === "shop") return actor === "vendor_shop";
  return actor === filter;
}

function EvidenceDetails({ evidence }: { evidence: readonly ProjectBookViewEvidence[] }) {
  if (evidence.length === 0) return null;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        Evidence
      </summary>
      <ul className="mt-2 space-y-2">
        {evidence.map((row, index) => (
          <li key={`${row.channel}-${row.displayDate}-${index}`} className="text-[13px] leading-relaxed text-[#c4b7aa]">
            <p>
              {row.channel} · {row.displayDate}
            </p>
            {row.subject ? <p className="mt-1">{row.subject}</p> : null}
            {row.attachmentNames.length > 0 ? (
              <p className="mt-1">{row.attachmentNames.join(", ")}</p>
            ) : null}
            <p className="mt-1 uppercase tracking-[0.14em] text-[#8d8073]">
              {row.classification}
              {row.interpretation === "source_only" ? " · source only" : ""}
              {row.interpretation === "needs_review" ? " · needs review" : ""}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ProjectBookSection({ book }: { book: ProjectBookView }) {
  const [filter, setFilter] = useState<FilterId>("all");
  const milestones = book.milestones.filter((row) =>
    matches(filter, row.actor, row.attachmentLabels),
  );
  const timeline = book.evidenceTimeline.filter((row) =>
    matches(filter, row.actor, row.attachmentLabels),
  );

  return (
    <section className="mt-10" aria-label="Project Book">
      <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#ad9164]">Project Book</h2>

      <div className="mt-4 max-w-[46ch]">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">Current state</p>
        <p className="mt-2 text-[15px] leading-relaxed text-[#efe8de]">{book.currentState.headline}</p>
        <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Last meaningful change
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-[#e7ddd2]">
          {book.currentState.lastMeaningfulChange
            ? `${book.currentState.lastMeaningfulChange.label} · ${book.currentState.lastMeaningfulChange.displayDate}`
            : "None on file"}
        </p>
        {book.currentState.lastMeaningfulChange ? (
          <p className="mt-1 text-[13px] leading-relaxed text-[#c4b7aa]">
            {book.currentState.lastMeaningfulChange.summary}
          </p>
        ) : null}
        <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Next known checkpoint
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-[#e7ddd2]">
          {book.currentState.nextCheckpoint?.summary ?? "No checkpoint on file"}
        </p>
        {book.currentState.nextCheckpoint ? (
          <p className="mt-1 text-[12px] leading-relaxed text-[#8d8073]">
            {book.currentState.nextCheckpoint.basisLabel}
          </p>
        ) : null}
      </div>

      {book.historyState === "needs_review" ? (
        <div className="mt-6 max-w-[46ch]">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#ad9164]">
            Project history needs review
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#e7ddd2]">
            {book.associationReview?.summary}
          </p>
        </div>
      ) : book.associationReview ? (
        <p className="mt-6 max-w-[46ch] text-[13px] leading-relaxed text-[#ad9164]">
          {book.associationReview.summary}. {book.associationReview.count} source{" "}
          {book.associationReview.count === 1 ? "item was" : "items were"} left out.
        </p>
      ) : null}

      <h3 className="mt-8 text-[11px] uppercase tracking-[0.22em] text-[#8d8073]">Open loops</h3>
      {book.historyState !== "trusted" ? (
        <p className="mt-3 text-[15px] leading-relaxed text-[#c4b7aa]">No confirmed open obligation.</p>
      ) : book.unresolved.length === 0 ? (
        <p className="mt-3 text-[15px] leading-relaxed text-[#c4b7aa]">No open obligation.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {book.unresolved.map((row) => (
            <li key={row.holder} className="text-[15px] leading-relaxed text-[#e7ddd2]">
              {row.label}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="History filters">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={`min-h-11 px-3 text-[11px] uppercase tracking-[0.16em] ${
              filter === item.id ? "text-[#efe8de]" : "text-[#8d8073]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <h3 className="mt-6 text-[11px] uppercase tracking-[0.22em] text-[#8d8073]">Milestones</h3>
      {book.historyState === "needs_review" ? (
        <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          Not shown until the association is confirmed.
        </p>
      ) : book.empty ? (
        <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          No source history is associated with this project yet.
        </p>
      ) : milestones.length === 0 ? (
        <p className="mt-3 text-[15px] leading-relaxed text-[#c4b7aa]">No milestones in this view.</p>
      ) : (
        <ol className="mt-3 divide-y divide-[#2a2622]">
          {milestones.map((row, index) => (
            <li key={`${row.displayDate}-${row.label}-${index}`} className="py-4">
              <p className="text-[12px] uppercase tracking-[0.16em] text-[#8d8073]">{row.displayDate}</p>
              <p className="mt-1 text-[12px] uppercase tracking-[0.18em] text-[#ad9164]">{row.label}</p>
              <p className="mt-1 max-w-[52ch] text-[15px] leading-relaxed text-[#efe8de]">{row.summary}</p>
              {row.attachmentLabels.length > 0 ? (
                <p className="mt-1 text-[12px] uppercase tracking-[0.14em] text-[#c4b7aa]">
                  {row.attachmentLabels.join(" · ")}
                </p>
              ) : null}
              <EvidenceDetails evidence={row.evidence} />
            </li>
          ))}
        </ol>
      )}

      <h3 className="mt-8 text-[11px] uppercase tracking-[0.22em] text-[#8d8073]">History</h3>
      {book.historyState === "needs_review" ? (
        <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          Not shown until the association is confirmed.
        </p>
      ) : timeline.length === 0 ? (
        <p className="mt-3 text-[15px] leading-relaxed text-[#c4b7aa]">
          {book.empty ? "No evidence timeline yet." : "No history in this view."}
        </p>
      ) : (
        <ol className="mt-3 divide-y divide-[#2a2622]">
          {timeline.map((row, index) => (
            <li key={`${row.displayDate}-${row.summary}-${index}`} className="py-3">
              <p className="text-[12px] uppercase tracking-[0.16em] text-[#8d8073]">
                {row.displayDate}
                {row.attachmentLabels.length > 0 ? ` · ${row.attachmentLabels.join(" · ")}` : ""}
              </p>
              <p className="mt-1 max-w-[52ch] text-[14px] leading-relaxed text-[#e7ddd2]">{row.summary}</p>
              {row.excerpt ? (
                <p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-[#c4b7aa]">{row.excerpt}</p>
              ) : null}
              <EvidenceDetails evidence={[row.evidence]} />
            </li>
          ))}
        </ol>
      )}
      {book.evidenceOmittedCount > 0 ? (
        <p className="mt-3 text-[12px] leading-relaxed text-[#8d8073]">
          Earlier evidence omitted from this view ({book.evidenceOmittedCount}).
        </p>
      ) : null}

      <div className="mt-8 max-w-[46ch] text-[13px] leading-relaxed text-[#8d8073]">
        <p>Sources currently represented</p>
        <p className="mt-1 text-[#c4b7aa]">
          {book.representedLabels.length > 0 ? book.representedLabels.join(", ") : "None"}
        </p>
        <p className="mt-3">Future architecture may include</p>
        <p className="mt-1">{book.futureLabels.join(", ")}</p>
      </div>
    </section>
  );
}
