import Link from "next/link";
import type { ReactNode } from "react";
import type { OpenProjectWorkItem } from "@/lib/continuum/client-memory/open-projects/select";
import {
  conciergePreviousRepairQuotesPath,
  conciergeProjectPath,
  conciergeProjectRepairPath,
} from "@/lib/continuum/client-memory/read/presentation";

export function RepairsHome({
  current,
  quotesConnected,
  children,
}: {
  current: OpenProjectWorkItem[];
  quotesConnected: boolean;
  children?: ReactNode;
}) {
  return (
    <div data-repairs-home className="hg-concierge-fade">
      <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#efe8de]">
        Repairs
      </h1>
      <p className="mt-3 max-w-[38ch] text-[15px] leading-relaxed text-[#c4b7aa]">
        Describe the repair. Continuum will keep the conversation together and only ask for what is missing.
      </p>
      {children}

      <div className="mt-6 flex flex-wrap items-center gap-x-6">
        {quotesConnected ? (
          <Link
            href={conciergePreviousRepairQuotesPath()}
            className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
          >
            Previous Quotes
          </Link>
        ) : (
          <span className="inline-flex min-h-11 items-center text-[12px] text-[#8d8073]">
            Quote history is unavailable right now.
          </span>
        )}
      </div>

      <section className="mt-12">
        <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
          Active repairs
        </h2>
        {current.length === 0 ? (
          <p className="mt-3 text-[15px] leading-relaxed text-[#a99b8d]">No active repairs.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/[0.06]">
            {current.map((project) => (
              <li key={project.projectId} className="flex min-w-0 items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-serif text-[1.08rem] text-[#efe8de]">{project.title}</p>
                  {project.people[0] ? <p className="mt-1 truncate text-[12px] text-[#8d8073]">{project.people[0].displayName}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <Link
                    href={conciergeProjectRepairPath(project.projectId)}
                    className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de]"
                  >
                    Open
                  </Link>
                  <Link
                    href={conciergeProjectPath(project.projectId)}
                    className="hidden min-h-11 items-center text-[11px] text-[#8d8073] outline-none hover:text-[#efe8de] sm:inline-flex"
                  >
                    Project
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
