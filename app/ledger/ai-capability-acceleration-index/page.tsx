import type { Metadata } from "next";
import AICapabilityAccelerationIndexView from "../components/ai-capability-acceleration-index-view";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";
import SubscribeSection from "../components/subscribe-section";

export const metadata: Metadata = {
  title: "AI Capability Acceleration Index",
  description:
    "Hourglass Ledger AI Capability Acceleration Index — deployment-bound AI buildout across capability, enterprise friction, and physical infrastructure constraints.",
};

export default function AICapabilityAccelerationIndexPage() {
  return (
    <LedgerShell activeIndexId="ai-capability">
      <AICapabilityAccelerationIndexView />
      <LedgerPageFooter />
      <SubscribeSection className="ledger-subscribe-tight pb-16 md:pb-20" />
    </LedgerShell>
  );
}
