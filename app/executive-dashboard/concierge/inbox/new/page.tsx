import Link from "next/link";
import { conciergeInboxPath } from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeShell } from "../../components/concierge-shell";
import { AddPlaudForm } from "../../components/add-plaud-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Add PLAUD source",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function ConciergeInboxNewPage() {
  return (
    <ConciergeShell>
      <Link
        href={conciergeInboxPath()}
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← Inbox
      </Link>
      <div className="hg-concierge-fade mt-8">
        <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          PLAUD
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[#c4b7aa]">
          Save a transcript or recap. Nothing here becomes memory until a later
          review.
        </p>
        <div className="mt-8">
          <AddPlaudForm />
        </div>
      </div>
    </ConciergeShell>
  );
}
