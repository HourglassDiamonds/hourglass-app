"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import type { CurrentProjectCard } from "@/lib/continuum/client-memory/open-projects/card";
import {
  groupCurrentProjects,
  type CurrentProjectOperatingGroup,
  type CurrentProjectOperatingViewport,
} from "@/lib/continuum/client-memory/open-projects/operating-groups";
import {
  CURRENT_PROJECTS_ACTION_TITLE,
  CURRENT_PROJECTS_CREATE_ACTION_LABEL,
  CURRENT_PROJECTS_EDIT_ACTION_LABEL,
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
import { conciergeCreateActionPath, conciergeEditActionPath, formatNoteDate } from "@/lib/continuum/client-memory/read/presentation";

const DESKTOP_QUERY = "(min-width: 768px)";

function subscribeViewport(onStoreChange: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function desktopViewport(): CurrentProjectOperatingViewport {
  return window.matchMedia(DESKTOP_QUERY).matches ? "desktop" : "mobile";
}

function serverViewport(): CurrentProjectOperatingViewport {
  return "mobile";
}

export function OpenProjectsHome({
  projects,
  viewport,
  nowIso,
}: {
  projects: CurrentProjectCard[];
  viewport?: CurrentProjectOperatingViewport;
  nowIso?: string;
}) {
  const detected = useSyncExternalStore(
    subscribeViewport,
    desktopViewport,
    serverViewport,
  );
  const layout = viewport ?? detected;
  const groups = groupCurrentProjects(projects, {
    nowIso: nowIso ?? new Date().toISOString(),
    viewport: layout,
  });

  return (
    <section data-current-projects data-operating-viewport={layout}>
      <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
        {OPEN_PROJECT_WORK_TITLE}
      </h2>
      {projects.length === 0 ? (
        <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          {OPEN_PROJECT_WORK_NONE_LABEL}
        </p>
      ) : (
        <ul className="hg-current-project-groups mt-4">
          {groups.map((group) => (
            <li key={group.id} className="min-w-0">
              <CurrentProjectGroup group={group} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CurrentProjectGroup({ group }: { group: CurrentProjectOperatingGroup }) {
  return (
    <section
      data-operating-group={group.id}
      data-operating-group-count={group.count}
      className="hg-current-project-group min-w-0 overflow-x-hidden"
    >
      <details className="hg-current-project-group-details" {...(group.defaultOpen ? { open: true } : {})}>
        <summary
          id={group.toggleId}
          aria-controls={group.panelId}
          aria-label={`${group.heading}`}
          className="hg-current-project-group-toggle flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 outline-none"
        >
          <span className="min-w-0 break-words text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
            {group.heading}
          </span>
          <span className="hg-group-open shrink-0 text-[11px] uppercase tracking-[0.2em] text-[#ad9164]">
            Open
          </span>
          <span className="hg-group-close shrink-0 text-[11px] uppercase tracking-[0.2em] text-[#ad9164]">
            Close
          </span>
        </summary>
        <ul id={group.panelId} className="hg-current-projects min-w-0">
          {group.projects.map((project) => (
            <li key={project.projectId} className="min-w-0">
              <CurrentProjectRow project={project} />
            </li>
          ))}
        </ul>
      </details>
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
          {project.currentJobId ? (
            <p>
              <Link
                href={conciergeEditActionPath(project.projectId, project.currentJobId)}
                className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#ad9164] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
              >
                {CURRENT_PROJECTS_EDIT_ACTION_LABEL}
              </Link>
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
          href={conciergeCreateActionPath(project.projectId)}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#ad9164] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          {CURRENT_PROJECTS_CREATE_ACTION_LABEL}
        </Link>
      </p>
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
