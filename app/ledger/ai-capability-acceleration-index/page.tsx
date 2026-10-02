import type { Metadata } from "next";
import AICapabilityAccelerationIndexView from "../components/ai-capability-acceleration-index-view";
import LedgerPageJsonLd from "../components/ledger-page-json-ld";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";
import { ledgerMetadata } from "../ledger-seo";

const NAME = "AI Capability Monitor";
const PATH = "/ledger/ai-capability-acceleration-index";
const DESCRIPTION =
  "A qualitative monitor of AI capability, deployment, enterprise friction, compute expansion, and physical infrastructure constraints.";

export const metadata: Metadata = ledgerMetadata({
  topic: NAME,
  path: PATH,
  description: DESCRIPTION,
});

export default function AICapabilityAccelerationIndexPage() {
  return (
    <LedgerShell activeIndexId="ai-capability">
      <LedgerPageJsonLd name={NAME} path={PATH} description={DESCRIPTION} />
      <AICapabilityAccelerationIndexView />
      <LedgerPageFooter />
    </LedgerShell>
  );
}
