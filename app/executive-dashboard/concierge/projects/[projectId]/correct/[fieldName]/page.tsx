import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { isEditableProjectSpecField } from "@/lib/continuum/client-memory/contracts";
import {
  currentSpecValue,
  PROJECT_SPEC_FIELD_LABELS,
} from "@/lib/continuum/client-memory/project-spec/types";
import { getAuthenticatedClientMemoryProjectSpecWriter } from "@/lib/continuum/client-memory/project-spec/load";
import {
  conciergeProjectPath,
  isProjectIdParam,
} from "@/lib/continuum/client-memory/read/presentation";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/types";
import { ConciergeShell } from "../../../../components/concierge-shell";
import { ConciergeUnavailable } from "../../../../components/client-profile-view";
import { CorrectProjectSpecForm } from "../../../../components/correct-project-spec-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Correct project detail",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeCorrectProjectSpecPage({
  params,
}: {
  params: Promise<{ projectId: string; fieldName: string }>;
}) {
  const { projectId, fieldName } = await params;
  if (!isProjectIdParam(projectId) || !isEditableProjectSpecField(fieldName)) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This project detail could not be found."
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
  let history: Awaited<ReturnType<typeof writerAuth.writer.getProjectHistory>>;
  try {
    [desk, history] = await Promise.all([
      deskAuth.reader.getProjectDesk(projectId),
      writerAuth.writer.getProjectHistory(projectId),
    ]);
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

  if (!desk.ok || !history) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This project could not be found."
        />
      </ConciergeShell>
    );
  }

  const currentValue = currentSpecValue(history, fieldName)?.trim() ?? "";
  const imported = history.sourceSystem === CLIENT_MEMORY_SOURCE_SYSTEM;

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
          Correct {PROJECT_SPEC_FIELD_LABELS[fieldName].toLowerCase()}
        </h1>
        <div className="mt-8">
          <CorrectProjectSpecForm
            projectId={projectId}
            projectTitle={desk.desk.title}
            fieldName={fieldName}
            fieldLabel={PROJECT_SPEC_FIELD_LABELS[fieldName]}
            currentValue={currentValue}
            currentSourceLabel={imported ? "Current source: imported" : null}
            mutationId={randomUUID()}
          />
        </div>
      </div>
    </ConciergeShell>
  );
}
