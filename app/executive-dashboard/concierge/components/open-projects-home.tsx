import Link from "next/link";
import type { OpenProjectWorkItem } from "@/lib/continuum/client-memory/open-projects/select";
import {
  OPEN_PROJECT_NEXT_DUE_LABEL,
  OPEN_PROJECT_WORK_NONE_LABEL,
  OPEN_PROJECT_WORK_TITLE,
} from "@/lib/continuum/client-memory/open-projects/present";
import { projectWorkFacts } from "@/lib/continuum/client-memory/project-jobs/present";
import { formatNoteDate } from "@/lib/continuum/client-memory/read/presentation";

export function OpenProjectsHome({
  projects,
}: {
  projects: OpenProjectWorkItem[];
}) {
  return (
    <section>
      <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
        {OPEN_PROJECT_WORK_TITLE}
      </h2>
      {projects.length === 0 ? (
        <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          {OPEN_PROJECT_WORK_NONE_LABEL}
        </p>
      ) : (
        <ul className="mt-4 space-y-6">
          {projects.map((project) => {
            const facts = projectWorkFacts(project.projectWork);
            const nextDue =
              project.projectWork.connected && project.projectWork.nextDueAt
                ? project.projectWork.nextDueAt
                : null;
            return (
              <li key={project.projectId} className="min-w-0">
                <Link
                  href={project.href}
                  className="inline-flex min-h-11 max-w-full items-center break-words font-serif text-[1.15rem] leading-snug tracking-[-0.02em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164]"
                >
                  {project.title}
                </Link>
                {project.people.length > 0 ? (
                  <p className="mt-1 break-words text-[14px] leading-relaxed text-[#c4b7aa]">
                    {project.people.map((person) => person.displayName).join(" · ")}
                  </p>
                ) : null}
                {project.lifecycleLabel ? (
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                    {project.lifecycleLabel}
                  </p>
                ) : null}
                {facts.length > 0 &&
                !(facts.length === 1 && facts[0] === "No open jobs recorded.") ? (
                  <p className="mt-2 break-words text-[13px] leading-relaxed text-[#d8cfc4]">
                    {facts.join(" · ")}
                  </p>
                ) : null}
                {nextDue ? (
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                    {OPEN_PROJECT_NEXT_DUE_LABEL} {formatNoteDate(nextDue)}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
