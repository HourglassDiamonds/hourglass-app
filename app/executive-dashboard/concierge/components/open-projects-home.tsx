import Link from "next/link";
import type { CurrentProjectCard } from "@/lib/continuum/client-memory/open-projects/card";
import {
  CURRENT_PROJECTS_ACTION_TITLE,
  CURRENT_PROJECTS_FILES_TITLE,
  CURRENT_PROJECTS_LATEST_FILE_TITLE,
  CURRENT_PROJECTS_OPEN_LABEL,
  CURRENT_PROJECTS_PROGRESS_TITLE,
  CURRENT_PROJECTS_SNAPSHOT_TITLE,
  OPEN_PROJECT_WORK_NONE_LABEL,
  OPEN_PROJECT_WORK_TITLE,
  currentProjectPanelId,
  currentProjectToggleId,
} from "@/lib/continuum/client-memory/open-projects/present";
import { formatNoteDate } from "@/lib/continuum/client-memory/read/presentation";

export function OpenProjectsHome({
  projects,
}: {
  projects: CurrentProjectCard[];
}) {
  return (
    <section data-current-projects>
      <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
        {OPEN_PROJECT_WORK_TITLE}
      </h2>
      {projects.length === 0 ? (
        <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          {OPEN_PROJECT_WORK_NONE_LABEL}
        </p>
      ) : (
        <ul className="hg-current-projects mt-4">
          {projects.map((project) => (
            <li key={project.projectId} className="min-w-0">
              <CurrentProjectRow project={project} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CurrentProjectRow({ project }: { project: CurrentProjectCard }) {
  const toggleId = currentProjectToggleId(project.projectId);
  const panelId = currentProjectPanelId(project.projectId);
  return (
    <article
      data-current-project={project.projectId}
      className="hg-current-project min-w-0 overflow-x-hidden"
    >
      <details className="group">
        <summary
          id={toggleId}
          aria-controls={panelId}
          aria-label={`${project.title}. ${project.collapsedLine}`}
          className="hg-current-project-toggle flex min-h-11 cursor-pointer list-none items-start justify-between gap-3 py-3 outline-none"
        >
          <span className="min-w-0">
            <span className="block break-words font-serif text-[1.15rem] leading-snug tracking-[-0.02em] text-[#efe8de]">
              {project.title}
            </span>
            <span
              data-line-kind={project.collapsedLineKind}
              className="hg-current-project-status mt-1 block break-words text-[11px] uppercase leading-relaxed text-[#8d8073]"
            >
              {project.collapsedLine}
            </span>
          </span>
          <span className="mt-1 shrink-0 text-[11px] uppercase tracking-[0.2em] text-[#ad9164] group-open:hidden">
            Open
          </span>
          <span className="mt-1 hidden shrink-0 text-[11px] uppercase tracking-[0.2em] text-[#ad9164] group-open:inline">
            Close
          </span>
        </summary>
        <div id={panelId} className="hg-current-project-panel min-w-0 pb-4">
          <CurrentProjectCardBody project={project} />
        </div>
      </details>
    </article>
  );
}

function showsExpandedCurrentAction(project: CurrentProjectCard): boolean {
  return (
    project.currentAction.source === "ownership" ||
    project.currentAction.source === "job"
  );
}

function CurrentProjectCardBody({ project }: { project: CurrentProjectCard }) {
  return (
    <div className="space-y-5">
      {showsExpandedCurrentAction(project) ? (
        <section data-current-action>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
            {CURRENT_PROJECTS_ACTION_TITLE}
          </p>
          <p
            data-action-source={project.currentAction.source}
            className="mt-2 break-words font-serif text-[1.05rem] leading-snug tracking-[-0.02em] text-[#efe8de]"
          >
            {project.currentAction.label}
          </p>
          {project.currentAction.detail ? (
            <p className="mt-1 break-words text-[14.5px] leading-relaxed text-[#d8cfc4]">
              {project.currentAction.detail}
            </p>
          ) : null}
        </section>
      ) : null}

      {project.snapshot.length > 0 ? (
        <section>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
            {CURRENT_PROJECTS_SNAPSHOT_TITLE}
          </p>
          <dl className="mt-2 space-y-2">
            {project.snapshot.map((row) => (
              <div key={row.fieldName}>
                <dt className="text-[11px] uppercase tracking-[0.16em] text-[#8d8073]">
                  {row.label}
                </dt>
                <dd className="mt-0.5 break-words text-[14.5px] leading-relaxed text-[#e7ddd2]">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {project.latestFile ? (
        <section>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
            {CURRENT_PROJECTS_LATEST_FILE_TITLE}
          </p>
          {project.latestFile.thumbnailSrc ? (
            // Private founder file route. Not a public storage URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.latestFile.thumbnailSrc}
              alt={project.latestFile.title}
              className="hg-current-project-thumb mt-3"
            />
          ) : null}
          <p className="mt-2 break-words text-[13px] uppercase tracking-[0.16em] text-[#8d8073]">
            {project.latestFile.kindLabel}
          </p>
          <p className="mt-1 break-words text-[14.5px] leading-relaxed text-[#e7ddd2]">
            {project.latestFile.title}
          </p>
        </section>
      ) : null}

      <section>
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
          {CURRENT_PROJECTS_FILES_TITLE}
          {project.fileCount > 0 ? ` · ${project.fileCount}` : ""}
        </p>
        {project.files.length === 0 ? (
          <p className="mt-2 text-[14.5px] leading-relaxed text-[#c4b7aa]">
            No project files stored yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {project.files.map((file) => (
              <li key={file.artifactId} className="min-w-0">
                <a
                  href={file.href}
                  className="block min-h-11 min-w-0 max-w-full py-2 break-words text-[14.5px] leading-relaxed text-[#d8cfc4] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
                >
                  {file.kindLabel}
                  {file.title !== file.kindLabel ? ` · ${file.title}` : ""}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {project.progress.length > 0 ? (
        <section>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
            {CURRENT_PROJECTS_PROGRESS_TITLE}
          </p>
          <ul className="mt-2 space-y-1.5">
            {project.progress.map((row, index) => (
              <li
                key={`${row.label}-${row.at ?? "none"}-${index}`}
                className="break-words text-[14.5px] leading-relaxed text-[#d8cfc4]"
              >
                ✓ {row.label}
                {row.at ? ` · ${formatNoteDate(row.at)}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p>
        <Link
          href={project.href}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#ad9164] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          {CURRENT_PROJECTS_OPEN_LABEL}
        </Link>
      </p>
    </div>
  );
}
