import Link from "next/link";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import { isContinuumCalendarOAuthConfigured } from "@/lib/continuum/calendar/env";
import { loadCalendarFounderSurface } from "@/lib/continuum/calendar/load";
import { toCalendarFounderContextView } from "@/lib/continuum/calendar/presentation";
import { ConciergeShell } from "../components/concierge-shell";
import { CalendarConnectionControls } from "../components/calendar-connection";
import { CalendarContextSurface } from "../components/calendar-context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Calendar",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeCalendarPage() {
  const surface = await loadCalendarFounderSurface();
  const view =
    surface.status === "ready" && surface.context
      ? toCalendarFounderContextView(surface.context)
      : { upcoming: [], recent: [] };

  return (
    <ConciergeShell>
      <Link
        href={CONCIERGE_HOME_PATH}
        aria-label="Back to Continuum"
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.14em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← Continuum
      </Link>
      <div className="hg-concierge-fade mt-6">
        <h1 className="font-serif text-[1.95rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de] md:text-[2.15rem]">
          Calendar
        </h1>
        <p className="mt-4 max-w-[28rem] text-[15px] leading-relaxed text-[#c4b7aa]">
          What’s coming up, and what happened recently. Calendar is source
          evidence only.
        </p>
        <CalendarConnectionControls
          connected={surface.connected}
          status={surface.status}
          oauthConfigured={isContinuumCalendarOAuthConfigured()}
        />
        {surface.status === "ready" ? (
          <CalendarContextSurface upcoming={view.upcoming} recent={view.recent} />
        ) : null}
      </div>
    </ConciergeShell>
  );
}
