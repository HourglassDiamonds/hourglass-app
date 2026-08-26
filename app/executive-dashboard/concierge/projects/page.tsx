import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { ConciergeShell } from "../components/concierge-shell";
import {
  ConciergeBackLink,
  ConciergeUnavailable,
} from "../components/client-profile-view";
import { ProjectBookView } from "../components/project-book-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Projects",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeProjectsPage() {
  const auth = await getAuthenticatedProjectDeskReader();
  if (!auth.ok) {
    return (
      <ConciergeShell variant="book">
        <ConciergeUnavailable
          title="Projects unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  let projects: Awaited<ReturnType<typeof auth.reader.listProjects>>;
  try {
    projects = await auth.reader.listProjects();
  } catch {
    return (
      <ConciergeShell variant="book">
        <ConciergeUnavailable
          title="Projects unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  return (
    <ConciergeShell variant="book">
      <ConciergeBackLink />
      <div className="hg-concierge-fade mt-8">
        <ProjectBookView projects={projects} />
      </div>
    </ConciergeShell>
  );
}
