import Link from "next/link";
import { greetingLine } from "@/lib/continuum/dashboard/compose";
import type { ContinuumHomeModel } from "@/lib/continuum/dashboard/types";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";
import type { CurrentProjectCard } from "@/lib/continuum/client-memory/open-projects/card";
import { EXECUTIVE_DASHBOARD_PASSKEYS_PATH } from "@/lib/executive-dashboard/access";
import { AskConciergeShell } from "./ask-concierge-shell";
import { ChiefOfStaffToday } from "./chief-of-staff-today";
import { ConciergeSearch } from "./concierge-search";
import { ConciergeSignOut } from "./concierge-sign-out";
import { OpenProjectsHome } from "./open-projects-home";
import { ProjectsHome } from "./projects-home";
import { QuickCapture } from "./quick-capture";
import { CONCIERGE_GMAIL_PATH } from "@/lib/continuum/gmail/types";
import { conciergeCohort1Path } from "@/lib/continuum/client-memory/read/presentation";

export function CommandCenterHome({
  model,
  projects,
  openProjects,
}: {
  model: ContinuumHomeModel;
  projects: ProjectDeskSummary[];
  openProjects: CurrentProjectCard[];
}) {
  return (
    <div data-command-center className="hg-command-grid">
      <div className="flex flex-col gap-9 lg:gap-11">
        <h1 className="font-serif text-[2.05rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#efe8de] md:text-[2.45rem]">
          {greetingLine(model)}
        </h1>
        <ChiefOfStaffToday chiefOfStaff={model.chiefOfStaff} />
        <AskConciergeShell />
      </div>
      <div className="flex flex-col gap-9 lg:gap-10">
        <OpenProjectsHome projects={openProjects} />
        <ProjectsHome projects={projects} />
        <section>
          <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
            People
          </h2>
          <div className="mt-4">
            <ConciergeSearch />
          </div>
        </section>
        <QuickCapture />
        <div className="flex items-center justify-between gap-4 lg:mt-4">
          <div className="flex items-center gap-5">
            <Link
              href={CONCIERGE_GMAIL_PATH}
              className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
            >
              Gmail
            </Link>
            <Link
              href={conciergeCohort1Path()}
              className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
            >
              Reconstruction
            </Link>
            <Link
              href={EXECUTIVE_DASHBOARD_PASSKEYS_PATH}
              className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
            >
              Passkeys
            </Link>
          </div>
          <ConciergeSignOut />
        </div>
      </div>
    </div>
  );
}
