import type { Metadata } from "next";
import InformationSignalMapView from "../components/information-signal-map-view";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";
import SubscribeSection from "../components/subscribe-section";

export const metadata: Metadata = {
  title: "Information Signal Map",
  description:
    "Hourglass Ledger Information Signal Map — signal clarity across institutional, market, mainstream, and infrastructure information layers.",
};

export default function InformationSignalMapPage() {
  return (
    <LedgerShell activeIndexId="information-signal">
      <InformationSignalMapView />
      <LedgerPageFooter />
      <SubscribeSection className="ledger-subscribe-tight pb-16 md:pb-20" />
    </LedgerShell>
  );
}
