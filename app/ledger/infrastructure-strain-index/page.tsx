import type { Metadata } from "next";
import InfrastructureStrainIndexView from "../components/infrastructure-strain-index-view";
import LedgerPageJsonLd from "../components/ledger-page-json-ld";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";
import { ledgerMetadata } from "../ledger-seo";
import { getCurrentLedgerPublication } from "@/lib/ledger-automation/current-publication";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NAME = "Infrastructure Strain Monitor";
const PATH = "/ledger/infrastructure-strain-index";
const DESCRIPTION =
  "Tracks strain across power grids, transmission, transformers, data centers, water and cooling, skilled labor, semiconductors, and logistics.";

export const metadata: Metadata = ledgerMetadata({
  topic: NAME,
  path: PATH,
  description: DESCRIPTION,
});

export default async function InfrastructureStrainIndexPage() {
  const publication = await getCurrentLedgerPublication();
  return (
    <LedgerShell activeIndexId="infrastructure-strain" publication={publication}>
      <LedgerPageJsonLd name={NAME} path={PATH} description={DESCRIPTION} />
      <InfrastructureStrainIndexView publication={publication} />
      <LedgerPageFooter />
    </LedgerShell>
  );
}
