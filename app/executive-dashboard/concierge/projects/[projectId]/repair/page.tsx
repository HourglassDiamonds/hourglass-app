import Link from "next/link";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import {
  conciergeProjectPath,
  isProjectIdParam,
} from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeShell } from "../../../components/concierge-shell";
import { ConciergeUnavailable } from "../../../components/client-profile-view";
import {
  OperatingLayerOverview,
  OperatingLayerWrongKindNotice,
} from "../../../components/operating-layer-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Repair / Service",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeProjectRepairPage({
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

  const deskAuth = await getAuthenticatedProjectDeskReader();
  if (!deskAuth.ok) {
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

  return (
    <ConciergeShell>
      <Link
        href={conciergeProjectPath(projectId)}
        aria-label={`Back to ${desk.desk.title}`}
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← {desk.desk.title}
      </Link>
      {desk.desk.operatingLayer.kind === "repair_service" ? (
        <OperatingLayerOverview
          projectId={projectId}
          projectTitle={desk.desk.title}
          layer={desk.desk.operatingLayer}
        />
      ) : (
        <OperatingLayerWrongKindNotice
          projectId={projectId}
          projectTitle={desk.desk.title}
          expected="repair_service"
          currentKind={desk.desk.projectKind}
        />
      )}
    </ConciergeShell>
  );
}
