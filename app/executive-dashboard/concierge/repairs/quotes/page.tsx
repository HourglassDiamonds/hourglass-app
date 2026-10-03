import Link from "next/link";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import {
  conciergeRepairQuotePath,
  conciergeRepairsPath,
} from "@/lib/continuum/client-memory/read/presentation";
import { getAuthenticatedRepairQuoteReader } from "@/lib/continuum/repair-quoting/load";
import {
  REPAIR_QUOTE_STATE_LABELS,
  repairQuoteAmountLabel,
  repairQuoteDisplayTitle,
} from "@/lib/continuum/repair-quoting/present";
import type { RepairQuote } from "@/lib/continuum/repair-quoting/types";
import { ConciergeBackLink } from "../../components/concierge-back-link";
import { ConciergeShell } from "../../components/concierge-shell";
import { ConciergeUnavailable } from "../../components/client-profile-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Previous Quotes",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

type QuoteRow = {
  projectId: string;
  projectTitle: string;
  quote: RepairQuote;
};

export default async function PreviousRepairQuotesPage() {
  const [deskAuth, quoteAuth] = await Promise.all([
    getAuthenticatedProjectDeskReader(),
    getAuthenticatedRepairQuoteReader(),
  ]);

  if (!deskAuth.ok || !quoteAuth.ok || !quoteAuth.connected) {
    return (
      <ConciergeShell variant="book">
        <ConciergeUnavailable
          title="Previous Quotes unavailable."
          body="Quote history could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  try {
    const projects = (await deskAuth.reader.listProjects()).filter(
      (project) => project.projectKind === "repair_service",
    );
    const groups = await Promise.all(
      projects.map(async (project): Promise<QuoteRow[]> => {
        const quotes = await quoteAuth.listQuotes(project.projectId);
        return quotes.map((quote) => ({
          projectId: project.projectId,
          projectTitle: project.title,
          quote,
        }));
      }),
    );
    const rows = groups.flat().sort((left, right) =>
      right.quote.updatedAt.localeCompare(left.quote.updatedAt),
    );
    const drafts = rows.filter((row) => row.quote.state === "draft");
    const history = rows.filter((row) => row.quote.state !== "draft");

    return (
      <ConciergeShell variant="book">
        <ConciergeBackLink href={conciergeRepairsPath()} label="Repairs" />
        <div className="hg-concierge-fade mt-7">
          <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#efe8de]">
            Previous Quotes
          </h1>
          <p className="mt-3 max-w-[40ch] text-[15px] leading-relaxed text-[#a99b8d]">
            Draft, issued, and voided quotes remain available as an immutable record.
          </p>
          <QuoteGroup title="Drafts" rows={drafts} empty="No draft quotes." />
          <QuoteGroup title="History" rows={history} empty="No issued or voided quotes yet." />
          <p className="mt-10 max-w-[42ch] text-[12px] leading-relaxed text-[#74695f]">
            Issued quotes are never hard deleted. Archive and restore controls require a separate quote-state migration and are intentionally not simulated here.
          </p>
        </div>
      </ConciergeShell>
    );
  } catch {
    return (
      <ConciergeShell variant="book">
        <ConciergeBackLink href={conciergeRepairsPath()} label="Repairs" />
        <div className="mt-7">
          <ConciergeUnavailable
            title="Previous Quotes unavailable."
            body="Quote history could not be opened right now."
          />
        </div>
      </ConciergeShell>
    );
  }
}

function QuoteGroup({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: QuoteRow[];
  empty: string;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-[11px] uppercase tracking-[0.24em] text-[#8d8073]">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-[14px] text-[#8d8073]">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-white/[0.06]">
          {rows.map(({ projectId, projectTitle, quote }) => (
            <li key={quote.quoteId}>
              <Link
                href={conciergeRepairQuotePath(projectId, quote.quoteId)}
                className="flex min-h-16 min-w-0 items-center justify-between gap-4 py-3 outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-serif text-[1.08rem] text-[#efe8de]">
                    {repairQuoteDisplayTitle(quote)}
                  </span>
                  <span className="mt-1 block truncate text-[12px] text-[#8d8073]">
                    {projectTitle} · {formatQuoteDate(quote.updatedAt)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[14px] text-[#d8cfc4]">{repairQuoteAmountLabel(quote)}</span>
                  <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] text-[#8d8073]">
                    {REPAIR_QUOTE_STATE_LABELS[quote.state]}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatQuoteDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}
