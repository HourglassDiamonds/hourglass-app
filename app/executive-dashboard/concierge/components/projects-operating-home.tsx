import Link from "next/link";
import type { CurrentProjectCard } from "@/lib/continuum/client-memory/open-projects/card";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";
import {
  CONCIERGE_PROJECTS_PATH,
  conciergeProjectPath,
} from "@/lib/continuum/client-memory/read/presentation";
import { OpenProjectsHome } from "./open-projects-home";

export function ProjectsOperatingHome({
  active,
  past,
  view,
}: {
  active: CurrentProjectCard[];
  past: ProjectDeskSummary[];
  view: "active" | "past";
}) {
  const activeHref = CONCIERGE_PROJECTS_PATH;
  const pastHref = `${CONCIERGE_PROJECTS_PATH}?view=past`;
  return (
    <div data-projects-operating className="hg-concierge-fade">
      <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#efe8de]">
        Projects
      </h1>
      <nav className="hg-destination-switch mt-6" aria-label="Project horizon">
        <Link
          href={activeHref}
          aria-current={view === "active" ? "page" : undefined}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
        >
          Active
        </Link>
        <Link
          href={pastHref}
          aria-current={view === "past" ? "page" : undefined}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
        >
          Past
        </Link>
      </nav>
      {view === "active" ? (
        <div className="mt-8">
          <OpenProjectsHome projects={active} heading={null} />
        </div>
      ) : (
        <section data-projects-past className="mt-8">
          {past.length === 0 ? (
            <p className="max-w-[38ch] text-[15px] leading-relaxed text-[#c4b7aa]">
              Past work is not searchable yet. Projects leave this list when they
              are no longer current.
            </p>
          ) : (
            <ul className="space-y-1">
              {past.map((project) => (
                <li key={project.projectId} className="min-w-0 border-b border-white/[0.06]">
                  <Link
                    href={conciergeProjectPath(project.projectId)}
                    className="block min-h-11 py-3 outline-none"
                  >
                    <span className="block break-words font-serif text-[1.15rem] leading-snug tracking-[-0.02em] text-[#efe8de]">
                      {project.title}
                    </span>
                    {project.people[0]?.displayName || project.lifecycleLabel ? (
                      <span className="mt-1 block text-[11px] uppercase tracking-[0.16em] text-[#8d8073]">
                        {[project.people[0]?.displayName, project.lifecycleLabel]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
