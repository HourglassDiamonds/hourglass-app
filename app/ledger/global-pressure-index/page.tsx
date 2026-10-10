import type { Metadata } from "next";
import { LedgerIndexPageContent } from "../components/ledger-index-page";
import LedgerPageJsonLd from "../components/ledger-page-json-ld";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";
import { getLedgerIndex } from "../ledger-data";
import { ledgerMetadata } from "../ledger-seo";
import { getCurrentLedgerPublication } from "@/lib/ledger-automation/current-publication";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const index = getLedgerIndex("global-pressure");

const PATH = `/ledger/${index.slug}`;

export const metadata: Metadata = ledgerMetadata({
  topic: index.seoTitle,
  path: PATH,
  description: index.seoDescription,
});

export default async function GlobalPressureIndexPage() {
  const publication = await getCurrentLedgerPublication();
  return (
    <LedgerShell activeIndexId="global-pressure" publication={publication}>
      <LedgerPageJsonLd
        name={index.displayTitle}
        path={PATH}
        description={index.seoDescription}
      />
      <LedgerIndexPageContent index={index} publication={publication} />
      <LedgerPageFooter />
    </LedgerShell>
  );
}
