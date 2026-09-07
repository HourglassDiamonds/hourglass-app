import Link from "next/link";
import { ConciergeShell } from "../../components/concierge-shell";
import {
  presentEightProjectCandidateDryRun,
  GMAIL_CANDIDATE_DEV_HEADING,
  GMAIL_CANDIDATE_DEV_WARNING,
} from "@/lib/continuum/gmail/candidates/dry-run";
import { CONCIERGE_GMAIL_PATH } from "@/lib/continuum/gmail/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gmail candidates (dev)",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function GmailCandidatesDevPage() {
  const dryRun = presentEightProjectCandidateDryRun();

  return (
    <ConciergeShell>
      <Link
        href={CONCIERGE_GMAIL_PATH}
        aria-label="Back to Gmail"
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.14em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← Gmail
      </Link>
      <div className="hg-concierge-fade mt-6">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#8d8073]">
          Developer / internal
        </p>
        <h1 className="mt-2 font-serif text-[1.95rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de] md:text-[2.15rem]">
          {GMAIL_CANDIDATE_DEV_HEADING}
        </h1>
        <p className="mt-3 max-w-xl text-[14px] leading-6 text-[#c6b8a8]">
          {GMAIL_CANDIDATE_DEV_WARNING}
        </p>
        <p className="mt-2 text-[13px] text-[#8d8073]">
          {dryRun.candidateCount} fixture candidates · liveModelCalls=
          {String(dryRun.liveModelCalls)} · canonical=false
        </p>
        <ol className="mt-8 space-y-4">
          {dryRun.candidates.map((row) => (
            <li
              key={row.candidateId}
              className="border border-[#3a342e] p-4 text-[13px] leading-6 text-[#c6b8a8]"
            >
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#efe8de]">
                {row.candidateType} · {row.status} · {row.confidence}
              </p>
              <p className="mt-1 break-all font-mono text-[11px] text-[#8d8073]">
                {row.sourceRef}
              </p>
              <p className="mt-2">{row.evidenceBasis.ruleIds.join(", ")}</p>
              {row.evidenceBasis.matchedText ? (
                <p className="mt-1 text-[#efe8de]">{row.evidenceBasis.matchedText}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </ConciergeShell>
  );
}
