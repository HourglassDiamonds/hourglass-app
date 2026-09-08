import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { getAuthenticatedProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/load-writer";
import {
  CONCIERGE_HOME_PATH,
  isProjectIdParam,
} from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeShell } from "../../../components/concierge-shell";
import { ConciergeUnavailable } from "../../../components/client-profile-view";
import { EditActionForm } from "../../../components/edit-action-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit action",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeEditActionPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ project?: string }>;
}) {
  const { jobId } = await params;
  const query = await searchParams;
  const projectId = query.project?.trim() ?? "";
  if (!isProjectIdParam(jobId) || !isProjectIdParam(projectId)) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Action unavailable."
          body="This action could not be found."
        />
      </ConciergeShell>
    );
  }

  const [deskAuth, writerAuth] = await Promise.all([
    getAuthenticatedProjectDeskReader(),
    getAuthenticatedProjectJobWriter(),
  ]);
  if (!deskAuth.ok || !writerAuth.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Action unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  let desk: Awaited<ReturnType<typeof deskAuth.reader.getProjectDesk>>;
  let job: Awaited<ReturnType<typeof writerAuth.writer.getJob>>;
  try {
    [desk, job] = await Promise.all([
      deskAuth.reader.getProjectDesk(projectId),
      writerAuth.writer.getJob(projectId, jobId),
    ]);
  } catch {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Action unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  if (!desk.ok || !job || job.state === "resolved" || job.state === "cancelled") {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Action unavailable."
          body="This action could not be found."
        />
      </ConciergeShell>
    );
  }

  return (
    <ConciergeShell>
      <Link
        href={CONCIERGE_HOME_PATH}
        aria-label="Back to Command Center"
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← Command Center
      </Link>
      <div className="hg-concierge-fade mt-8">
        <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          Edit action
        </h1>
        <div className="mt-8">
          <EditActionForm
            job={job}
            projectTitle={desk.desk.title}
            people={desk.desk.people}
            mutationId={randomUUID()}
          />
        </div>
      </div>
    </ConciergeShell>
  );
}
