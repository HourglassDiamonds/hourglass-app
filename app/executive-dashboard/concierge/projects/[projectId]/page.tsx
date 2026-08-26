import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { isProjectIdParam } from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeShell } from "../../components/concierge-shell";
import {
  ConciergeBackLink,
  ConciergeUnavailable,
} from "../../components/client-profile-view";
import { ProjectDeskView } from "../../components/project-desk-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Project",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeProjectDeskPage({
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

  const auth = await getAuthenticatedProjectDeskReader();
  if (!auth.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  let result: Awaited<ReturnType<typeof auth.reader.getProjectDesk>>;
  try {
    result = await auth.reader.getProjectDesk(projectId);
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

  if (!result.ok) {
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
      <ConciergeBackLink />
      <div className="hg-concierge-fade mt-8">
        <ProjectDeskView desk={result.desk} />
      </div>
    </ConciergeShell>
  );
}
