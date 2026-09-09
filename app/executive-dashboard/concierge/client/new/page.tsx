import { randomUUID } from "node:crypto";
import { ConciergeBackLink } from "../../components/concierge-back-link";
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
      <ConciergeBackLink />
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
