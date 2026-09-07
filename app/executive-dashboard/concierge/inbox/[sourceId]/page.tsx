import Link from "next/link";
import { getAuthenticatedHumanSourceStore } from "@/lib/continuum/client-memory/human-intake/load";
import { composeSourceDetail } from "@/lib/continuum/client-memory/human-intake";
import { getAuthenticatedClientMemoryProjectSpecWriter } from "@/lib/continuum/client-memory/project-spec/load";
import {
  conciergeInboxNewPath,
  conciergeInboxPath,
  conciergeInboxRemarkablePath,
  isPersonIdParam,
} from "@/lib/continuum/client-memory/read/presentation";
import { getAuthenticatedCandidateStore } from "@/lib/continuum/candidates/load";
import { CANDIDATE_STORAGE_NOT_ACTIVATED_MESSAGE } from "@/lib/continuum/candidates/activation";
import { ingestHumanEvidenceCandidates } from "@/lib/continuum/candidates/human-evidence";
import { listHumanSourceCandidatesForSource } from "@/lib/continuum/human-intake/candidates/ingest";
import {
  presentHumanIntakeReviewViews,
  worldFromSourceLinks,
} from "@/lib/continuum/human-intake/review/views";
import type { HumanIntakePerson, HumanIntakeProject } from "@/lib/continuum/human-intake/candidates/types";
import { ConciergeShell } from "../../components/concierge-shell";
import { ConciergeUnavailable } from "../../components/client-profile-view";
import { HumanSourceDetail } from "../../components/human-source-detail";
import { IntakeCandidateReviewList } from "../../components/intake-candidate-review";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Source",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeInboxSourcePage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  const { sourceId } = await params;
  if (!isPersonIdParam(sourceId)) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Source unavailable."
          body="This source could not be found."
        />
      </ConciergeShell>
    );
  }

  const auth = await getAuthenticatedHumanSourceStore();
  if (!auth.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Source unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  let detail: Awaited<ReturnType<typeof composeSourceDetail>>;
  try {
    detail = await composeSourceDetail(auth.store, sourceId);
  } catch {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Source unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  if (!detail) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Source unavailable."
          body="This source could not be found."
        />
      </ConciergeShell>
    );
  }

  const candidates = await getAuthenticatedCandidateStore();
  if (!candidates.ok) {
    const body =
      candidates.reason === "not-activated"
        ? CANDIDATE_STORAGE_NOT_ACTIVATED_MESSAGE
        : "This surface could not be opened right now.";
    return (
      <ConciergeShell>
        {candidates.reason === "not-activated" ? (
          <>
            <Link
              href={conciergeInboxPath()}
              className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
            >
              ← Inbox
            </Link>
            <div className="hg-concierge-fade mt-8">
              <HumanSourceDetail detail={detail}>
                <p className="mt-4 text-[15px] leading-relaxed text-[#d8cfc4]">
                  {CANDIDATE_STORAGE_NOT_ACTIVATED_MESSAGE}
                </p>
              </HumanSourceDetail>
            </div>
          </>
        ) : (
          <ConciergeUnavailable title="Source unavailable." body={body} />
        )}
      </ConciergeShell>
    );
  }

  const specs = await getAuthenticatedClientMemoryProjectSpecWriter();
  const links = await auth.store.listLinks(sourceId);
  const people: HumanIntakePerson[] = [];
  const projects: HumanIntakeProject[] = [];
  const personNames = new Map<string, string>();
  const projectTitles = new Map<string, string>();
  for (const link of links) {
    if (link.entityKind === "person") {
      const displayName = await auth.store.getPersonName(link.entityId);
      if (displayName) {
        people.push({ personId: link.entityId, displayName });
        personNames.set(link.entityId, displayName);
      }
    } else {
      const title = await auth.store.getProjectTitle(link.entityId);
      const history = specs.ok
        ? await specs.writer.getProjectHistory(link.entityId)
        : null;
      if (title) {
        projects.push({
          projectId: link.entityId,
          title,
          cadJobNumber: history?.cadJobNumber ?? null,
          orderNumber: history?.orderNumber ?? null,
          fingerSize: history?.fingerSize ?? null,
          metal: history?.metal ?? null,
          centerStone: history?.centerStone ?? null,
          diamondSupplyNotes: history?.diamondSupplyNotes ?? null,
        });
        projectTitles.set(link.entityId, title);
      }
    }
  }
  const assembled = worldFromSourceLinks({ links, people, projects });
  const text = (detail.source.rawText ?? detail.source.parsedText ?? "").trim();
  const emptyText =
    !text &&
    (detail.source.sourceType === "remarkable" ||
      detail.source.sourceType === "plaud");
  if (text) {
    const confirmedPersonId = assembled.confirmedPersonIds[0] ?? null;
    const confirmedProjectId = assembled.confirmedProjectIds[0] ?? null;
    await ingestHumanEvidenceCandidates(candidates.store, {
      source: detail.source,
      world: assembled.world,
      personId: confirmedPersonId,
      projectId: confirmedProjectId,
    });
  }
  const persisted = await listHumanSourceCandidatesForSource(
    candidates.store,
    sourceId,
  );
  const reviews = presentHumanIntakeReviewViews({
    candidates: persisted,
    personNames,
    projectTitles,
  });

  return (
    <ConciergeShell>
      <Link
        href={conciergeInboxPath()}
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← Inbox
      </Link>
      <div className="hg-concierge-fade mt-8">
        <HumanSourceDetail detail={detail}>
          {emptyText ? (
            <p className="mt-4 text-[15px] leading-relaxed text-[#d8cfc4]">
              This export has no associated text. Continuum does not OCR
              reMarkable files, and it does not invent Candidates from file
              names or pixels.
            </p>
          ) : (
            <IntakeCandidateReviewList sourceId={sourceId} reviews={reviews} />
          )}
        </HumanSourceDetail>
        <div className="mt-10 flex flex-wrap gap-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Link
            href={conciergeInboxPath()}
            className="inline-flex min-h-12 items-center text-[11px] uppercase tracking-[0.24em] text-[#efe8de] outline-none hover:text-[#ad9164]"
          >
            Done
          </Link>
          <Link
            href={conciergeInboxNewPath()}
            className="inline-flex min-h-12 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de]"
          >
            Another PLAUD
          </Link>
          <Link
            href={conciergeInboxRemarkablePath()}
            className="inline-flex min-h-12 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de]"
          >
            Another reMarkable
          </Link>
        </div>
      </div>
    </ConciergeShell>
  );
}
