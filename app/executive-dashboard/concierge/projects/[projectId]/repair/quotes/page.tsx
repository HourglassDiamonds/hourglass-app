import Link from "next/link";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { getAuthenticatedRepairQuoteReader } from "@/lib/continuum/repair-quoting/load";
import {
  conciergeProjectPath,
  conciergeProjectRepairPath,
  isProjectIdParam,
} from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeShell } from "../../../../components/concierge-shell";
import { ConciergeUnavailable } from "../../../../components/client-profile-view";
import { RepairQuotesSection } from "../../../../components/repair-quote-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Repair quotes",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeRepairQuotesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!isProjectIdParam(projectId)) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This project could not be found."
        />
      </ConciergeShell>
    );
  }

  const [deskAuth, quoteAuth] = await Promise.all([
    getAuthenticatedProjectDeskReader(),
    getAuthenticatedRepairQuoteReader(),
  ]);
  if (!deskAuth.ok || !quoteAuth.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
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
          title="Project unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }
  if (!desk.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This project could not be found."
        />
      </ConciergeShell>
    );
  }

  const quotes =
    quoteAuth.connected ? await quoteAuth.listQuotes(projectId) : [];

  return (
    <ConciergeShell>
      <Link
        href={conciergeProjectRepairPath(projectId)}
        aria-label={`Back to Repair / Service for ${desk.desk.title}`}
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← Repair / Service
      </Link>
      <div className="hg-concierge-fade mt-8">
        <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          Repair quotes
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#c4b7aa]">
          {desk.desk.title}
        </p>
        <RepairQuotesSection
          projectId={projectId}
          quotes={quotes}
          connected={quoteAuth.connected}
        />
        <p className="mt-8">
          <Link
            href={conciergeProjectPath(projectId)}
            className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
          >
            Project desk
          </Link>
        </p>
      </div>
    </ConciergeShell>
  );
}
