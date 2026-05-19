import type { Metadata } from "next";
import InfrastructureStrainIndexView from "../components/infrastructure-strain-index-view";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";
import SubscribeSection from "../components/subscribe-section";

export const metadata: Metadata = {
  title: "Infrastructure Strain Index",
  description:
    "Hourglass Ledger Infrastructure Strain Index — weekly reading of physical constraints beneath digital, economic, and industrial acceleration.",
};

export default function InfrastructureStrainIndexPage() {
  return (
    <LedgerShell activeIndexId="infrastructure-strain">
      <InfrastructureStrainIndexView />
      <LedgerPageFooter />
      <SubscribeSection className="ledger-subscribe-tight pb-16 md:pb-20" />
    </LedgerShell>
  );
}
