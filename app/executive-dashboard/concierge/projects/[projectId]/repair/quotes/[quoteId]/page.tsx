import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { getAuthenticatedRepairQuoteReader } from "@/lib/continuum/repair-quoting/load";
import {
  conciergeRepairQuotesPath,
  isProjectIdParam,
} from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeShell } from "../../../../../components/concierge-shell";
import { ConciergeUnavailable } from "../../../../../components/client-profile-view";
import { RepairQuoteDetail } from "../../../../../components/repair-quote-view";
import { RepairQuoteReviewActions } from "../../../../../components/repair-quote-review-actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Repair quote",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeRepairQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; quoteId: string }>;
  searchParams?: Promise<{ saved?: string }>;
}) {
  const { projectId, quoteId } = await params;
  const query = searchParams ? await searchParams : {};
  if (!isProjectIdParam(projectId) || !isProjectIdParam(quoteId)) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Quote unavailable."
          body="This quote could not be found."
        />
      </ConciergeShell>
    );
  }

  const [deskAuth, quoteAuth] = await Promise.all([
    getAuthenticatedProjectDeskReader(),
    getAuthenticatedRepairQuoteReader(),
  ]);
  if (!deskAuth.ok || !quoteAuth.ok || !quoteAuth.connected) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Quote unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  let desk: Awaited<ReturnType<typeof deskAuth.reader.getProjectDesk>>;
  try {
    desk = await deskAuth.reader.getProjectDesk(projectId);
  } catch {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Quote unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }
  if (!desk.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Quote unavailable."
          body="This project could not be found."
        />
      </ConciergeShell>
    );
  }

  const quote = await quoteAuth.getQuote(projectId, quoteId);
  if (!quote) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Quote unavailable."
          body="This quote could not be found."
        />
      </ConciergeShell>
    );
  }

  const personName =
    quote.associatedPersonId == null
      ? null
      : desk.desk.people.find((row) => row.personId === quote.associatedPersonId)
          ?.displayName ?? null;

  return (
    <ConciergeShell>
      <Link
        href={conciergeRepairQuotesPath(projectId)}
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← Repair quotes
      </Link>
      <div className="hg-concierge-fade mt-8">
        {query.saved ? (
          <p className="mb-4 text-[15px] leading-relaxed text-[#c4b7aa]" role="status">
            {query.saved === "issued"
              ? "Quote issued."
              : query.saved === "override"
                ? "Override saved."
                : "Quote saved."}
          </p>
        ) : null}
        <RepairQuoteDetail
          quote={quote}
          projectTitle={desk.desk.title}
          personName={personName}
        />
        <RepairQuoteReviewActions
          quote={quote}
          issueMutationId={randomUUID()}
          overrideMutationId={randomUUID()}
          voidMutationId={randomUUID()}
        />
      </div>
    </ConciergeShell>
  );
}
