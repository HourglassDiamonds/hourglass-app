import type { Metadata } from "next";
import BufferHealthView from "../components/buffer-health-view";
import LedgerHistoryComparison from "../components/ledger-history-comparison";
import LedgerPageJsonLd from "../components/ledger-page-json-ld";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";
import { buildLedgerHistoricalComparisons } from "../historical-comparison";
import { ledgerMetadata } from "../ledger-seo";

const NAME = "Buffer Health / Remaining Slack";
const PATH = "/ledger/buffer-health";
const DESCRIPTION =
  "A qualitative framework for remaining slack across households, labor, food, energy, the power grid, and the financial system.";

export const metadata: Metadata = ledgerMetadata({
  topic: NAME,
  path: PATH,
  description: DESCRIPTION,
});

export default function BufferHealthPage() {
  const historicalComparisons = buildLedgerHistoricalComparisons();

  return (
    <LedgerShell activeIndexId="buffer-health">
      <LedgerPageJsonLd name={NAME} path={PATH} description={DESCRIPTION} />
      <BufferHealthView />
      <LedgerHistoryComparison comparisons={historicalComparisons} />
      <LedgerPageFooter />
    </LedgerShell>
  );
}
