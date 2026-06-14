import type { Metadata } from "next";
import InformationSignalMapView from "../components/information-signal-map-view";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";

export const metadata: Metadata = {
  title: "Information Signal Map",
  description:
    "Hourglass Ledger Information Signal Map — narrative convergence and framing comparison across institutional, market, infrastructure, and mainstream information layers.",
};

export default function InformationSignalMapPage() {
  return (
    <LedgerShell activeIndexId="information-signal">
      <InformationSignalMapView />
      <LedgerPageFooter />
    </LedgerShell>
  );
}
