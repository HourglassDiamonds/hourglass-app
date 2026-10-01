import type { Metadata } from "next";
import BufferHealthView from "../components/buffer-health-view";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";

export const metadata: Metadata = {
  title: "Buffer Health / Remaining Slack",
  description:
    "Hourglass Ledger Buffer Health — a qualitative framework for remaining slack across households, labor, food, energy, grid, and the financial system.",
  alternates: { canonical: "/ledger/buffer-health" },
  openGraph: { url: "/ledger/buffer-health" },
};

export default function BufferHealthPage() {
  return (
    <LedgerShell activeIndexId="buffer-health">
      <BufferHealthView />
      <LedgerPageFooter />
    </LedgerShell>
  );
}
