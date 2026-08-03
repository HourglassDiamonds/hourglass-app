import type { Metadata } from "next";
import AICapabilityAccelerationIndexView from "../components/ai-capability-acceleration-index-view";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";

export const metadata: Metadata = {
  title: "AI Capability Monitor",
  description:
    "Hourglass Ledger AI Capability Monitor — qualitative tracking of AI buildout across capability, enterprise friction, and physical infrastructure constraints.",
  alternates: {
    canonical: "/ledger/ai-capability-acceleration-index",
  },
  openGraph: {
    url: "/ledger/ai-capability-acceleration-index",
  },
};

export default function AICapabilityAccelerationIndexPage() {
  return (
    <LedgerShell activeIndexId="ai-capability">
      <AICapabilityAccelerationIndexView />
      <LedgerPageFooter />
    </LedgerShell>
  );
}
