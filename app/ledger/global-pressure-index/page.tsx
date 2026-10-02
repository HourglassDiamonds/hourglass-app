import type { Metadata } from "next";
import { LedgerIndexPageContent } from "../components/ledger-index-page";
import LedgerPageJsonLd from "../components/ledger-page-json-ld";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";
import { getLedgerIndex } from "../ledger-data";
import { ledgerMetadata } from "../ledger-seo";

const index = getLedgerIndex("global-pressure");

const PATH = `/ledger/${index.slug}`;

export const metadata: Metadata = ledgerMetadata({
  topic: index.seoTitle,
  path: PATH,
  description: index.seoDescription,
});

export default function GlobalPressureIndexPage() {
  return (
    <LedgerShell activeIndexId="global-pressure">
      <LedgerPageJsonLd
        name={index.displayTitle}
        path={PATH}
        description={index.seoDescription}
      />
      <LedgerIndexPageContent index={index} />
      <LedgerPageFooter />
    </LedgerShell>
  );
}
