import Link from "next/link";
import {
  conciergeProjectPath,
  conciergeProjectsPath,
} from "@/lib/continuum/client-memory/read/presentation";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";

export function ProjectsHome({
  projects,
}: {
  projects: ProjectDeskSummary[];
}) {
  return (
    <section>
      <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
        Projects
      </h2>
      <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-[#c4b7aa]">
        Current operating state is unknown.
      </p>
      {projects.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {projects.map((project) => (
            <li key={project.projectId}>
              <Link
                href={conciergeProjectPath(project.projectId)}
                className="inline-flex min-h-11 items-center font-serif text-[1.15rem] leading-snug tracking-[-0.02em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164]"
              >
                {project.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <Link
        href={conciergeProjectsPath()}
        className="mt-5 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        View all projects
      </Link>
    </section>
  );
}
