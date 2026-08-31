import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { getAuthenticatedClientMemoryProjectSpecWriter } from "@/lib/continuum/client-memory/project-spec/load";
import {
  conciergeProjectPath,
  isProjectIdParam,
} from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeShell } from "../../../components/concierge-shell";
import { ConciergeUnavailable } from "../../../components/client-profile-view";
import { CorrectProjectKindForm } from "../../../components/correct-project-kind-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Set project kind",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeCorrectProjectKindPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!isProjectIdParam(projectId)) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This project could not be found."
        />
      </ConciergeShell>
    );
  }

  const [deskAuth, writerAuth] = await Promise.all([
    getAuthenticatedProjectDeskReader(),
    getAuthenticatedClientMemoryProjectSpecWriter(),
  ]);
  if (!deskAuth.ok || !writerAuth.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  let desk: Awaited<ReturnType<typeof deskAuth.reader.getProjectDesk>>;
  try {
    desk = await deskAuth.reader.getProjectDesk(projectId);
  } catch {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  if (!desk.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This project could not be found."
        />
      </ConciergeShell>
    );
  }

  return (
    <ConciergeShell>
      <Link
        href={conciergeProjectPath(projectId)}
        aria-label={`Back to ${desk.desk.title}`}
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← {desk.desk.title}
      </Link>
      <div className="hg-concierge-fade mt-8">
        <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          {desk.desk.projectKind ? "Correct project kind" : "Set project kind"}
        </h1>
        <div className="mt-8">
          <CorrectProjectKindForm
            projectId={projectId}
            projectTitle={desk.desk.title}
            currentKind={desk.desk.projectKind}
            mutationId={randomUUID()}
          />
        </div>
      </div>
    </ConciergeShell>
  );
}
