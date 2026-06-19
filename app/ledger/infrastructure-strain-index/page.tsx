import type { Metadata } from "next";
import InfrastructureStrainIndexView from "../components/infrastructure-strain-index-view";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";

export const metadata: Metadata = {
  title: "Infrastructure Strain Index",
  description:
    "Hourglass Ledger Infrastructure Strain Index — elevated physical strain in a capacity expansion race: power, grid, data centers, transformers, cooling, and labor.",
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
