import { loadContinuumHomeModel } from "@/lib/continuum/dashboard/server";
import { CommandCenterHome } from "./components/command-center-home";
import { ConciergeShell } from "./components/concierge-shell";

export default function ConciergeHomePage() {
  const model = loadContinuumHomeModel();
  return (
    <ConciergeShell variant="home">
      <CommandCenterHome model={model} />
    </ConciergeShell>
  );
}
