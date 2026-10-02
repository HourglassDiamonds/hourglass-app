import type { Metadata } from "next";
import PreciousMaterialsIndexView from "../components/precious-materials-index-view";
import LedgerPageJsonLd from "../components/ledger-page-json-ld";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";
import { ledgerMetadata } from "../ledger-seo";

const NAME = "Precious Materials Monitor";
const PATH = "/ledger/precious-materials-index";
const DESCRIPTION =
  "A qualitative monitor of gold, platinum, natural diamonds, jewelry demand, and the sourcing conditions shaping quality and availability.";

export const metadata: Metadata = ledgerMetadata({
  topic: NAME,
  path: PATH,
  description: DESCRIPTION,
});

export default function PreciousMaterialsIndexPage() {
  return (
    <LedgerShell activeIndexId="precious-materials">
      <LedgerPageJsonLd name={NAME} path={PATH} description={DESCRIPTION} />
      <PreciousMaterialsIndexView />
      <LedgerPageFooter />
    </LedgerShell>
  );
}
