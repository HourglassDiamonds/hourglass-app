import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { composeCurrentProjectCards } from "@/lib/continuum/client-memory/open-projects/card";
import { selectOpenProjectWork } from "@/lib/continuum/client-memory/open-projects/select";
import type { ProjectDeskRead } from "@/lib/continuum/client-memory/project-desk/types";
import { getAuthenticatedRepairQuoteReader } from "@/lib/continuum/repair-quoting/load";
import { ConciergeShell } from "../components/concierge-shell";
import { ConciergeUnavailable } from "../components/client-profile-view";
import { RepairsHome, type RepairsHomeQuote } from "../components/repairs-home";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Repairs",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeRepairsPage() {
  const [deskAuth, quoteAuth] = await Promise.all([
    getAuthenticatedProjectDeskReader(),
    getAuthenticatedRepairQuoteReader(),
  ]);
  if (!deskAuth.ok) {
    return (
      <ConciergeShell variant="book">
        <ConciergeUnavailable
          title="Repairs unavailable."
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
      <ConciergeShell variant="book">
        <ConciergeUnavailable
          title="Repairs unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  const repairs = summaries.filter((row) => row.projectKind === "repair_service");
  const currentWork = selectOpenProjectWork(repairs);
  const currentIds = new Set(currentWork.map((row) => row.projectId));
  const other = repairs.filter((row) => !currentIds.has(row.projectId));

  const desks = new Map<string, ProjectDeskRead>();
  const loaded = await Promise.all(
    currentWork.map(async (item) => {
      try {
        const result = await deskAuth.reader.getProjectDesk(item.projectId);
        return result.ok ? result.desk : null;
      } catch {
        return null;
      }
    }),
  );
  for (const desk of loaded) {
    if (desk) desks.set(desk.projectId, desk);
  }
  const current = composeCurrentProjectCards(repairs, desks);

  const quotesConnected = Boolean(quoteAuth.ok && quoteAuth.connected);
  const issued: RepairsHomeQuote[] = [];
  if (quoteAuth.ok && quoteAuth.connected) {
    const listed = await Promise.all(
      repairs.map(async (project) => {
        try {
          const quotes = await quoteAuth.listQuotes(project.projectId);
          return quotes
            .filter((quote) => quote.state === "issued")
            .map((quote) => ({
              projectId: project.projectId,
              projectTitle: project.title,
              quote,
            }));
        } catch {
          return [];
        }
      }),
    );
    issued.push(...listed.flat());
  }

  return (
    <ConciergeShell variant="book">
      <RepairsHome
        current={current}
        issued={issued}
        other={other}
        quotesConnected={quotesConnected}
      />
    </ConciergeShell>
  );
}
