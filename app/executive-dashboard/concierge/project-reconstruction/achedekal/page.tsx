import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import {
  ACHEDEKAL_DISPLAY_NAME,
  ACHEDEKAL_LIFECYCLE_LABEL,
  ACHEDEKAL_PROJECT_ID,
  ACHEDEKAL_RECONSTRUCTION_HEADING,
  ACHEDEKAL_REVIEW_WARNING,
} from "@/lib/continuum/gmail/achedekal-acceptance";
import { ConciergeShell } from "../../components/concierge-shell";
import {
  ConciergeBackLink,
  ConciergeUnavailable,
} from "../../components/client-profile-view";
import { AchedekalReviewForm } from "../../components/achedekal-review-form";
import { AchedekalRelatedThreadsForm } from "../../components/achedekal-related-threads";
import { AchedekalKnownArtifactPreview } from "../../components/achedekal-known-artifact";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Achedekal evidence review",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function AchedekalEvidenceReviewPage() {
  const auth = await getAuthenticatedProjectDeskReader();
  if (!auth.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  let result: Awaited<ReturnType<typeof auth.reader.getProjectDesk>>;
  try {
    result = await auth.reader.getProjectDesk(ACHEDEKAL_PROJECT_ID);
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

  if (!result.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This project could not be found."
        />
      </ConciergeShell>
    );
  }

  const specs = result.desk.specs.map((row) => ({
    label: row.label,
    value: row.value,
  }));

  return (
    <ConciergeShell>
      <ConciergeBackLink />
      <div className="hg-concierge-fade mt-8">
        <h1 className="font-serif text-[1.95rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de] md:text-[2.15rem]">
          {ACHEDEKAL_RECONSTRUCTION_HEADING}
        </h1>
        <p className="mt-4 text-[11px] uppercase tracking-[0.28em] text-[#ad9164]">
          {ACHEDEKAL_LIFECYCLE_LABEL}
        </p>
        <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          {ACHEDEKAL_DISPLAY_NAME}. {ACHEDEKAL_REVIEW_WARNING}
        </p>
        <AchedekalReviewForm specs={specs} />
        <AchedekalRelatedThreadsForm />
        <AchedekalKnownArtifactPreview />
      </div>
    </ConciergeShell>
  );
}
