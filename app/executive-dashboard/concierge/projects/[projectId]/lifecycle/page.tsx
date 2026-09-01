import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { getAuthenticatedClientMemoryProjectSpecWriter } from "@/lib/continuum/client-memory/project-spec/load";
import {
  conciergeProjectPath,
  isProjectIdParam,
} from "@/lib/continuum/client-memory/read/presentation";
import { isLifecycleKind } from "@/lib/continuum/client-memory/project-lifecycle";
import { ConciergeShell } from "../../../components/concierge-shell";
import { ConciergeUnavailable } from "../../../components/client-profile-view";
import { CorrectProjectLifecycleForm } from "../../../components/correct-project-lifecycle-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Set project lifecycle",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeCorrectProjectLifecyclePage({
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
    getAuthenticatedClientMemoryProjectSpecWriter(),
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

  if (!isLifecycleKind(desk.desk.projectKind) || desk.desk.lifecycle.kind === "none") {
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
            Lifecycle
          </h1>
          <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
            Lifecycle is available for Custom / New Jewelry and Repair / Service
            Projects only.
          </p>
        </div>
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
          {desk.desk.lifecycle.stage ? "Correct lifecycle" : "Set lifecycle"}
        </h1>
        <div className="mt-8">
          <CorrectProjectLifecycleForm
            projectId={projectId}
            projectTitle={desk.desk.title}
            projectKind={desk.desk.lifecycle.kind}
            currentStage={desk.desk.lifecycle.stage}
            mutationId={randomUUID()}
          />
        </div>
      </div>
    </ConciergeShell>
  );
}
