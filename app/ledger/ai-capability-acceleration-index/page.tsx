import type { Metadata } from "next";
import AICapabilityAccelerationIndexView from "../components/ai-capability-acceleration-index-view";
import LedgerPageJsonLd from "../components/ledger-page-json-ld";
import LedgerPageFooter from "../components/ledger-page-footer";
import LedgerShell from "../components/ledger-shell";
import { ledgerMetadata } from "../ledger-seo";
import { getCurrentLedgerPublication } from "@/lib/ledger-automation/current-publication";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NAME = "AI Capability Monitor";
const PATH = "/ledger/ai-capability-acceleration-index";
const DESCRIPTION =
  "A qualitative monitor of AI capability, deployment, enterprise friction, compute expansion, and physical infrastructure constraints.";

export const metadata: Metadata = ledgerMetadata({
  topic: NAME,
  path: PATH,
  description: DESCRIPTION,
});

export default async function AICapabilityAccelerationIndexPage() {
  const publication = await getCurrentLedgerPublication();
  return (
    <LedgerShell activeIndexId="ai-capability" publication={publication}>
      <LedgerPageJsonLd name={NAME} path={PATH} description={DESCRIPTION} />
      <AICapabilityAccelerationIndexView publication={publication} />
      <LedgerPageFooter />
    </LedgerShell>
  );
}
