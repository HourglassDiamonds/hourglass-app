import Link from "next/link";
import { conciergeInboxPath } from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeShell } from "../../components/concierge-shell";
import { AddRemarkableForm } from "../../components/add-remarkable-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Add reMarkable source",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function ConciergeInboxRemarkablePage() {
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
          reMarkable
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[#c4b7aa]">
          Upload a PDF, PNG, or JPEG export. This is a founder upload, not
          account sync. The file is stored first. Candidates come only from
          associated text you paste — V1 does not OCR handwriting.
        </p>
        <div className="mt-8">
          <AddRemarkableForm />
        </div>
      </div>
    </ConciergeShell>
  );
}
