import { randomUUID } from "node:crypto";
import Link from "next/link";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeShell } from "../../components/concierge-shell";
import { AddClientForm } from "../../components/add-client-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Add Client",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function ConciergeAddClientPage() {
  return (
    <ConciergeShell>
      <Link
        href={CONCIERGE_HOME_PATH}
        aria-label="Back to Continuum"
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← Continuum
      </Link>
      <div className="hg-concierge-fade mt-8">
        <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          Add client
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#c4b7aa]">
          Remember someone Continuum does not have yet.
        </p>
        <div className="mt-8">
          <AddClientForm submissionId={randomUUID()} />
        </div>
      </div>
    </ConciergeShell>
  );
}
