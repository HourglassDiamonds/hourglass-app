import type { Metadata } from "next";
import { LedgerIndexPageContent } from "../components/ledger-index-page";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";
import SubscribeSection from "../components/subscribe-section";
import { getLedgerIndex } from "../ledger-data";

const index = getLedgerIndex("global-pressure");

export const metadata: Metadata = {
  title: index.seoTitle,
  description: index.seoDescription,
};

export default function GlobalPressureIndexPage() {
  return (
    <LedgerShell activeIndexId="global-pressure">
      <LedgerIndexPageContent index={index} />
      <LedgerPageFooter />
      <SubscribeSection className="ledger-subscribe-tight pb-16 md:pb-20" />
    </LedgerShell>
  );
}
