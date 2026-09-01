import type { ReactNode } from "react";
import Link from "next/link";
import {
  conciergeProjectPath,
  formatNoteDate,
  noteSourceLabel,
} from "@/lib/continuum/client-memory/read/presentation";
import { notePreview } from "@/lib/continuum/client-memory/project-desk/status";
import type {
  PersonProjectBook,
  PersonProjectBookSectionId,
} from "@/lib/continuum/client-memory/project-books/types";
import {
  PROJECT_BOOK_CUSTOM_DETAILS_TITLE,
  PROJECT_BOOK_EMPTY,
  PROJECT_BOOK_FOUNDER_REVIEW,
  PROJECT_BOOK_REPAIR_DETAILS_TITLE,
  PROJECT_BOOK_SECTION_TITLE,
  PROJECT_BOOKS_EMPTY,
  PROJECT_BOOKS_SECTION_TITLE,
  projectBookDefaultExpanded,
  projectBookEmailSignal,
  projectBookPanelId,
  projectBookSectionId,
  projectBookSourceSignal,
  projectBookToggleId,
} from "@/lib/continuum/client-memory/project-books/presentation";
import { OPERATING_DETAIL_NOT_SET } from "@/lib/continuum/client-memory/project-operating/fields";
import {
  PROJECT_KIND_NOT_SET_LABEL,
  projectKindChipLabel,
  projectKindLabel,
} from "@/lib/continuum/client-memory/project-kind";
import { ClientMemorySection } from "./client-memory-section";

function HeaderMeta({ book }: { book: PersonProjectBook }) {
  const date = book.lastMeaningfulAt ? formatNoteDate(book.lastMeaningfulAt) : null;
  const sources = projectBookSourceSignal(book.sourceCount);
  const email = projectBookEmailSignal(book.indexedEmailOnFile);
  const kindChip = book.projectKind ? projectKindChipLabel(book.projectKind) : null;
  const chips = [
    book.cadIdentifier,
    book.storedOrderIdentifier,
    kindChip,
    sources,
    email,
    date,
  ].filter((value): value is string => Boolean(value));
  if (chips.length === 0) return null;
  return (
    <ul className="hg-project-book-meta mt-2">
      {chips.map((chip, index) => (
        <li
          key={`${chip}-${index}`}
          className={
            chip === kindChip
              ? "max-w-full break-words text-[10px] uppercase tracking-[0.14em] text-[#ad9164]"
              : "max-w-full break-words text-[12px] tracking-[0.02em] text-[#8d8073]"
          }
        >
          {chip}
        </li>
      ))}
    </ul>
  );
}

