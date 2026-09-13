import { loadContinuumHomeModel } from "@/lib/continuum/dashboard/server";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { loadCurrentProjectCards } from "@/lib/continuum/client-memory/open-projects/load";
import { groupCurrentProjects } from "@/lib/continuum/client-memory/open-projects/operating-groups";
import { selectOpenProjectWork } from "@/lib/continuum/client-memory/open-projects/select";
import { composeHomeGlance } from "@/lib/continuum/operating-shell/home-hub";
import { ConciergeShell } from "../components/concierge-shell";
import { MobileHomeHub } from "../components/mobile-home-hub";

export const fetchCache = "force-no-store";

export const metadata = {
  title: "Home",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

async function loadHomeGlance() {
  const [cards, auth] = await Promise.all([
    loadCurrentProjectCards(),
    getAuthenticatedProjectDeskReader(),
  ]);
  const groups = groupCurrentProjects(cards, {
    nowIso: new Date().toISOString(),
    viewport: "mobile",
  });
  let openRepairCount = 0;
  if (auth.ok) {
    try {
      const summaries = await auth.reader.listProjects();
      openRepairCount = selectOpenProjectWork(
        summaries.filter((row) => row.projectKind === "repair_service"),
      ).length;
    } catch {
      openRepairCount = 0;
    }
  }
  return composeHomeGlance({ groups, openRepairCount });
}

export default async function ConciergeMobileHomePage() {
  const model = loadContinuumHomeModel();
  const glance = await loadHomeGlance();
  return (
    <ConciergeShell variant="home">
      <MobileHomeHub model={model} glance={glance} />
    </ConciergeShell>
  );
}
