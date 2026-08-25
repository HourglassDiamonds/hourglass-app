import Link from "next/link";
import { getAuthenticatedHumanSourceStore } from "@/lib/continuum/client-memory/human-intake/load";
import { composeSourceDetail } from "@/lib/continuum/client-memory/human-intake";
import {
  conciergeInboxPath,
  isPersonIdParam,
} from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeShell } from "../../components/concierge-shell";
import { ConciergeUnavailable } from "../../components/client-profile-view";
import { HumanSourceDetail } from "../../components/human-source-detail";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Source",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeInboxSourcePage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  const { sourceId } = await params;
  if (!isPersonIdParam(sourceId)) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Source unavailable."
          body="This source could not be found."
        />
      </ConciergeShell>
    );
  }

  const auth = await getAuthenticatedHumanSourceStore();
  if (!auth.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Source unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  let detail: Awaited<ReturnType<typeof composeSourceDetail>>;
  try {
    detail = await composeSourceDetail(auth.store, sourceId);
  } catch {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Source unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  if (!detail) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Source unavailable."
          body="This source could not be found."
        />
      </ConciergeShell>
    );
  }

  return (
    <ConciergeShell>
      <Link
        href={conciergeInboxPath()}
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← Inbox
      </Link>
      <div className="hg-concierge-fade mt-8">
        <HumanSourceDetail detail={detail} />
      </div>
    </ConciergeShell>
  );
}
