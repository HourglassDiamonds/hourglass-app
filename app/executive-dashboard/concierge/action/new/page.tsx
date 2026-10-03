import { randomUUID } from "node:crypto";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { getAuthenticatedProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/load-writer";
import { isProjectIdParam } from "@/lib/continuum/client-memory/read/presentation";
import { CURRENT_PROJECTS_CREATE_ACTION_LABEL } from "@/lib/continuum/client-memory/open-projects/present";
import { ConciergeShell } from "../../components/concierge-shell";
import { ConciergeUnavailable } from "../../components/client-profile-view";
import { CreateActionForm } from "../../components/create-action-form";
import { ConciergeBackLink } from "../../components/concierge-back-link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create action",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeCreateActionPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const requested = params.project?.trim() ?? "";
  const selectedProjectId = isProjectIdParam(requested) ? requested : null;

  const [deskAuth, writerAuth] = await Promise.all([
    getAuthenticatedProjectDeskReader(),
    getAuthenticatedProjectJobWriter(),
  ]);
  if (!deskAuth.ok || !writerAuth.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Action unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  let summaries: Awaited<ReturnType<typeof deskAuth.reader.listProjects>>;
  try {
    summaries = await deskAuth.reader.listProjects();
  } catch {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Action unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  const projects = summaries
    .map((row) => ({
      projectId: row.projectId,
      title: row.title,
      people: row.people,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }));

  return (
    <ConciergeShell>
      <ConciergeBackLink />
      <div className="hg-concierge-fade mt-8">
        <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          {CURRENT_PROJECTS_CREATE_ACTION_LABEL}
        </h1>
        <div className="mt-8">
          <CreateActionForm
            projects={projects}
            selectedProjectId={selectedProjectId}
            mutationId={randomUUID()}
          />
        </div>
      </div>
    </ConciergeShell>
  );
}
