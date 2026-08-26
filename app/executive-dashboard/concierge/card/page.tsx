import Link from "next/link";
import { headers } from "next/headers";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import { loadOwnerDigitalCard } from "@/lib/continuum/digital-card/load";
import { publicCardAbsoluteUrl } from "@/lib/continuum/digital-card/origin";
import { ConciergeShell } from "../components/concierge-shell";
import { MyCardForm } from "../components/my-card-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Card",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeMyCardPage() {
  const loaded = await loadOwnerDigitalCard();
  const card = loaded.ok ? loaded.card : null;
  const headerList = await headers();
  const publicUrl = card ? publicCardAbsoluteUrl(card.slug, headerList) : null;

  return (
    <ConciergeShell>
      <Link
        href={CONCIERGE_HOME_PATH}
        aria-label="Back to Continuum"
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ??? Continuum
      </Link>
      <div className="hg-concierge-fade mt-8">
        <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          My card
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#c4b7aa]">
          A quiet public profile. The QR opens Continuum ??? it does not contain
          your contact data.
        </p>
        {!loaded.ok && loaded.reason === "unavailable" ? (
          <p className="mt-8 text-[15px] leading-relaxed text-[#c4b7aa]">
            The card is unavailable right now.
          </p>
        ) : (
          <div className="mt-8">
            <MyCardForm card={card} publicUrl={publicUrl} />
          </div>
        )}
      </div>
    </ConciergeShell>
  );
}
