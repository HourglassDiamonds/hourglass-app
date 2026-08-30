import { createSupabaseClientMemoryStore } from "@/lib/continuum/client-memory/persistence/supabase";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { isProjectIdParam } from "@/lib/continuum/client-memory/read/presentation";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { loadCohort1ProjectReview } from "@/lib/continuum/gmail/cohort-reconstruction-load";
import {
  RECONSTRUCTION_COHORT_1_LIFECYCLE_LABEL,
  RECONSTRUCTION_COHORT_1_WARNING,
  cohort1LabelFor,
  isPermittedCohort1ProjectId,
} from "@/lib/continuum/gmail/reconstruction-cohort";
import { ConciergeShell } from "../../../components/concierge-shell";
import {
  ConciergeBackLink,
  ConciergeUnavailable,
} from "../../../components/client-profile-view";
import { CohortProjectReviewView } from "../../../components/cohort-reconstruction";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Project Reconstruction — Cohort 1",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function Cohort1ProjectReviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!isProjectIdParam(projectId) || !isPermittedCohort1ProjectId(projectId)) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This project is not in Cohort 1."
        />
      </ConciergeShell>
    );
  }

  const deskAuth = await getAuthenticatedProjectDeskReader();
  const gmailAuth = await getAuthenticatedGmailHistoryStores();
  if (!deskAuth.ok || !gmailAuth.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  let review: Awaited<ReturnType<typeof loadCohort1ProjectReview>>;
  try {
    const memory = createSupabaseClientMemoryStore();
    const internalEmailHashes = gmailAuth.connections
      ? [
          ((await gmailAuth.connections.getFounderConnection())
            ?.mailboxEmailHash ?? ""),
        ].filter(Boolean)
      : [];
    review = await loadCohort1ProjectReview({
      founderSessionOk: true,
      projectId,
      reader: deskAuth.reader,
      memory,
      index: gmailAuth.index,
      attachments: gmailAuth.attachments,
      internalEmailHashes,
    });
  } catch {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  if (!review) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This project could not be found."
        />
      </ConciergeShell>
    );
  }

  return (
    <ConciergeShell>
      <ConciergeBackLink />
      <div className="hg-concierge-fade mt-8">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#ad9164]">
          {cohort1LabelFor(projectId)}
        </p>
        <h1 className="mt-4 font-serif text-[1.95rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de] md:text-[2.15rem]">
          {review.title}
        </h1>
        <p className="mt-4 text-[11px] uppercase tracking-[0.28em] text-[#ad9164]">
          {RECONSTRUCTION_COHORT_1_LIFECYCLE_LABEL}
        </p>
        <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          {RECONSTRUCTION_COHORT_1_WARNING}
        </p>
        <CohortProjectReviewView review={review} />
      </div>
    </ConciergeShell>
  );
}
