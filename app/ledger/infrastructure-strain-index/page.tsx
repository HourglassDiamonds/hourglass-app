import type { Metadata } from "next";
import InfrastructureStrainIndexView from "../components/infrastructure-strain-index-view";
import LedgerPageJsonLd from "../components/ledger-page-json-ld";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";
import { ledgerMetadata } from "../ledger-seo";

const NAME = "Infrastructure Strain Monitor";
const PATH = "/ledger/infrastructure-strain-index";
const DESCRIPTION =
  "Tracks strain across power grids, transmission, transformers, data centers, water and cooling, skilled labor, semiconductors, and logistics.";

export const metadata: Metadata = ledgerMetadata({
  topic: NAME,
  path: PATH,
  description: DESCRIPTION,
});

export default function InfrastructureStrainIndexPage() {
  return (
    <LedgerShell activeIndexId="infrastructure-strain">
      <LedgerPageJsonLd name={NAME} path={PATH} description={DESCRIPTION} />
      <InfrastructureStrainIndexView />
      <LedgerPageFooter />
    </LedgerShell>
  );
}
