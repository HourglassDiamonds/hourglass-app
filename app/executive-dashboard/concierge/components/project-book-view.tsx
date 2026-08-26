import { ProjectBookCard } from "./project-book-card";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";

export function ProjectBookView({
  projects,
}: {
  projects: ProjectDeskSummary[];
}) {
  return (
    <div>
      <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#efe8de]">
        Projects
      </h1>
      <p className="mt-4 max-w-[38ch] text-[15px] leading-relaxed text-[#c4b7aa]">
        Current operating state is unknown.
      </p>

      {projects.length === 0 ? (
        <p className="mt-10 max-w-[34ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          No projects are in Client Memory yet.
        </p>
      ) : (
        <ul className="hg-project-book mt-10">
          {projects.map((project) => (
            <li key={project.projectId}>
              <ProjectBookCard project={project} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
