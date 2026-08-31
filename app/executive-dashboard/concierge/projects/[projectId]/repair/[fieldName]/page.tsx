import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { getAuthenticatedClientMemoryProjectSpecWriter } from "@/lib/continuum/client-memory/project-spec/load";
import {
  conciergeProjectPath,
  isProjectIdParam,
} from "@/lib/continuum/client-memory/read/presentation";
import {
  isRepairOperatingDetailField,
  OPERATING_DETAIL_FIELD_LABELS,
} from "@/lib/continuum/client-memory/project-operating/fields";
import { ConciergeShell } from "../../../../components/concierge-shell";
import { ConciergeUnavailable } from "../../../../components/client-profile-view";
import { OperatingLayerWrongKindNotice } from "../../../../components/operating-layer-page";
import { CorrectProjectOperatingDetailForm } from "../../../../components/correct-project-operating-detail-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Correct operating detail",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeCorrectRepairDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; fieldName: string }>;
}) {
  const { projectId, fieldName } = await params;
  if (!isProjectIdParam(projectId) || !isRepairOperatingDetailField(fieldName)) {
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

  if (desk.desk.operatingLayer.kind !== "repair_service") {
    return (
      <ConciergeShell>
        <Link
          href={conciergeProjectPath(projectId)}
          aria-label={`Back to ${desk.desk.title}`}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
        >
          ← {desk.desk.title}
        </Link>
        <OperatingLayerWrongKindNotice
          projectId={projectId}
          projectTitle={desk.desk.title}
          expected="repair_service"
          currentKind={desk.desk.projectKind}
        />
      </ConciergeShell>
    );
  }

  const current =
    desk.desk.operatingLayer.fields.find((row) => row.fieldName === fieldName)
      ?.value ?? "";

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
          Correct {OPERATING_DETAIL_FIELD_LABELS[fieldName].toLowerCase()}
        </h1>
        <div className="mt-8">
          <CorrectProjectOperatingDetailForm
            projectId={projectId}
            projectTitle={desk.desk.title}
            fieldName={fieldName}
            fieldLabel={OPERATING_DETAIL_FIELD_LABELS[fieldName]}
            currentValue={current}
            mutationId={randomUUID()}
          />
        </div>
      </div>
    </ConciergeShell>
  );
}
