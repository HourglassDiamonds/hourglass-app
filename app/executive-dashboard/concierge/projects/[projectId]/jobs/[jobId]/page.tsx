import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { getAuthenticatedProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/load-writer";
import {
  conciergeProjectPath,
  isProjectIdParam,
} from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeShell } from "../../../../components/concierge-shell";
import { ConciergeUnavailable } from "../../../../components/client-profile-view";
import { EditOpenJobForm } from "../../../../components/edit-open-job-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Open job",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeOpenJobPage({
  params,
}: {
  params: Promise<{ projectId: string; jobId: string }>;
}) {
  const { projectId, jobId } = await params;
  if (!isProjectIdParam(projectId) || !isProjectIdParam(jobId)) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Open job unavailable."
          body="This open job could not be found."
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
          title="Open job unavailable."
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
          title="Open job unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  if (!desk.ok || !job) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Open job unavailable."
          body="This open job could not be found."
        />
      </ConciergeShell>
    );
  }

  return (
    <ConciergeShell>
      <Link
        href={conciergeProjectPath(projectId)}
        aria-label={`Back to ${desk.desk.title}`}
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← {desk.desk.title}
      </Link>
      <div className="hg-concierge-fade mt-8">
        <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          Open job
        </h1>
        <div className="mt-8">
          <EditOpenJobForm
            projectId={projectId}
            projectTitle={desk.desk.title}
            job={job}
            mutationId={randomUUID()}
            people={desk.desk.people}
          />
        </div>
      </div>
    </ConciergeShell>
  );
}
