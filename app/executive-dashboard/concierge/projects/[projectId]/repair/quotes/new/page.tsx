import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { getAuthenticatedRepairQuoteWriter } from "@/lib/continuum/repair-quoting/load-writer";
import {
  conciergeProjectRepairPath,
  conciergeRepairQuotesPath,
  isProjectIdParam,
} from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeShell } from "../../../../../components/concierge-shell";
import { ConciergeUnavailable } from "../../../../../components/client-profile-view";
import { RepairQuoteForm } from "../../../../../components/repair-quote-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New repair quote",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeNewRepairQuotePage({
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

  const [deskAuth, writerAuth] = await Promise.all([
    getAuthenticatedProjectDeskReader(),
    getAuthenticatedRepairQuoteWriter(),
  ]);
  if (!deskAuth.ok || !writerAuth.ok) {
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

  if (desk.desk.projectKind !== "repair_service") {
    return (
      <ConciergeShell>
        <Link
          href={conciergeProjectRepairPath(projectId)}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
        >
          ← {desk.desk.title}
        </Link>
        <div className="hg-concierge-fade mt-8">
          <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
            New repair quote
          </h1>
          <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
            Repair quotes are only for Repair / Service projects.
          </p>
        </div>
      </ConciergeShell>
    );
  }

  return (
    <ConciergeShell>
      <Link
        href={conciergeRepairQuotesPath(projectId)}
        aria-label={`Back to repair quotes for ${desk.desk.title}`}
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← Repair quotes
      </Link>
      <div className="hg-concierge-fade mt-8">
        <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          New repair quote
        </h1>
        <div className="mt-8">
          <RepairQuoteForm
            projectId={projectId}
            projectTitle={desk.desk.title}
            mutationId={randomUUID()}
            people={desk.desk.people}
          />
        </div>
      </div>
    </ConciergeShell>
  );
}
