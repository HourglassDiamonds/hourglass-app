import Link from "next/link";
import { getAuthenticatedHumanSourceStore } from "@/lib/continuum/client-memory/human-intake/load";
import { composeInboxViews } from "@/lib/continuum/client-memory/human-intake";
import {
  conciergeInboxNewPath,
} from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeShell } from "../components/concierge-shell";
import { ConciergeUnavailable } from "../components/client-profile-view";
import { InboxSourceList } from "../components/inbox-source-list";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inbox",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeInboxPage() {
  const auth = await getAuthenticatedHumanSourceStore();
  if (!auth.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Inbox unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  let items: Awaited<ReturnType<typeof composeInboxViews>>;
  try {
    items = await composeInboxViews(auth.store);
  } catch {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Inbox unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  return (
    <ConciergeShell>
      <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
        Inbox
      </h1>
      <div className="mt-6">
        <Link
          href={conciergeInboxNewPath()}
          className="inline-flex min-h-12 items-center text-[11px] uppercase tracking-[0.24em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164]"
        >
          Add PLAUD source
        </Link>
      </div>
      <div className="mt-8">
        <InboxSourceList items={items} />
      </div>
    </ConciergeShell>
  );
}
