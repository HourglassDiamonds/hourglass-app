import { loadTodaySurface } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import { loadTodayUpcoming } from "@/lib/continuum/calendar/today-upcoming-load";
import { loadContinuumHomeModel } from "@/lib/continuum/dashboard/server";
import { completeTop5OpenJobAction, disposeTodayDocketItemAction } from "./cos-operating-loop-actions";
import { reviewProposedActionFromForm } from "./intake-review-actions";
import { askConcierge } from "./ask-actions";
import { CommandCenterHome } from "./components/command-center-home";
import { ConciergeShell } from "./components/concierge-shell";
import { CosFeedbackSettle } from "./components/cos-feedback-settle";
import { GmailOperatingFreshness } from "./components/gmail-operating-freshness";

export const fetchCache = "force-no-store";

export default async function ConciergeHomePage() {
  const model = loadContinuumHomeModel();
  const [today, upcoming] = await Promise.all([
    loadTodaySurface(),
    loadTodayUpcoming(),
  ]);
  return (
    <ConciergeShell variant="home">
      <GmailOperatingFreshness
        refreshing={today.freshness === "refreshing"}
        baselineWatermark={today.readModelWatermark}
      />
      <CosFeedbackSettle watermark={today.readModelWatermark} />
      <CommandCenterHome
        model={model}
        docket={today.docket}
        completeAction={completeTop5OpenJobAction}
        reviewAction={reviewProposedActionFromForm}
        disposeAction={disposeTodayDocketItemAction}
        askAction={askConcierge}
        upcoming={upcoming}
      />
    </ConciergeShell>
  );
}
