import { loadCurrentProjectCards } from "@/lib/continuum/client-memory/open-projects/load";
import { loadCosOperatingLoop } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import { loadContinuumHomeModel } from "@/lib/continuum/dashboard/server";
import { completeTop5OpenJobAction } from "./cos-operating-loop-actions";
import { CommandCenterHome } from "./components/command-center-home";
import { ConciergeShell } from "./components/concierge-shell";

export default async function ConciergeHomePage() {
  const model = loadContinuumHomeModel();
  const openProjects = await loadCurrentProjectCards();
  const operatingLoop = await loadCosOperatingLoop();
  return (
    <ConciergeShell variant="home">
      <CommandCenterHome
        model={model}
        openProjects={openProjects}
        operatingLoop={operatingLoop}
        completeAction={completeTop5OpenJobAction}
      />
    </ConciergeShell>
  );
}
