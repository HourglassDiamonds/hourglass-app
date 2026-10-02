import type { Metadata } from "next";
import InformationSignalMapView from "../components/information-signal-map-view";
import LedgerPageJsonLd from "../components/ledger-page-json-ld";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";
import { ledgerMetadata } from "../ledger-seo";

const NAME = "Information Signal Map";
const PATH = "/ledger/information-signal-map";
const DESCRIPTION =
  "A qualitative map of narrative convergence and framing across institutional, market, infrastructure, media, and policy information layers.";

export const metadata: Metadata = ledgerMetadata({
  topic: NAME,
  path: PATH,
  description: DESCRIPTION,
});

export default function InformationSignalMapPage() {
  return (
    <LedgerShell activeIndexId="information-signal">
      <LedgerPageJsonLd name={NAME} path={PATH} description={DESCRIPTION} />
      <InformationSignalMapView />
      <LedgerPageFooter />
    </LedgerShell>
  );
}
