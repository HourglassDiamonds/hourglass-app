import { ConciergeBackLink } from "../components/concierge-back-link";
import { ConciergeShell } from "../components/concierge-shell";
import { isContinuumCalendarOAuthConfigured } from "@/lib/continuum/calendar/env";
import { loadCalendarFounderSurface } from "@/lib/continuum/calendar/load";
import { toCalendarFounderContextView } from "@/lib/continuum/calendar/presentation";
import { getAuthenticatedCandidateStore } from "@/lib/continuum/candidates/load";
import { CANDIDATE_STORAGE_NOT_ACTIVATED_MESSAGE } from "@/lib/continuum/candidates/activation";
import {
  ingestCalendarAssociationCandidates,
  listCalendarAssociationCandidates,
} from "@/lib/continuum/calendar/association/ingest";
import { presentCalendarAssociationReviewViews } from "@/lib/continuum/calendar/association/present";
import {
  getAuthenticatedCalendarAssociationWriter,
  loadCalendarAssociationWorld,
} from "@/lib/continuum/calendar/association/load";
import { CalendarConnectionControls } from "../components/calendar-connection";
import { CalendarContextSurface } from "../components/calendar-context";
import { IntakeCandidateReviewList } from "../components/intake-candidate-review";

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

  let reviews: ReturnType<typeof presentCalendarAssociationReviewViews> = [];
  let candidateStorageMessage: string | null = null;
  if (surface.status === "ready" && surface.context) {
    const evidence = [...surface.context.upcoming, ...surface.context.recent];
    const candidates = await getAuthenticatedCandidateStore();
    if (!candidates.ok) {
      candidateStorageMessage =
        candidates.reason === "not-activated"
          ? CANDIDATE_STORAGE_NOT_ACTIVATED_MESSAGE
          : null;
    } else {
      const writerAuth = await getAuthenticatedCalendarAssociationWriter();
      const world = await loadCalendarAssociationWorld(
        writerAuth.ok ? writerAuth.writer : null,
      );
      await ingestCalendarAssociationCandidates(candidates.store, {
        evidence,
        world,
      });
      const persisted = (await listCalendarAssociationCandidates(candidates.store)).filter(
        (row) => row.candidateState !== "superseded",
      );
      const personNames = new Map(
        world.people.map((row) => [row.personId, row.displayName]),
      );
      const projectTitles = new Map(
        world.projects.map((row) => [row.projectId, row.title]),
      );
      reviews = presentCalendarAssociationReviewViews({
        candidates: persisted,
        personNames,
        projectTitles,
      });
    }
  }

  return (
    <ConciergeShell>
      <ConciergeBackLink />
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
          <>
            <CalendarContextSurface upcoming={view.upcoming} recent={view.recent} />
            <section className="mt-12">
              <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
                Association review
              </h2>
              {candidateStorageMessage ? (
                <p className="mt-4 text-[15px] leading-relaxed text-[#d8cfc4]">
                  {candidateStorageMessage}
                </p>
              ) : (
                <IntakeCandidateReviewList sourceId="" reviews={reviews} />
              )}
            </section>
          </>
        ) : null}
      </div>
    </ConciergeShell>
  );
}
