import Link from "next/link";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeSearch } from "../../components/concierge-search";
import { ConciergeShell } from "../../components/concierge-shell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Add Note",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function ConciergeAddNotePickerPage() {
  return (
    <ConciergeShell variant="document">
      <Link
        href={CONCIERGE_HOME_PATH}
        aria-label="Back to Continuum"
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← Continuum
      </Link>
      <div className="hg-concierge-fade mt-8">
        <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          Add Note
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#c4b7aa]">
          Who is this about?
        </p>
        <div className="mt-8">
          <ConciergeSearch autoFocus intent="add-note" />
        </div>
      </div>
    </ConciergeShell>
  );
}
