import Header from "@/app/shared-components/Header";
import type { LedgerIndexId } from "../ledger-data";
import "../ledger-index-system.css";
import LedgerSubnav from "./ledger-subnav";
import type { LedgerPublication } from "@/lib/ledger-automation/publication-types";

type LedgerShellProps = {
  children: React.ReactNode;
  /** Highlights active index in subnav; omit on hub-only views if needed */
  activeIndexId?: LedgerIndexId;
  showSubnav?: boolean;
  publication: LedgerPublication;
};

export default function LedgerShell({
  children,
  activeIndexId,
  showSubnav = true,
  publication,
}: LedgerShellProps) {
  return (
    <div
      className="min-h-screen bg-[#efe8de] text-[#1c1b1a]"
      data-ledger-publication-id={publication.publicationId}
      data-ledger-publication-date={publication.publicationDate}
      data-ledger-evidence-cutoff={publication.evidenceReviewedThrough}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header />
        {showSubnav ? (
          <LedgerSubnav
            activeId={activeIndexId}
            className="mt-5 md:mt-6"
          />
        ) : null}
        {children}
      </div>
    </div>
  );
}
