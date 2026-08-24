import Link from "next/link";
import {
  conciergeAddNotePath,
  memoryReviewLabel,
  relationshipLabel,
  visibleCurrentFacts,
  wishHeadline,
} from "@/lib/continuum/client-memory/read/presentation";
import type { ConciergePersonProfile } from "@/lib/continuum/client-memory/read/types";
import { ClientMemorySection } from "./client-memory-section";
import { ClientProfileHeader } from "./client-profile-header";
import { ClientProjectCard } from "./client-project-card";
import { ClientRecentNotes } from "./client-recent-notes";

export function ClientProfileView({
  profile,
  justSaved = false,
}: {
  profile: ConciergePersonProfile;
  justSaved?: boolean;
}) {
  const facts = visibleCurrentFacts(profile.facts.current);
  const memoryReview = memoryReviewLabel(
    profile.facts.candidateCount,
    profile.facts.conflictingCount,
  );
  const social = profile.relationships
    .map((row) => {
      const label = relationshipLabel(row.kind);
      if (!label) return null;
      return { id: row.id, label };
    })
    .filter((row): row is { id: string; label: string } => row != null);
  const showMemory =
    facts.length > 0 || profile.wishes.length > 0 || social.length > 0 || Boolean(memoryReview);

  return (
    <article>
      <ClientProfileHeader profile={profile} />

      {justSaved ? (
        <p className="mt-6 text-[13px] tracking-[0.04em] text-[#c4b7aa]" role="status">
          Note saved.
        </p>
      ) : null}

      <div className="mt-6">
        <Link
          href={conciergeAddNotePath(profile.person.id)}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          Add Note
        </Link>
      </div>

      {showMemory ? (
        <ClientMemorySection title="Memory">
          {facts.length > 0 ? (
            <dl className="space-y-4">
              {facts.map((fact) => (
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
          ) : null}
          {profile.wishes.length > 0 ? (
            <div className={facts.length > 0 ? "mt-8" : undefined}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                On their radar
              </p>
              <ul className="mt-3 space-y-3">
                {profile.wishes.map((wish) => (
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
          {social.length > 0 ? (
            <ul className={`space-y-2 text-[15px] text-[#d8cfc4] ${facts.length || profile.wishes.length ? "mt-8" : ""}`}>
              {social.map((row) => (
                <li key={row.id}>{row.label}</li>
              ))}
            </ul>
          ) : null}
          {memoryReview ? (
            <p className="mt-5 text-[12px] tracking-[0.04em] text-[#ad9164]">
              {memoryReview}
            </p>
          ) : null}
        </ClientMemorySection>
      ) : null}

      {profile.projects.length > 0 ? (
        <ClientMemorySection title="Projects">
          <div className="space-y-3">
            {profile.projects.map((project) => (
              <ClientProjectCard
                key={project.profile.projectId}
                project={project}
              />
            ))}
          </div>
        </ClientMemorySection>
      ) : null}

      {profile.sourceNotes.length > 0 ? (
        <ClientMemorySection title="Recent notes">
          <ClientRecentNotes
            notes={profile.sourceNotes}
            projectTitles={Object.fromEntries(
              profile.projects.map((project) => [
                project.profile.projectId,
                project.profile.displayTitle,
              ]),
            )}
          />
        </ClientMemorySection>
      ) : null}
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
