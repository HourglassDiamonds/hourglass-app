import { CONCIERGE_HUB_PATH } from "@/lib/continuum/operating-shell/destinations";
import { ConciergeBackLink } from "../components/concierge-back-link";
import { ConciergeShell } from "../components/concierge-shell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Personal",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function ConciergePersonalPage() {
  return (
    <ConciergeShell variant="book">
      <ConciergeBackLink href={CONCIERGE_HUB_PATH} label="Home" />
      <div data-personal-home className="hg-concierge-fade mt-8">
        <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#efe8de]">
          Personal
        </h1>
        <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          Life, family and everything else.
        </p>
        <p className="mt-8 max-w-[36ch] text-[14px] leading-relaxed text-[#8d8073]">
          This book is not open yet.
        </p>
      </div>
    </ConciergeShell>
  );
}
