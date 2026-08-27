import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getAuthenticatedClientMemoryReader } from "@/lib/continuum/client-memory/read/load";
import { getAuthenticatedClientMemoryNoteWriter } from "@/lib/continuum/client-memory/write/load";
import {
  conciergeClientPath,
  isPersonIdParam,
} from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeShell } from "../../../../../components/concierge-shell";
import { ConciergeUnavailable } from "../../../../../components/client-profile-view";
import { MoveNoteForm } from "../../../../../components/move-note-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Move Note",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function ConciergeMoveNotePage({
  params,
}: {
  params: Promise<{ personId: string; noteId: string }>;
}) {
  const { personId, noteId } = await params;
  if (!isPersonIdParam(personId) || !UUID_RE.test(noteId)) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Note unavailable."
          body="This note could not be found."
        />
      </ConciergeShell>
    );
  }

  const [readerAuth, writerAuth] = await Promise.all([
    getAuthenticatedClientMemoryReader(),
    getAuthenticatedClientMemoryNoteWriter(),
  ]);
  if (!readerAuth.ok || !writerAuth.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Note unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  let profile: Awaited<ReturnType<typeof readerAuth.reader.getPersonProfile>>;
  let note: Awaited<ReturnType<typeof writerAuth.writer.getSourceNote>>;
  try {
    [profile, note] = await Promise.all([
      readerAuth.reader.getPersonProfile(personId),
      writerAuth.writer.getSourceNote(noteId),
    ]);
  } catch {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Note unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  if (!profile.ok || !note || note.personId !== personId || note.lifecycleStatus === "trashed") {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Note unavailable."
          body="This note could not be found."
        />
      </ConciergeShell>
    );
  }

  const currentProjectTitle = note.projectId
    ? (profile.profile.projects.find(
        (project) => project.profile.projectId === note.projectId,
      )?.profile.displayTitle ?? null)
    : null;

  return (
    <ConciergeShell>
      <Link
        href={conciergeClientPath(personId)}
        aria-label={`Back to ${profile.profile.person.displayName}`}
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← {profile.profile.person.displayName}
      </Link>
      <div className="hg-concierge-fade mt-8">
        <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          Move Note
        </h1>
        <div className="mt-8">
          <MoveNoteForm
            currentPersonId={personId}
            currentPersonName={profile.profile.person.displayName}
            currentProjectTitle={currentProjectTitle}
            currentProjectId={note.projectId}
            currentContext={note.contextLayer}
            noteId={note.id}
            mutationId={randomUUID()}
            projects={profile.profile.projects.map((project) => ({
              id: project.profile.projectId,
              title: project.profile.displayTitle,
            }))}
          />
        </div>
      </div>
    </ConciergeShell>
  );
}
