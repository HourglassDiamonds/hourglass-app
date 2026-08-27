import Link from "next/link";
import {
  conciergeAddNotePath,
  conciergeBirthdayPath,
  conciergeEditPersonPath,
  conciergeHistoryPath,
  conciergeInboxPath,
  formatFactValue,
  formatFactLabel,
  memoryReviewLabel,
  relationshipLabel,
  wishHeadline,
} from "@/lib/continuum/client-memory/read/presentation";
import { partitionCockpitProjects } from "@/lib/continuum/client-memory/read/cockpit";
import type { PersonCockpit } from "@/lib/continuum/client-memory/read/types";
import { ClientMemorySection } from "./client-memory-section";
import { ClientNoteList } from "./client-note-list";
import { ClientProfileHeader } from "./client-profile-header";
import { ClientProjectCard } from "./client-project-card";

export function ClientProfileView({
  cockpit,
  justSaved = false,
  justSavedBirthday = false,
  justSavedClient = false,
  justExistingClient = false,
  justSavedProfile = false,
  justSavedNote = false,
  justMovedNote = false,
  justTrashedNote = false,
}: {
  cockpit: PersonCockpit;
  justSaved?: boolean;
  justSavedBirthday?: boolean;
  justSavedClient?: boolean;
  justExistingClient?: boolean;
  justSavedProfile?: boolean;
  justSavedNote?: boolean;
  justMovedNote?: boolean;
  justTrashedNote?: boolean;
}) {
  const birthdayValue = cockpit.birthday
    ? formatFactValue(cockpit.birthday)
    : null;
  const personalFacts = cockpit.personalFacts
    .map((fact) => {
      const value = formatFactValue(fact);
      if (!value) return null;
      return { id: fact.id, label: formatFactLabel(fact.factType), value };
    })
    .filter((row): row is { id: string; label: string; value: string } => row != null);
  const memoryReview = memoryReviewLabel(
    cockpit.reviews.candidateCount,
    cockpit.reviews.conflictingCount,
  );
  const showCurrentContext =
    cockpit.recentManualNotes.length > 0 ||
    cockpit.wishes.length > 0 ||
    Boolean(memoryReview);
  const showPersonal = Boolean(birthdayValue) || personalFacts.length > 0;
  const showWork =
    Boolean(cockpit.work.organizationName?.trim()) || cockpit.work.roles.length > 0;
  const projectTitles = Object.fromEntries(
    cockpit.projects.map((project) => [
      project.profile.projectId,
      project.profile.displayTitle,
    ]),
  );
  const { preview, remaining } = partitionCockpitProjects(cockpit.projects);

  return (
    <article>
      <ClientProfileHeader
        person={cockpit.person}
        openCount={cockpit.reviews.openCount}
      />

      {justSaved ? (
        <p className="mt-6 text-[13px] tracking-[0.04em] text-[#c4b7aa]" role="status">
          Note saved.
        </p>
      ) : null}
      {justSavedBirthday ? (
        <p className="mt-6 text-[13px] tracking-[0.04em] text-[#c4b7aa]" role="status">
          Birthday saved.
        </p>
      ) : null}
      {justSavedClient ? (
        <p className="mt-6 text-[13px] tracking-[0.04em] text-[#c4b7aa]" role="status">
          Client added.
        </p>
      ) : null}
      {justExistingClient ? (
        <p className="mt-6 text-[13px] tracking-[0.04em] text-[#c4b7aa]" role="status">
          This person was already in Continuum. Client status is now active.
        </p>
      ) : null}
      {justSavedProfile ? (
        <p className="mt-6 text-[13px] tracking-[0.04em] text-[#c4b7aa]" role="status">
          Updated.
        </p>
      ) : null}
      {justSavedNote ? (
        <p className="mt-6 text-[13px] tracking-[0.04em] text-[#c4b7aa]" role="status">
          Note updated.
        </p>
      ) : null}
      {justMovedNote ? (
        <p className="mt-6 text-[13px] tracking-[0.04em] text-[#c4b7aa]" role="status">
          Note moved.
        </p>
      ) : null}
      {justTrashedNote ? (
        <p className="mt-6 text-[13px] tracking-[0.04em] text-[#c4b7aa]" role="status">
          Note moved to trash.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link
          href={conciergeEditPersonPath(cockpit.person.id)}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          Edit
        </Link>
        <Link
          href={conciergeAddNotePath(cockpit.person.id)}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          Add Note
        </Link>
        <Link
          href={conciergeBirthdayPath(cockpit.person.id)}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          {birthdayValue ? "Edit birthday" : "Add birthday"}
        </Link>
      </div>

      {showCurrentContext ? (
        <ClientMemorySection title="Current context">
          {memoryReview ? (
            <p className="text-[12px] tracking-[0.04em] text-[#ad9164]">
              {memoryReview}
            </p>
          ) : null}
          {cockpit.wishes.length > 0 ? (
            <div className={memoryReview ? "mt-6" : undefined}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                On their radar
              </p>
              <ul className="mt-3 space-y-3">
                {cockpit.wishes.map((wish) => (
                  <li
                    key={wish.id}
                    className="font-serif text-[1.15rem] leading-snug tracking-[-0.02em] text-[#efe8de]"
                  >
                    {wishHeadline(wish)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {cockpit.recentManualNotes.length > 0 ? (
            <div
              className={
                memoryReview || cockpit.wishes.length > 0 ? "mt-6" : undefined
              }
            >
              <ClientNoteList
                notes={cockpit.recentManualNotes}
                projectTitles={new Map(Object.entries(projectTitles))}
                personId={cockpit.person.id}
                actions
                returnTo="cockpit"
              />
            </div>
          ) : null}
        </ClientMemorySection>
      ) : null}

      {showPersonal ? (
        <ClientMemorySection title="Personal">
          <dl className="space-y-4">
            {birthdayValue ? (
              <div>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                  Birthday
                </dt>
                <dd className="mt-1 font-serif text-[1.2rem] leading-snug tracking-[-0.02em] text-[#efe8de]">
                  {birthdayValue}
                </dd>
              </div>
            ) : null}
            {personalFacts.map((fact) => (
              <div key={fact.id}>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                  {fact.label}
                </dt>
                <dd className="mt-1 font-serif text-[1.2rem] leading-snug tracking-[-0.02em] text-[#efe8de]">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </ClientMemorySection>
      ) : null}

      {cockpit.relationships.length > 0 ? (
        <ClientMemorySection title="Relationships">
          <ul className="space-y-3">
            {cockpit.relationships.map((row) => {
              const kind = relationshipLabel(row.kind) ?? row.kind;
              return (
                <li key={row.id}>
                  <p className="font-serif text-[1.15rem] leading-snug tracking-[-0.02em] text-[#efe8de]">
                    {row.counterpartName}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                    {kind}
                  </p>
                </li>
              );
            })}
          </ul>
        </ClientMemorySection>
      ) : null}

      {showWork ? (
        <ClientMemorySection title="Work">
          {cockpit.work.organizationName ? (
            <p className="font-serif text-[1.2rem] leading-snug tracking-[-0.02em] text-[#efe8de]">
              {cockpit.work.organizationName}
            </p>
          ) : null}
          {cockpit.work.roles.length > 0 ? (
            <p
              className={`text-[11px] uppercase tracking-[0.18em] text-[#8d8073] ${
                cockpit.work.organizationName ? "mt-2" : ""
              }`}
            >
              {cockpit.work.roles.join(" · ")}
            </p>
          ) : null}
        </ClientMemorySection>
      ) : null}

      {cockpit.projects.length > 0 ? (
        <ClientMemorySection title="Projects">
          <div className="space-y-3">
            {preview.map((project) => (
              <ClientProjectCard
                key={project.profile.projectId}
                project={project}
              />
            ))}
          </div>
          {remaining.length > 0 ? (
            <details className="group mt-4">
              <summary className="flex min-h-11 cursor-pointer list-none items-center text-[12px] uppercase tracking-[0.2em] text-[#ad9164] outline-none focus-visible:text-[#efe8de]">
                <span className="group-open:hidden">
                  Imported or other projects · {remaining.length}
                </span>
                <span className="hidden group-open:inline">Hide imported or other projects</span>
              </summary>
              <div className="mt-3 space-y-3">
                {remaining.map((project) => (
                  <ClientProjectCard
                    key={project.profile.projectId}
                    project={project}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </ClientMemorySection>
      ) : null}

      <ClientMemorySection title="History / Sources">
        <p className="max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          {cockpit.history.noteCount > 0
            ? cockpit.history.noteCount === 1
              ? "1 source note on file."
              : `${cockpit.history.noteCount} source notes on file.`
            : "Source notes and imported evidence live here."}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link
            href={conciergeHistoryPath(cockpit.person.id)}
            className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
          >
            View sources
          </Link>
          <Link
            href={conciergeInboxPath()}
            className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
          >
            Inbox
          </Link>
        </div>
      </ClientMemorySection>
    </article>
  );
}

export function ConciergeBackLink() {
  return (
    <Link
      href="/executive-dashboard/concierge"
      aria-label="Back to Continuum"
      className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
    >
      ← Continuum
    </Link>
  );
}

export function ConciergeUnavailable({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div>
      <ConciergeBackLink />
      <h1 className="mt-8 font-serif text-[2rem] leading-[1.1] tracking-[-0.04em] text-[#efe8de]">
        {title}
      </h1>
      <p className="mt-4 max-w-[28ch] text-[15px] leading-relaxed text-[#c4b7aa]">
        {body}
      </p>
    </div>
  );
}