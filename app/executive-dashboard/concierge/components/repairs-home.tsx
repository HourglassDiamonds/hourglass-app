import Link from "next/link";
import type { CurrentProjectCard } from "@/lib/continuum/client-memory/open-projects/card";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";
import {
  conciergeNewRepairQuotePath,
  conciergeProjectPath,
  conciergeProjectRepairPath,
  conciergeRepairQuotePath,
  conciergeRepairQuotesPath,
} from "@/lib/continuum/client-memory/read/presentation";
import {
  REPAIR_QUOTE_ADD_LABEL,
  REPAIR_QUOTE_SECTION_TITLE,
  REPAIR_QUOTE_STATE_LABELS,
  repairQuoteAmountLabel,
  repairQuoteDisplayTitle,
} from "@/lib/continuum/repair-quoting/present";
import type { RepairQuote } from "@/lib/continuum/repair-quoting/types";
import { OpenProjectsHome } from "./open-projects-home";

export type RepairsHomeQuote = {
  projectId: string;
  projectTitle: string;
  quote: RepairQuote;
};

export function RepairsHome({
  current,
  issued,
  other,
  quotesConnected,
}: {
  current: CurrentProjectCard[];
  issued: RepairsHomeQuote[];
  other: ProjectDeskSummary[];
  quotesConnected: boolean;
}) {
  return (
    <div data-repairs-home className="hg-concierge-fade">
      <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#efe8de]">
        Repairs
      </h1>
      <p className="mt-3 max-w-[38ch] text-[15px] leading-relaxed text-[#c4b7aa]">
        Repair / Service projects already in Continuum.
      </p>

      <section className="mt-10">
        <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
          Current repairs
        </h2>
        <div className="mt-4">
          <OpenProjectsHome projects={current} heading={null} />
        </div>
        {current.length > 0 ? (
          <ul className="mt-6 space-y-4">
            {current.map((project) => (
              <li key={`repair-access-${project.projectId}`} className="min-w-0">
                <p className="font-serif text-[1.05rem] tracking-[-0.02em] text-[#efe8de]">
                  {project.title}
                </p>
                <p className="mt-1 flex min-w-0 flex-wrap gap-x-5">
                  <Link
                    href={conciergeProjectRepairPath(project.projectId)}
                    className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de]"
                  >
                    Repair / Service
                  </Link>
                  <Link
                    href={conciergeRepairQuotesPath(project.projectId)}
                    className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de]"
                  >
                    {REPAIR_QUOTE_SECTION_TITLE}
                  </Link>
                  {quotesConnected ? (
                    <Link
                      href={conciergeNewRepairQuotePath(project.projectId)}
                      className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de]"
                    >
                      {REPAIR_QUOTE_ADD_LABEL}
                    </Link>
                  ) : null}
                  <Link
                    href={conciergeProjectPath(project.projectId)}
                    className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#8d8073] outline-none hover:text-[#efe8de]"
                  >
                    Project
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="mt-12">
        <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
          Issued quotes
        </h2>
        {!quotesConnected ? (
          <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed text-[#c4b7aa]">
            Repair quotes are not connected yet.
          </p>
        ) : issued.length === 0 ? (
          <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed text-[#c4b7aa]">
            No issued quotes are visible yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {issued.map(({ projectId, projectTitle, quote }) => (
              <li key={quote.quoteId}>
                <Link
                  href={conciergeRepairQuotePath(projectId, quote.quoteId)}
                  className="block min-h-11 outline-none"
                >
                  <p className="font-serif text-[1.15rem] text-[#efe8de]">
                    {repairQuoteDisplayTitle(quote)}
                  </p>
                  <p className="mt-1 text-[13px] text-[#c4b7aa]">
                    {projectTitle} · {REPAIR_QUOTE_STATE_LABELS[quote.state]} ·{" "}
                    {repairQuoteAmountLabel(quote)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {other.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
            Other repair projects
          </h2>
          <ul className="mt-3">
            {other.map((project) => (
              <li key={project.projectId} className="border-b border-white/[0.06]">
                <Link
                  href={conciergeProjectRepairPath(project.projectId)}
                  className="block min-h-11 py-3 font-serif text-[1.1rem] text-[#efe8de] outline-none hover:text-[#ad9164]"
                >
                  {project.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-12 max-w-[38ch] text-[13px] leading-relaxed text-[#7d7268]">
          Historical repair search will be added later.
        </p>
      )}
    </div>
  );
}