function OverviewFields({ book }: { book: PersonProjectBook }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Title", value: book.overview.title },
  ];
  if (book.overview.projectKind) {
    rows.push({
      label: "Project Kind",
      value: projectKindLabel(book.overview.projectKind),
    });
  } else {
    rows.push({
      label: "Project Kind",
      value: PROJECT_KIND_NOT_SET_LABEL,
    });
  }
  if (book.lifecycle.kind !== "none") {
    rows.push({ label: "Lifecycle", value: book.lifecycle.label });
  }
  if (book.overview.cadIdentifier) {
    rows.push({ label: "CAD", value: book.overview.cadIdentifier });
  }
  if (book.overview.storedOrderIdentifier) {
    rows.push({ label: "Order", value: book.overview.storedOrderIdentifier });
  }
  if (book.overview.fingerSize) {
    rows.push({ label: "Finger size", value: book.overview.fingerSize });
  }
  if (book.overview.metal) {
    rows.push({ label: "Metal", value: book.overview.metal });
  }
  if (book.overview.centerStone) {
    rows.push({ label: "Center stone", value: book.overview.centerStone });
  }
  if (book.overview.linkedPeople.length > 0) {
    rows.push({
      label: "People",
      value: book.overview.linkedPeople.map((row) => row.displayName).join(" · "),
    });
  }
  const email = projectBookEmailSignal(book.overview.indexedEmailOnFile);
  if (email) rows.push({ label: "Evidence", value: email });

  return (
    <dl className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            {row.label}
          </dt>
          <dd className="mt-1 break-words text-[14.5px] leading-relaxed text-[#e7ddd2]">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function OperatingDetails({ book }: { book: PersonProjectBook }) {
  if (book.operatingLayer.kind === "none") return null;
  const title =
    book.operatingLayer.kind === "custom_new_jewelry"
      ? PROJECT_BOOK_CUSTOM_DETAILS_TITLE
      : PROJECT_BOOK_REPAIR_DETAILS_TITLE;
  return (
    <div className="mt-5">
      <p className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
        {title}
      </p>
      <dl className="mt-3 space-y-3">
        {book.operatingLayer.fields.map((row) => (
          <div key={row.fieldName}>
            <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              {row.label}
            </dt>
            <dd className="mt-1 break-words text-[14.5px] leading-relaxed text-[#e7ddd2]">
              {row.value?.trim() ? row.value : OPERATING_DETAIL_NOT_SET}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function NestedSection({
  projectId,
  section,
  children,
}: {
  projectId: string;
  section: Exclude<PersonProjectBookSectionId, "overview">;
  children: ReactNode;
}) {
  const panelId = projectBookSectionId(projectId, section);
  return (
    <details className="group mt-4 border-t border-white/[0.06] pt-3">
      <summary
        id={`${panelId}-toggle`}
        aria-controls={panelId}
        className="hg-project-book-toggle flex min-h-11 cursor-pointer list-none items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none focus-visible:text-[#efe8de]"
      >
        {PROJECT_BOOK_SECTION_TITLE[section]}
      </summary>
      <div id={panelId} className="mt-3 min-w-0">
        {children}
      </div>
    </details>
  );
}

function EmptyLine({ children }: { children: string }) {
  return (
    <p className="max-w-[42ch] text-[14.5px] leading-relaxed text-[#c4b7aa]">
      {children}
    </p>
  );
}

function SpecList({ book }: { book: PersonProjectBook }) {
  if (book.itemsAndSpecs.specs.length === 0) {
    return <EmptyLine>{PROJECT_BOOK_EMPTY.itemsAndSpecs}</EmptyLine>;
  }
  return (
    <dl className="space-y-3">
      {book.itemsAndSpecs.specs.map((row) => (
        <div key={row.fieldName}>
          <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            {row.label}
          </dt>
          <dd className="mt-1 break-words text-[14.5px] leading-relaxed text-[#e7ddd2]">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ProjectBookCard({
  book,
  expanded,
}: {
  book: PersonProjectBook;
  expanded: boolean;
}) {
  const toggleId = projectBookToggleId(book.projectId);
  const panelId = projectBookPanelId(book.projectId);
  const communication =
    book.communication.indexedEmailOnFile || book.communication.sourceCount > 0
      ? [
          projectBookEmailSignal(book.communication.indexedEmailOnFile),
          projectBookSourceSignal(book.communication.sourceCount),
        ]
          .filter((value): value is string => Boolean(value))
          .join(" · ")
      : null;

  return (
    <article
      data-project-book={book.projectId}
      className="hg-project-book-card min-w-0 overflow-hidden rounded-[20px] border border-white/[0.07] bg-[#1c1815] px-4 py-4"
    >
      <details className="group" open={expanded || undefined}>
        <summary
          id={toggleId}
          aria-controls={panelId}
          aria-label={
            book.cadIdentifier
              ? `Project Book ${book.title}, ${book.cadIdentifier}`
              : `Project Book ${book.title}`
          }
          className="hg-project-book-toggle flex min-h-11 cursor-pointer list-none items-start justify-between gap-3 outline-none"
        >
          <span className="min-w-0">
            <span className="block font-serif text-[1.22rem] leading-[1.2] tracking-[-0.02em] break-words text-[#efe8de]">
              {book.title}
            </span>
            <HeaderMeta book={book} />
          </span>
          <span className="mt-1 shrink-0 text-[11px] uppercase tracking-[0.2em] text-[#ad9164] group-open:hidden">
            Open
          </span>
          <span className="mt-1 hidden shrink-0 text-[11px] uppercase tracking-[0.2em] text-[#ad9164] group-open:inline">
            Close
          </span>
        </summary>
        <div id={panelId} className="mt-4 min-w-0">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
            {PROJECT_BOOK_SECTION_TITLE.overview}
          </p>
          <OverviewFields book={book} />
          <OperatingDetails book={book} />
          <p className="mt-4">
            <Link
              href={conciergeProjectPath(book.projectId)}
              className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
            >
              Open Project Desk
            </Link>
          </p>

          <NestedSection projectId={book.projectId} section="items-and-specs">
            <SpecList book={book} />
          </NestedSection>

          <NestedSection projectId={book.projectId} section="communication">
            {communication ? (
              <p className="text-[14.5px] leading-relaxed text-[#e7ddd2]">
                {communication}
              </p>
            ) : (
              <EmptyLine>{PROJECT_BOOK_EMPTY.communication}</EmptyLine>
            )}
          </NestedSection>

          <NestedSection
            projectId={book.projectId}
            section="decisions-and-approvals"
          >
            <EmptyLine>{PROJECT_BOOK_EMPTY.decisions}</EmptyLine>
          </NestedSection>

          <NestedSection projectId={book.projectId} section="cad-design">
            {book.cadDesign.cadIdentifier ? (
              <dl>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                    CAD
                  </dt>
                  <dd className="mt-1 break-words text-[14.5px] leading-relaxed text-[#e7ddd2]">
                    {book.cadDesign.cadIdentifier}
                  </dd>
                </div>
              </dl>
            ) : (
              <EmptyLine>{PROJECT_BOOK_EMPTY.cad}</EmptyLine>
            )}
          </NestedSection>

          <NestedSection projectId={book.projectId} section="artifacts">
            <EmptyLine>{PROJECT_BOOK_EMPTY.artifacts}</EmptyLine>
          </NestedSection>

          <NestedSection projectId={book.projectId} section="commercial">
            {book.commercial.storedOrderIdentifier ? (
              <dl className="space-y-3">
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                    Order
                  </dt>
                  <dd className="mt-1 break-words text-[14.5px] leading-relaxed text-[#e7ddd2]">
                    {book.commercial.storedOrderIdentifier}
                  </dd>
                </div>
                {book.commercial.founderReviewRequired ? (
                  <p className="text-[12px] tracking-[0.04em] text-[#ad9164]">
                    {PROJECT_BOOK_FOUNDER_REVIEW}
                  </p>
                ) : null}
              </dl>
            ) : book.commercial.founderReviewRequired ? (
              <p className="text-[12px] tracking-[0.04em] text-[#ad9164]">
                {PROJECT_BOOK_FOUNDER_REVIEW}
              </p>
            ) : (
              <EmptyLine>{PROJECT_BOOK_EMPTY.commercial}</EmptyLine>
            )}
          </NestedSection>

          <NestedSection projectId={book.projectId} section="history-sources">
            {book.history.length > 0 ? (
              <ul className="space-y-4">
                {book.history.map((entry) => {
                  const preview = notePreview(entry.noteText);
                  const dated = formatNoteDate(entry.createdAt);
                  return (
                    <li key={entry.id} className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-[#8d8073]">
                        {[dated, noteSourceLabel(entry)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {preview ? (
                        <p className="mt-1 break-words text-[14.5px] leading-relaxed text-[#e7ddd2]">
                          {preview}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyLine>{PROJECT_BOOK_EMPTY.history}</EmptyLine>
            )}
          </NestedSection>
        </div>
      </details>
    </article>
  );
}

export function PersonProjectBooksSection({
  books,
}: {
  books: PersonProjectBook[];
}) {
  const expanded = projectBookDefaultExpanded(books.length);
  return (
    <ClientMemorySection title={PROJECT_BOOKS_SECTION_TITLE}>
      {books.length === 0 ? (
        <p className="max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          {PROJECT_BOOKS_EMPTY}
        </p>
      ) : (
        <div className="hg-person-project-books space-y-3">
          {books.map((book) => (
            <ProjectBookCard
              key={book.projectId}
              book={book}
              expanded={expanded}
            />
          ))}
        </div>
      )}
    </ClientMemorySection>
  );
}
