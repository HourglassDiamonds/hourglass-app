import type { LedgerIndexDefinition } from "../ledger-data";
import "../global-pressure-index.css";
import GlobalPressureMonitor from "./global-pressure-monitor";
import LedgerIndexBreadcrumb from "./ledger-index-breadcrumb";
import { LEDGER_INDEX_PAGE_CLASS } from "./ledger-index-page-chrome";

type LedgerIndexPageContentProps = {
  index: LedgerIndexDefinition;
};

export function LedgerIndexPageContent({ index }: LedgerIndexPageContentProps) {
  const isGpi = index.id === "global-pressure";

  if (isGpi) {
    return (
      <section className={`ledger-index-page ledger-gpi ${LEDGER_INDEX_PAGE_CLASS}`}>
        <LedgerIndexBreadcrumb current={index.displayTitle} />
        <GlobalPressureMonitor variant="full" />
      </section>
    );
  }

  // Public non-GPI monitors use dedicated qualitative views from their route
  // pages. Do not fall back to LedgerIndexMeter (archived numerical UI).
  throw new Error(
    `LedgerIndexPageContent no longer renders numerical meters for "${index.id}". Use the dedicated qualitative monitor view.`,
  );
}
