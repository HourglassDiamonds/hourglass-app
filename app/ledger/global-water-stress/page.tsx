import type { Metadata } from "next";
import GlobalWaterStressView from "../components/global-water-stress-view";
import LedgerPageJsonLd from "../components/ledger-page-json-ld";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";
import { ledgerMetadata } from "../ledger-seo";

const NAME = "Global Water Stress Monitor";
const PATH = "/ledger/global-water-stress";
const DESCRIPTION =
  "A qualitative monitor of rivers, reservoirs, municipal supply, agriculture, energy transmission, and water policy across worsening and improving regions.";

export const metadata: Metadata = ledgerMetadata({
  topic: NAME,
  path: PATH,
  description: DESCRIPTION,
});

export default function GlobalWaterStressPage() {
  return (
    <LedgerShell activeIndexId="global-water-stress">
      <LedgerPageJsonLd name={NAME} path={PATH} description={DESCRIPTION} />
      <GlobalWaterStressView />
      <LedgerPageFooter />
    </LedgerShell>
  );
}
