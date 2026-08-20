import type { Metadata } from "next";
import GlobalWaterStressView from "../components/global-water-stress-view";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";

export const metadata: Metadata = {
  title: "Global Water Stress Monitor",
  description:
    "Hourglass Ledger Global Water Stress Monitor — qualitative reading of rivers, reservoirs, municipal supply, agriculture, energy transmission, and policy/security, including both worsening and improving regions.",
  alternates: {
    canonical: "/ledger/global-water-stress",
  },
  openGraph: {
    url: "/ledger/global-water-stress",
  },
};

export default function GlobalWaterStressPage() {
  return (
    <LedgerShell activeIndexId="global-water-stress">
      <GlobalWaterStressView />
      <LedgerPageFooter />
    </LedgerShell>
  );
}
