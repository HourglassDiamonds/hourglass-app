import { createSupabaseClientMemoryStore } from "@/lib/continuum/client-memory/persistence/supabase";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { loadCohort1Index } from "@/lib/continuum/gmail/cohort-reconstruction-load";
import {
  RECONSTRUCTION_COHORT_1_HEADING,
  RECONSTRUCTION_COHORT_1_WARNING,
} from "@/lib/continuum/gmail/reconstruction-cohort";
import { ConciergeShell } from "../../components/concierge-shell";
import {
  ConciergeBackLink,
  ConciergeUnavailable,
} from "../../components/client-profile-view";
import { CohortReconstructionIndex } from "../../components/cohort-reconstruction";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Project Reconstruction — Cohort 1",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function Cohort1ReconstructionPage() {
  const deskAuth = await getAuthenticatedProjectDeskReader();
  const gmailAuth = await getAuthenticatedGmailHistoryStores();
  if (!deskAuth.ok || !gmailAuth.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project reconstruction unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  let rows: Awaited<ReturnType<typeof loadCohort1Index>>;
  try {
    const memory = createSupabaseClientMemoryStore();
    rows = await loadCohort1Index({
      reader: deskAuth.reader,
      memory,
      index: gmailAuth.index,
      attachments: gmailAuth.attachments,
    });
  } catch {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project reconstruction unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  return (
    <ConciergeShell>
      <ConciergeBackLink />
      <div className="hg-concierge-fade mt-8">
        <h1 className="font-serif text-[1.95rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de] md:text-[2.15rem]">
          {RECONSTRUCTION_COHORT_1_HEADING}
        </h1>
        <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          {RECONSTRUCTION_COHORT_1_WARNING} Founder review of stored evidence
          and recovered candidates. Nothing is applied.
        </p>
        <CohortReconstructionIndex rows={rows} />
      </div>
    </ConciergeShell>
  );
}
