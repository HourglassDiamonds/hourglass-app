import Link from "next/link";
import { ConciergeBackLink } from "../components/concierge-back-link";
import { ConciergeShell } from "../components/concierge-shell";
import { gmailCurrentStatePublicView, readGmailCurrentState } from "@/lib/continuum/gmail/current-state";
import { isGmailIncrementalSyncEnabled } from "@/lib/continuum/gmail/env";
import { snapshotFromCheckpoint } from "@/lib/continuum/gmail/history";
import { snapshotFromIncrementalCheckpoint } from "@/lib/continuum/gmail/incremental";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import {
  GMAIL_HISTORICAL_JOB_KEY,
  GMAIL_INCREMENTAL_JOB_KEY,
} from "@/lib/continuum/gmail/types";
import { GmailConnectionTestForm } from "../components/gmail-connection-test";
import { GmailHistoryForm } from "../components/gmail-history";
import { GmailIncrementalForm } from "../components/gmail-incremental";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gmail",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeGmailPage() {
  const auth = await getAuthenticatedGmailHistoryStores();
  let connected = false;
  let history = snapshotFromCheckpoint(null);
  let incremental = snapshotFromIncrementalCheckpoint(null);
  let publicState = {
    ...gmailCurrentStatePublicView({
      latestInbound: null,
      latestOutbound: null,
      lastSuccessfulSyncAt: null,
      hasNewerIndexedActivity: false,
    }),
    activationEnabled: isGmailIncrementalSyncEnabled(),
  };
  if (auth.ok) {
    const row = await auth.connections.getFounderConnection();
    connected = Boolean(row && row.status === "connected" && row.refreshToken);
    const checkpoint = await auth.index.getCheckpoint(GMAIL_HISTORICAL_JOB_KEY);
    history = snapshotFromCheckpoint(checkpoint);
    const incrementalRow = await auth.index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY);
    incremental = snapshotFromIncrementalCheckpoint(incrementalRow);
    const current = await readGmailCurrentState(
      auth.index,
      incrementalRow?.windowEnd ?? incrementalRow?.updatedAt,
    );
    publicState = {
      ...gmailCurrentStatePublicView(current),
      activationEnabled: isGmailIncrementalSyncEnabled(),
    };
  }

  return (
    <ConciergeShell>
      <ConciergeBackLink />
      <div className="hg-concierge-fade mt-6">
        <h1 className="font-serif text-[1.95rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de] md:text-[2.15rem]">
          Gmail
        </h1>
        <GmailConnectionTestForm connected={connected} />
        <GmailHistoryForm initial={history} />
        <GmailIncrementalForm initial={incremental} publicState={publicState} />
        <Link
          href="/executive-dashboard/concierge/gmail/intake"
          className="mt-8 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.14em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
        >
          New project intake
        </Link>
        <Link
          href="/executive-dashboard/concierge/gmail/candidates"
          className="mt-4 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.14em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
        >
          Candidate contract (dev)
        </Link>
      </div>
    </ConciergeShell>
  );
}
