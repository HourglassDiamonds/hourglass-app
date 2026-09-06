import { loadCurrentProjectCards } from "@/lib/continuum/client-memory/open-projects/load";
import { loadContinuumHomeModel } from "@/lib/continuum/dashboard/server";
import { CommandCenterHome } from "./components/command-center-home";
import { ConciergeShell } from "./components/concierge-shell";

export default async function ConciergeHomePage() {
  const model = loadContinuumHomeModel();
  const openProjects = await loadCurrentProjectCards();
  return (
    <ConciergeShell variant="home">
      <CommandCenterHome model={model} openProjects={openProjects} />
    </ConciergeShell>
  );
}
