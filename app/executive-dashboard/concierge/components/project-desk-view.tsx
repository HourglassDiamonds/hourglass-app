import Link from "next/link";
import {
  conciergeAddNotePath,
  conciergeClientPath,
  formatNoteDate,
  noteContextLabel,
  noteSourceLabel,
} from "@/lib/continuum/client-memory/read/presentation";
import type { ProjectDeskRead } from "@/lib/continuum/client-memory/project-desk/types";
import { coverageRows } from "@/lib/continuum/client-memory/project-desk/status";
import { ClientMemorySection } from "./client-memory-section";

export function ProjectDeskView({
  desk,
}: {
  desk: ProjectDeskRead;
}) {
  const coverage = coverageRows(desk.coverage);
  const notePeople = desk.people;

  return (
    <article>
      <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#efe8de]">
        {desk.title}
      </h1>

      <section className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#ad9164]">
          Status unknown
        </p>
        <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          {desk.operationalStatus.evidence}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          {coverage.map((row) => (
            <div key={row.label}>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-[#8d8073]">
                {row.label}
              </dt>
              <dd className="mt-1 text-[13px] text-[#d8cfc4]">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {desk.people.length > 0 ? (
        <ClientMemorySection title="People">
          <ul className="space-y-3">
            {desk.people.map((person) => (
              <li key={person.personId}>
                <Link
                  href={conciergeClientPath(person.personId)}
                  className="inline-flex min-h-11 items-center font-serif text-[1.2rem] leading-snug tracking-[-0.02em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164]"
                >
                  {person.displayName}
                </Link>
              </li>
            ))}
          </ul>
        </ClientMemorySection>
      ) : (
        <ClientMemorySection title="People">
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            No people are linked to this project.
          </p>
        </ClientMemorySection>
      )}

      {desk.specs.length > 0 ? (
        <ClientMemorySection title="Project Details">
          <dl className="space-y-3">
            {desk.specs.map((row) => (
              <div key={row.label}>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                  {row.label}
                </dt>
                <dd className="mt-1 break-words text-[15px] leading-relaxed text-[#e7ddd2]">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </ClientMemorySection>
      ) : null}

      {desk.latestNotePreview ? (
        <ClientMemorySection title="Latest Context">
          <p className="text-[15px] leading-relaxed text-[#e9dfd4]">
            {desk.latestNotePreview}
          </p>
          {desk.latestNoteAt ? (
            <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              {formatNoteDate(desk.latestNoteAt)}
            </p>
          ) : null}
        </ClientMemorySection>
      ) : null}

      {desk.notes.length > 0 ? (
        <ClientMemorySection title="Notes">
          <ol className="space-y-5">
            {desk.notes.map((note) => {
              const provenance = [
                noteContextLabel(note.contextLayer),
                noteSourceLabel({ sourceSystem: note.sourceSystem }),
                formatNoteDate(note.createdAt),
                note.personName,
              ]
                .filter(Boolean)
                .join(" · ");
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
        </ClientMemorySection>
      ) : null}

      <ClientMemorySection title="Open Jobs">
        <p className="text-[15px] leading-relaxed text-[#c4b7aa]">Not connected yet</p>
      </ClientMemorySection>

      <ClientMemorySection title="Renders">
        <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
          No project files stored yet
        </p>
      </ClientMemorySection>

      {notePeople.length === 1 ? (
        <div className="mt-10">
          <Link
            href={conciergeAddNotePath(notePeople[0].personId)}
            className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
          >
            Add Note
          </Link>
        </div>
      ) : notePeople.length > 1 ? (
        <ClientMemorySection title="Add a note">
          <ul className="space-y-2">
            {notePeople.map((person) => (
              <li key={person.personId}>
                <Link
                  href={conciergeAddNotePath(person.personId)}
                  className="inline-flex min-h-11 items-center text-[15px] text-[#d8cfc4] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
                >
                  {person.displayName}
                </Link>
              </li>
            ))}
          </ul>
        </ClientMemorySection>
      ) : null}
    </article>
  );
}
