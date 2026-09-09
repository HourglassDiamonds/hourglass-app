import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { loadCurrentProjectCards } from "@/lib/continuum/client-memory/open-projects/load";
import { selectOpenProjectWork } from "@/lib/continuum/client-memory/open-projects/select";
import { ConciergeShell } from "../components/concierge-shell";
import { ConciergeUnavailable } from "../components/client-profile-view";
import { ProjectsOperatingHome } from "../components/projects-operating-home";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Projects",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const view = query.view === "past" ? "past" : "active";

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

  let past: Awaited<ReturnType<typeof auth.reader.listProjects>> = [];
  try {
    const summaries = await auth.reader.listProjects();
    const activeIds = new Set(
      selectOpenProjectWork(summaries).map((row) => row.projectId),
    );
    past = summaries.filter((row) => !activeIds.has(row.projectId));
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

  const active = view === "active" ? await loadCurrentProjectCards() : [];

  return (
    <ConciergeShell variant="book">
      <ProjectsOperatingHome active={active} past={past} view={view} />
    </ConciergeShell>
  );
}
