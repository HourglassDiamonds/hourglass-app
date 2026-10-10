import Header from "@/app/shared-components/Header";
import Link from "next/link";
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
        <aside
          aria-label="Ledger data-provider notices"
          className="my-10 border-t border-[#c9bdae] py-6 text-[11px] leading-relaxed text-[#655d55]"
        >
          <p className="font-medium uppercase tracking-[0.16em] text-[#514a43]">
            Data-provider notices
          </p>
          <p className="mt-3">
            This product uses the Bureau of Economic Analysis (BEA) Data API but is not
            endorsed or certified by BEA. This product uses the FRED® API but is not
            endorsed or certified by the Federal Reserve Bank of St. Louis. Energy data
            identified as EIA is sourced from the U.S. Energy Information Administration;
            no provider endorses Hourglass Diamonds or the Ledger.
          </p>
          <p className="mt-2">
            Provider terms: {" "}
            <a
              href="https://apps.bea.gov/API/_pdf/bea_api_tos.pdf"
              className="underline underline-offset-4"
            >
              BEA
            </a>
            {" · "}
            <a
              href="https://www.eia.gov/opendata/terms-of-service.php"
              className="underline underline-offset-4"
            >
              EIA
            </a>
            {" · "}
            <a
              href="https://fred.stlouisfed.org/docs/api/terms_of_use.html"
              className="underline underline-offset-4"
            >
              FRED® API
            </a>
            {" · "}
            <Link href="/terms" className="underline underline-offset-4">
              Hourglass terms
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
