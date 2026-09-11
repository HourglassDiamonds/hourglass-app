import { loadCosOperatingLoop } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import { loadContinuumHomeModel } from "@/lib/continuum/dashboard/server";
import { completeTop5OpenJobAction, disposeTodayDocketItemAction } from "./cos-operating-loop-actions";
import { reviewProposedActionFromForm } from "./intake-review-actions";
import { CommandCenterHome } from "./components/command-center-home";
import { ConciergeShell } from "./components/concierge-shell";
import { GmailOperatingFreshness } from "./components/gmail-operating-freshness";

export const fetchCache = "force-no-store";

export default async function ConciergeHomePage() {
  const model = loadContinuumHomeModel();
  const operatingLoop = await loadCosOperatingLoop();
  return (
    <ConciergeShell variant="home">
      <GmailOperatingFreshness />
      <CommandCenterHome
        model={model}
        operatingLoop={operatingLoop}
        completeAction={completeTop5OpenJobAction}
        reviewAction={reviewProposedActionFromForm}
        disposeAction={disposeTodayDocketItemAction}
      />
    </ConciergeShell>
  );
}
