import Link from "next/link";
import { getAuthenticatedCandidateStore } from "@/lib/continuum/candidates/load";
import { presentGmailNewProjectIntake } from "@/lib/continuum/client-memory/founder-project/intake-present";
import { CONCIERGE_GMAIL_PATH } from "@/lib/continuum/gmail/types";
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
  try {
    cards = presentGmailNewProjectIntake(await auth.store.list());
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
        <GmailIntakeScanForm />
        <GmailNewProjectIntakeList cards={cards} />
      </div>
    </ConciergeShell>
  );
}
