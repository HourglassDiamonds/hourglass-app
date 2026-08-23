import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getAuthenticatedClientMemoryReader } from "@/lib/continuum/client-memory/read/load";
import {
  conciergeClientPath,
  isPersonIdParam,
} from "@/lib/continuum/client-memory/read/presentation";
import { suggestRelationshipContextLayer } from "@/lib/continuum/client-memory/write/context";
import { ConciergeShell } from "../../../../components/concierge-shell";
import { ConciergeUnavailable } from "../../../../components/client-profile-view";
import { AddNoteForm } from "../../../../components/add-note-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Add Note",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeAddNotePage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
  if (!isPersonIdParam(personId)) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Client record unavailable."
          body="This client could not be found."
        />
      </ConciergeShell>
    );
  }

  const auth = await getAuthenticatedClientMemoryReader();
  if (!auth.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Client record unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  let result: Awaited<ReturnType<typeof auth.reader.getPersonProfile>>;
  try {
    result = await auth.reader.getPersonProfile(personId);
  } catch {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Client record unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  if (!result.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Client record unavailable."
          body="This client could not be found."
        />
      </ConciergeShell>
    );
  }

  const profile = result.profile;
  const defaultContext = suggestRelationshipContextLayer(profile.person.roles);

  return (
    <ConciergeShell>
      <Link
        href={conciergeClientPath(personId)}
        aria-label={`Back to ${profile.person.displayName}`}
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← {profile.person.displayName}
      </Link>
      <div className="hg-concierge-fade mt-8">
        <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          Add Note
        </h1>
        <div className="mt-8">
          <AddNoteForm
            personId={personId}
            personName={profile.person.displayName}
            submissionId={randomUUID()}
            defaultContext={defaultContext}
            projects={profile.projects.map((project) => ({
              id: project.profile.projectId,
              title: project.profile.displayTitle,
            }))}
          />
        </div>
      </div>
    </ConciergeShell>
  );
}
