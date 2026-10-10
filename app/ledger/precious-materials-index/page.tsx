import type { Metadata } from "next";
import PreciousMaterialsIndexView from "../components/precious-materials-index-view";
import LedgerPageJsonLd from "../components/ledger-page-json-ld";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";
import { ledgerMetadata } from "../ledger-seo";
import { getCurrentLedgerPublication } from "@/lib/ledger-automation/current-publication";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NAME = "Precious Materials Monitor";
const PATH = "/ledger/precious-materials-index";
const DESCRIPTION =
  "A qualitative monitor of gold, platinum, natural diamonds, jewelry demand, and the sourcing conditions shaping quality and availability.";

export const metadata: Metadata = ledgerMetadata({
  topic: NAME,
  path: PATH,
  description: DESCRIPTION,
});

export default async function PreciousMaterialsIndexPage() {
  const publication = await getCurrentLedgerPublication();
  return (
    <LedgerShell activeIndexId="precious-materials" publication={publication}>
      <LedgerPageJsonLd name={NAME} path={PATH} description={DESCRIPTION} />
      <PreciousMaterialsIndexView publication={publication} />
      <LedgerPageFooter />
    </LedgerShell>
  );
}
