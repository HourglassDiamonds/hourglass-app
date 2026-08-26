import { loadProjectBookPreview } from "@/lib/continuum/client-memory/project-desk/load";
import { loadContinuumHomeModel } from "@/lib/continuum/dashboard/server";
import { CommandCenterHome } from "./components/command-center-home";
import { ConciergeShell } from "./components/concierge-shell";

export default async function ConciergeHomePage() {
  const model = loadContinuumHomeModel();
  const projects = await loadProjectBookPreview();
  return (
    <ConciergeShell variant="home">
      <CommandCenterHome model={model} projects={projects} />
    </ConciergeShell>
  );
}
