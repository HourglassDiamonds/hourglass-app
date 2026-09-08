import Link from "next/link";
import { getAuthenticatedCandidateStore } from "@/lib/continuum/candidates/load";
import {
  latestGmailIntakeTurns,
  newProjectThreadIds,
  presentGmailNewProjectIntake,
} from "@/lib/continuum/client-memory/founder-project/intake-present";
import { loadGmailPersonWorldFromAdmin } from "@/lib/continuum/client-memory/founder-project/gmail-world";
import { isGmailIndexStale } from "@/lib/continuum/gmail/index-freshness";
import { snapshotFromIncrementalCheckpoint } from "@/lib/continuum/gmail/incremental";
import { readGmailCurrentState } from "@/lib/continuum/gmail/current-state";
import { isGmailIncrementalSyncEnabled } from "@/lib/continuum/gmail/env";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { CONCIERGE_GMAIL_PATH, GMAIL_INCREMENTAL_JOB_KEY } from "@/lib/continuum/gmail/types";
import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import { ConciergeShell } from "../../components/concierge-shell";
import { ConciergeUnavailable } from "../../components/client-profile-view";
import {
  GmailIntakeScanForm,
  GmailNewProjectIntakeList,
} from "../../components/gmail-new-project-intake";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gmail project intake",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeGmailIntakePage() {
  const auth = await getAuthenticatedCandidateStore();
  if (!auth.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Gmail intake unavailable."
          body="Sign in to review new-project proposals."
        />
      </ConciergeShell>
    );
  }
  let cards: ReturnType<typeof presentGmailNewProjectIntake> = [];
  let identityAvailable = false;
  let directory: Parameters<typeof presentGmailNewProjectIntake>[1] = [];
  const nowIso = new Date().toISOString();
  let indexForTurns: {
    listMessagesByThread(threadId: string): Promise<GmailIndexedMessage[]>;
  } | null = null;
  let freshness = {
    lastSuccessfulSyncAt: null as string | null,
    activationEnabled: isGmailIncrementalSyncEnabled(),
    stale: true,
    incremental: snapshotFromIncrementalCheckpoint(null),
  };
  try {
    const gmail = await getAuthenticatedGmailHistoryStores();
    if (gmail.ok) {
      indexForTurns = gmail.index;
      const current = await readGmailCurrentState(gmail.index);
      const incrementalRow = await gmail.index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY);
      freshness = {
        lastSuccessfulSyncAt: current.lastSuccessfulSyncAt,
        activationEnabled: isGmailIncrementalSyncEnabled(),
        stale: isGmailIndexStale(current.lastSuccessfulSyncAt, nowIso),
        incremental: snapshotFromIncrementalCheckpoint(incrementalRow),
      };
    }
  } catch {
    freshness = {
      ...freshness,
      stale: true,
    };
  }
  try {
    const loaded = await loadGmailPersonWorldFromAdmin();
    identityAvailable = loaded.peopleAvailable;
    directory = loaded.directory;
  } catch {
    identityAvailable = false;
    directory = [];
  }
  try {
    const rows = await auth.store.list();
    const turns = indexForTurns
      ? await latestGmailIntakeTurns(indexForTurns, newProjectThreadIds(rows))
      : [];
    cards = presentGmailNewProjectIntake(rows, directory, turns);
  } catch {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Gmail intake unavailable."
          body="Candidate storage could not be read."
        />
      </ConciergeShell>
    );
  }

  return (
    <ConciergeShell>
      <Link
        href={CONCIERGE_GMAIL_PATH}
        aria-label="Back to Gmail"
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.14em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← Gmail
      </Link>
      <div className="hg-concierge-fade mt-6">
        <h1 className="font-serif text-[1.95rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de] md:text-[2.15rem]">
          New project intake
        </h1>
        <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          Reads already-indexed Gmail threads transiently. Proposals are not
          Projects until you approve them. Mail bodies are not stored.
        </p>
        <GmailIntakeScanForm
          identityAvailable={identityAvailable}
          freshness={freshness}
        />
        <GmailNewProjectIntakeList
          cards={cards}
          identityAvailable={identityAvailable}
        />
      </div>
    </ConciergeShell>
  );
}
