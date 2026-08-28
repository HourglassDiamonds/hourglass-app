import Link from "next/link";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import { GMAIL_HISTORICAL_JOB_KEY } from "@/lib/continuum/gmail/types";
import { snapshotFromCheckpoint } from "@/lib/continuum/gmail/history";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { ConciergeShell } from "../components/concierge-shell";
import { GmailConnectionTestForm } from "../components/gmail-connection-test";
import { GmailHistoryForm } from "../components/gmail-history";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gmail",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeGmailPage() {
  const auth = await getAuthenticatedGmailHistoryStores();
  let connected = false;
  let history = snapshotFromCheckpoint(null);
  if (auth.ok) {
    const row = await auth.connections.getFounderConnection();
    connected = Boolean(row && row.status === "connected" && row.refreshToken);
    const checkpoint = await auth.index.getCheckpoint(GMAIL_HISTORICAL_JOB_KEY);
    history = snapshotFromCheckpoint(checkpoint);
  }

  return (
    <ConciergeShell>
      <Link
        href={CONCIERGE_HOME_PATH}
        aria-label="Back to Continuum"
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.14em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← Continuum
      </Link>
      <div className="hg-concierge-fade mt-6">
        <h1 className="font-serif text-[1.95rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de] md:text-[2.15rem]">
          Gmail
        </h1>
        <GmailConnectionTestForm connected={connected} />
        <GmailHistoryForm initial={history} />
      </div>
    </ConciergeShell>
  );
}
