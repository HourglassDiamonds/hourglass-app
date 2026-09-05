import Link from "next/link";
import {
  conciergeAddNotePath,
  conciergeAddOpenJobPath,
  conciergeAddProjectArtifactPath,
  conciergeClientPath,
  conciergeCorrectOperatingDetailPath,
  conciergeCorrectProjectKindPath,
  conciergeCorrectProjectLifecyclePath,
  conciergeCorrectProjectSpecPath,
  conciergeOpenJobPath,
  formatNoteDate,
  noteContextLabel,
  noteSourceLabel,
} from "@/lib/continuum/client-memory/read/presentation";
import type { ProjectDeskRead } from "@/lib/continuum/client-memory/project-desk/types";
import { coverageRows } from "@/lib/continuum/client-memory/project-desk/status";
import { projectRevisionFieldLabel } from "@/lib/continuum/client-memory/project-spec/types";
import {
  projectKindLabel,
} from "@/lib/continuum/client-memory/project-kind";
import { OPERATING_DETAIL_NOT_SET } from "@/lib/continuum/client-memory/project-operating/fields";
import type { ProjectOperatingLayer } from "@/lib/continuum/client-memory/project-operating/layer";
import {
  PROJECT_LIFECYCLE_CURRENT_LABEL,
  PROJECT_LIFECYCLE_HISTORY_TITLE,
  PROJECT_LIFECYCLE_SECTION_TITLE,
} from "@/lib/continuum/client-memory/project-lifecycle";
import type { ProjectLifecycleView } from "@/lib/continuum/client-memory/project-lifecycle/view";
import {
  OPEN_JOB_ACTOR_FIELD_LABEL,
  OPEN_JOB_ADD_LABEL,
  OPEN_JOB_DEFERRED_LABEL,
  OPEN_JOB_EDIT_LABEL,
  OPEN_JOB_SECTION_TITLE,
  OPEN_JOBS_NONE_LABEL,
  OPEN_JOBS_NOT_CONNECTED_LABEL,
  openJobActorLabel,
  openJobKindLabel,
  openJobSourceLabel,
  projectWorkFacts,
} from "@/lib/continuum/client-memory/project-jobs/present";
import type { ProjectDeskOpenJobs } from "@/lib/continuum/client-memory/project-jobs/types";
import type { ProjectWorkSummary } from "@/lib/continuum/client-memory/project-jobs/intelligence";
import type { ProjectDeskArtifacts } from "@/lib/continuum/client-memory/project-artifacts/types";
import {
  PROJECT_ARTIFACT_ADD_LABEL,
  PROJECT_ARTIFACT_DELETION_LABEL,
  PROJECT_ARTIFACT_SECTION_TITLE,
  PROJECT_ARTIFACTS_NONE_LABEL,
  PROJECT_ARTIFACTS_NOT_CONNECTED_LABEL,
  projectArtifactKindLabel,
  projectArtifactSourceLabel,
} from "@/lib/continuum/client-memory/project-artifacts/present";
import { ClientMemorySection } from "./client-memory-section";

