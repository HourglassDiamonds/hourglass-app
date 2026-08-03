import type { Metadata } from "next";
import PreciousMaterialsIndexView from "../components/precious-materials-index-view";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";

export const metadata: Metadata = {
  title: "Precious Materials Monitor",
  description:
    "Hourglass Ledger Precious Materials Monitor — qualitative market states for metals, diamonds, and jewelry demand in fine jewelry sourcing.",
  alternates: {
    canonical: "/ledger/precious-materials-index",
  },
  openGraph: {
    url: "/ledger/precious-materials-index",
  },
};

export default function PreciousMaterialsIndexPage() {
  return (
    <LedgerShell activeIndexId="precious-materials">
      <PreciousMaterialsIndexView />
      <LedgerPageFooter />
    </LedgerShell>
  );
}
