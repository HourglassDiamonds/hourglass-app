import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { selectOpenProjectWork } from "@/lib/continuum/client-memory/open-projects/select";
import { getAuthenticatedRepairQuoteReader } from "@/lib/continuum/repair-quoting/load";
import { AskConciergeShell } from "../components/ask-concierge-shell";
import { ConciergeShell } from "../components/concierge-shell";
import { ConciergeUnavailable } from "../components/client-profile-view";
import { RepairsHome } from "../components/repairs-home";

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
  const quotesConnected = Boolean(quoteAuth.ok && quoteAuth.connected);

  return (
    <ConciergeShell variant="book">
      <RepairsHome
        current={selectOpenProjectWork(repairs)}
        quotesConnected={quotesConnected}
      >
        <div className="mt-8">
          <AskConciergeShell placeholder="Describe the repair, client, and relevant details…" />
        </div>
      </RepairsHome>
    </ConciergeShell>
  );
}
