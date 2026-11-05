import { notFound } from "next/navigation";
import { conciergePreviewAcceptanceEnabled } from "@/lib/continuum/concierge-funnel/preview-gate";
import { ConciergeBackLink } from "../components/concierge-back-link";
import { ConciergeShell } from "../components/concierge-shell";
import { AcceptanceControl } from "./acceptance-control";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Concierge acceptance",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function PreviewAcceptanceControlPage() {
  if (!conciergePreviewAcceptanceEnabled()) notFound();

  return (
    <ConciergeShell>
      <ConciergeBackLink />
      <div className="hg-concierge-fade mt-8">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[#a58d6d]">
          Preview acceptance
        </p>
        <h1 className="mt-3 font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          Concierge funnel
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[#c4b7aa]">
          Founder-operated, one-fixture verification. This page is unavailable
          unless both branch-scoped Preview flags are enabled.
        </p>
        <AcceptanceControl />
      </div>
    </ConciergeShell>
  );
}
