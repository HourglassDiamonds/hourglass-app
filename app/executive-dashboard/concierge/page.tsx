import { Suspense } from "react";
import { loadTodaySurface } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import { loadTodayUpcoming } from "@/lib/continuum/calendar/today-upcoming-load";
import { loadContinuumHomeModel } from "@/lib/continuum/dashboard/server";
import { completeTop5OpenJobAction, disposeTodayDocketItemAction } from "./cos-operating-loop-actions";
import { reviewProposedActionFromForm } from "./intake-review-actions";
import { askConcierge } from "./ask-actions";
import { CommandCenterHome } from "./components/command-center-home";
import { ConciergeShell } from "./components/concierge-shell";
import { GmailOperatingFreshness } from "./components/gmail-operating-freshness";
import {
  ConditionalHoldPanel,
  ConditionalHoldPanelFallback,
} from "./components/conditional-hold-panel";
import { loadActiveClientWebsiteIntakes } from "@/lib/continuum/client-memory/read/website-intake-load";
import { composeBusinessTodayContext } from "@/lib/continuum/chief-of-staff/operating-loop/business-today-context";

export const fetchCache = "force-no-store";
// Today can perform a one-time synchronous read-model rebuild after a version
// upgrade. Give that authenticated request the same bounded runway as the
// Gmail freshness worker instead of letting the platform terminate it at the
// short page default and preserve an obsolete snapshot indefinitely.
export const maxDuration = 120;

export default async function ConciergeHomePage() {
  const model = loadContinuumHomeModel();
  const [today, upcoming, intakes] = await Promise.all([
    loadTodaySurface(),
    loadTodayUpcoming(),
    loadActiveClientWebsiteIntakes(),
  ]);
  const businessTodayContext = composeBusinessTodayContext({
    docket: today.docket,
    intakes,
    nowIso: new Date().toISOString(),
  });
  return (
    <ConciergeShell variant="home">
      <GmailOperatingFreshness
        refreshing={today.freshness === "refreshing"}
        baselineWatermark={today.readModelWatermark}
      />
      <Suspense fallback={<ConditionalHoldPanelFallback />}>
        <ConditionalHoldPanel />
      </Suspense>
      <CommandCenterHome
        model={model}
        docket={today.docket}
        completeAction={completeTop5OpenJobAction}
        reviewAction={reviewProposedActionFromForm}
        disposeAction={disposeTodayDocketItemAction}
        askAction={askConcierge}
        upcoming={upcoming}
        intakes={intakes}
        businessTodayContext={businessTodayContext}
      />
    </ConciergeShell>
  );
}