export function ProjectDeskView({
  desk,
  justSavedSpec = false,
}: {
  desk: ProjectDeskRead;
  justSavedSpec?: boolean;
}) {
  const coverage = coverageRows(desk.coverage);
  const notePeople = desk.people;

  return (
    <article>
      <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#efe8de]">
        {desk.title}
      </h1>
      {justSavedSpec ? (
        <p className="mt-4 text-[15px] leading-relaxed text-[#c4b7aa]" role="status">
          Correction saved.
        </p>
      ) : null}

      <section className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#ad9164]">
          Status unknown
        </p>
        <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          {desk.operationalStatus.evidence}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          {coverage.map((row) => (
            <div key={row.label}>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-[#8d8073]">
                {row.label}
              </dt>
              <dd className="mt-1 text-[13px] text-[#d8cfc4]">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {desk.people.length > 0 ? (
        <ClientMemorySection title="People">
          <ul className="space-y-3">
            {desk.people.map((person) => (
              <li key={person.personId}>
                <Link
                  href={conciergeClientPath(person.personId)}
                  className="inline-flex min-h-11 items-center font-serif text-[1.2rem] leading-snug tracking-[-0.02em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164]"
                >
                  {person.displayName}
                </Link>
              </li>
            ))}
          </ul>
        </ClientMemorySection>
      ) : (
        <ClientMemorySection title="People">
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            No people are linked to this project.
          </p>
        </ClientMemorySection>
      )}

      <ClientMemorySection title="Project Kind">
        <dl>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              Project Kind
            </dt>
            <dd className="mt-1 break-words text-[15px] leading-relaxed text-[#e7ddd2]">
              {projectKindLabel(desk.projectKind)}
            </dd>
            <dd>
              <Link
                href={conciergeCorrectProjectKindPath(desk.projectId)}
                className="mt-1 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
              >
                {desk.projectKind ? "Correct" : "Set"}
              </Link>
            </dd>
          </div>
        </dl>
      </ClientMemorySection>

      <LifecycleSection projectId={desk.projectId} lifecycle={desk.lifecycle} />

      <OperatingLayerSection
        projectId={desk.projectId}
        layer={desk.operatingLayer}
      />

      {desk.specs.length > 0 ? (
        <ClientMemorySection title="Project Details">
          <dl className="space-y-3">
            {desk.specs.map((row) => (
              <div key={row.fieldName}>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                  {row.label}
                </dt>
                <dd className="mt-1 break-words text-[15px] leading-relaxed text-[#e7ddd2]">
                  {row.value}
                </dd>
                <dd>
                  <Link
                    href={conciergeCorrectProjectSpecPath(desk.projectId, row.fieldName)}
                    className="mt-1 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
                  >
                    Correct
                  </Link>
                </dd>
              </div>
            ))}
          </dl>
        </ClientMemorySection>
      ) : null}

      {desk.specCorrections.length > 0 ? (
        <ClientMemorySection title="Correction history">
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center text-[12px] uppercase tracking-[0.2em] text-[#ad9164] outline-none focus-visible:text-[#efe8de]">
              <span className="group-open:hidden">Show prior values</span>
              <span className="hidden group-open:inline">Hide prior values</span>
            </summary>
            <ol className="mt-3 space-y-4">
              {desk.specCorrections.map((row) => (
                <li key={row.id}>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                    {projectRevisionFieldLabel(row.fieldName)}
                  </p>
                  <p className="mt-1 break-words text-[15px] leading-relaxed text-[#e7ddd2]">
                    {row.priorValue ?? "—"} → {row.newValue ?? "—"}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                    Corrected {formatNoteDate(row.changedAt)}
                    {row.changedBy ? ` by ${row.changedBy}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </details>
        </ClientMemorySection>
      ) : null}

      {desk.latestNotePreview ? (
        <ClientMemorySection title="Latest Context">
          <p className="text-[15px] leading-relaxed text-[#e9dfd4]">
            {desk.latestNotePreview}
          </p>
          {desk.latestNoteAt ? (
            <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              {formatNoteDate(desk.latestNoteAt)}
            </p>
          ) : null}
        </ClientMemorySection>
      ) : null}

      {desk.notes.length > 0 ? (
        <ClientMemorySection title="Notes">
          <ol className="space-y-5">
            {desk.notes.map((note) => {
              const provenance = [
                noteContextLabel(note.contextLayer),
                noteSourceLabel({ sourceSystem: note.sourceSystem }),
                formatNoteDate(note.createdAt),
                note.personName,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={note.id}
                  className="border-t border-white/[0.06] pt-5 first:border-t-0 first:pt-0"
                >
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.55] text-[#e9dfd4]">
                    {note.noteText}
                  </p>
                  {provenance ? (
                    <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                      {provenance}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </ClientMemorySection>
      ) : null}

      <OpenJobsSection
        projectId={desk.projectId}
        jobs={desk.openJobs}
        projectWork={desk.projectWork}
      />

      <ProjectFilesSection
        projectId={desk.projectId}
        artifacts={desk.artifacts}
      />

      {notePeople.length === 1 ? (
        <div className="mt-10">
          <Link
            href={conciergeAddNotePath(notePeople[0].personId)}
            className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
          >
            Add Note
          </Link>
        </div>
      ) : notePeople.length > 1 ? (
        <ClientMemorySection title="Add a note">
          <ul className="space-y-2">
            {notePeople.map((person) => (
              <li key={person.personId}>
                <Link
                  href={conciergeAddNotePath(person.personId)}
                  className="inline-flex min-h-11 items-center text-[15px] text-[#d8cfc4] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
                >
                  {person.displayName}
                </Link>
              </li>
            ))}
          </ul>
        </ClientMemorySection>
      ) : null}
    </article>
  );
}

function OpenJobsSection({
  projectId,
  jobs,
  projectWork,
}: {
  projectId: string;
  jobs: ProjectDeskOpenJobs;
  projectWork: ProjectWorkSummary;
}) {
  if (!jobs.connected) {
    return (
      <ClientMemorySection title={OPEN_JOB_SECTION_TITLE}>
        <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
          {OPEN_JOBS_NOT_CONNECTED_LABEL}
        </p>
      </ClientMemorySection>
    );
  }
  return (
    <ClientMemorySection title={OPEN_JOB_SECTION_TITLE}>
      {jobs.unresolvedCount === 0 ? (
        <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
          {OPEN_JOBS_NONE_LABEL}
        </p>
      ) : (
        <>
          {projectWork.connected && projectWork.unresolvedCount > 0 ? (
            <p className="text-[13px] leading-relaxed text-[#d8cfc4]">
              {projectWorkFacts(projectWork).join(" · ")}
            </p>
          ) : null}
        <ol className="space-y-5">
          {jobs.unresolved.map((job) => (
            <li
              key={job.jobId}
              className="border-t border-white/[0.06] pt-5 first:border-t-0 first:pt-0"
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                {openJobKindLabel(job.kind)}
              </p>
              <p className="mt-1 break-words text-[15px] leading-relaxed text-[#e7ddd2]">
                {job.subject}
              </p>
              {job.detail ? (
                <p className="mt-2 break-words text-[14px] leading-relaxed text-[#c4b7aa]">
                  {job.detail}
                </p>
              ) : null}
              <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                {OPEN_JOB_ACTOR_FIELD_LABEL} · {openJobActorLabel(job.waitingOnActor)}
                {job.associatedPersonName ? ` · ${job.associatedPersonName}` : ""}
              </p>
              {job.state === "snoozed" && job.deferredUntil ? (
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                  {OPEN_JOB_DEFERRED_LABEL} {formatNoteDate(job.deferredUntil)}
                </p>
              ) : null}
              {job.dueAt ? (
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                  Due {formatNoteDate(job.dueAt)}
                </p>
              ) : null}
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                {openJobSourceLabel(job.sourceSystem)} · {formatNoteDate(job.createdAt)}
              </p>
              <Link
                href={conciergeOpenJobPath(projectId, job.jobId)}
                className="mt-2 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
              >
                {OPEN_JOB_EDIT_LABEL}
              </Link>
            </li>
          ))}
        </ol>
        </>
      )}
      <Link
        href={conciergeAddOpenJobPath(projectId)}
        className="mt-4 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        {OPEN_JOB_ADD_LABEL}
      </Link>
    </ClientMemorySection>
  );
}

function artifactSizeLabel(byteSize: number): string {
  if (byteSize >= 1_048_576) {
    return `${(byteSize / 1_048_576).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(byteSize / 1024))} KB`;
}

function ProjectFilesSection({
  projectId,
  artifacts,
}: {
  projectId: string;
  artifacts: ProjectDeskArtifacts;
}) {
  if (!artifacts.connected) {
    return (
      <ClientMemorySection title={PROJECT_ARTIFACT_SECTION_TITLE}>
        <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
          {PROJECT_ARTIFACTS_NOT_CONNECTED_LABEL}
        </p>
      </ClientMemorySection>
    );
  }
  return (
    <ClientMemorySection title={PROJECT_ARTIFACT_SECTION_TITLE}>
      {artifacts.count === 0 ? (
        <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
          {PROJECT_ARTIFACTS_NONE_LABEL}
        </p>
      ) : (
        <ol className="space-y-5">
          {artifacts.items.map((row) => (
            <li
              key={row.artifactId}
              className="border-t border-white/[0.06] pt-5 first:border-t-0 first:pt-0"
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                {projectArtifactKindLabel(row.kind)}
              </p>
              <p className="mt-1 break-words text-[15px] leading-relaxed text-[#e7ddd2]">
                {row.title}
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                {row.originalFilename} · {artifactSizeLabel(row.byteSize)} ·{" "}
                {projectArtifactSourceLabel(row.sourceSystem)}
              </p>
              <a
                href={row.href}
                className="mt-2 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
              >
                {row.mimeType === "application/pdf" ? "Open file" : "View file"}
              </a>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-[12px] leading-relaxed text-[#8d8073]">
        {PROJECT_ARTIFACT_DELETION_LABEL}
      </p>
      <Link
        href={conciergeAddProjectArtifactPath(projectId)}
        className="mt-2 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        {PROJECT_ARTIFACT_ADD_LABEL}
      </Link>
    </ClientMemorySection>
  );
}

function LifecycleSection({
  projectId,
  lifecycle,
}: {
  projectId: string;
  lifecycle: ProjectLifecycleView;
}) {
  if (lifecycle.kind === "none") return null;
  return (
    <ClientMemorySection title={PROJECT_LIFECYCLE_SECTION_TITLE}>
      <dl>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            Current Stage
          </dt>
          <dd className="mt-1 break-words text-[15px] leading-relaxed text-[#e7ddd2]">
            {lifecycle.label}
          </dd>
          <dd>
            <Link
              href={conciergeCorrectProjectLifecyclePath(projectId)}
              className="mt-1 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
            >
              {lifecycle.stage ? "Correct" : "Set"}
            </Link>
          </dd>
        </div>
      </dl>
      <ol className="hg-lifecycle-rail mt-5">
        {lifecycle.stages.map((row) => (
          <li
            key={row.stage}
            aria-current={row.current ? "step" : undefined}
            className={
              row.current
                ? "min-w-0 max-w-full break-words text-[13px] font-medium leading-snug text-[#efe8de]"
                : "min-w-0 max-w-full break-words text-[13px] leading-snug text-[#8d8073]"
            }
          >
            {row.label}
            {row.current ? (
              <span className="ml-1 text-[10px] uppercase tracking-[0.16em] text-[#ad9164]">
                {PROJECT_LIFECYCLE_CURRENT_LABEL}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      {lifecycle.history.length > 0 ? (
        <div className="mt-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            {PROJECT_LIFECYCLE_HISTORY_TITLE}
          </p>
          <ol className="mt-3 space-y-3">
            {lifecycle.history.map((row) => (
              <li key={row.eventId} className="min-w-0">
                <p className="break-words text-[14px] leading-relaxed text-[#e7ddd2]">
                  {formatNoteDate(row.changedAt)} {row.label}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </ClientMemorySection>
  );
}

function OperatingLayerSection({
  projectId,
  layer,
}: {
  projectId: string;
  layer: ProjectOperatingLayer;
}) {
  if (layer.kind === "none") return null;
  return (
    <ClientMemorySection title={layer.title}>
      <dl className="space-y-3">
        {layer.fields.map((row) => (
          <div key={row.fieldName}>
            <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              {row.label}
            </dt>
            <dd className="mt-1 break-words text-[15px] leading-relaxed text-[#e7ddd2]">
              {row.value?.trim() ? row.value : OPERATING_DETAIL_NOT_SET}
            </dd>
            <dd>
              <Link
                href={conciergeCorrectOperatingDetailPath(projectId, row.fieldName)}
                className="mt-1 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
              >
                {row.value?.trim() ? "Correct" : "Set"}
              </Link>
            </dd>
          </div>
        ))}
      </dl>
    </ClientMemorySection>
  );
}
