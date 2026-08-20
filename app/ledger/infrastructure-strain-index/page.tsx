import type { Metadata } from "next";
import InfrastructureStrainIndexView from "../components/infrastructure-strain-index-view";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";

export const metadata: Metadata = {
  title: "Infrastructure Strain Monitor",
  description:
    "Hourglass Ledger Infrastructure Strain Monitor — high physical strain with active multi-regional adaptation across power, grid, data centers, water-to-energy effects, and labor.",
  alternates: {
    canonical: "/ledger/infrastructure-strain-index",
  },
  openGraph: {
    url: "/ledger/infrastructure-strain-index",
  },
};

export default function InfrastructureStrainIndexPage() {
  return (
    <LedgerShell activeIndexId="infrastructure-strain">
      <InfrastructureStrainIndexView />
      <LedgerPageFooter />
    </LedgerShell>
  );
}
