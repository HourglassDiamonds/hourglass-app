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
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.14em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← Continuum
      </Link>
      <div className="hg-concierge-fade mt-6">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#8d8073]">My Card</p>
        <h1 className="mt-3 font-serif text-[1.95rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de] md:text-[2.15rem]">
          Share your Continuum card
        </h1>
        <p className="mt-3 max-w-[22.5rem] text-[15px] leading-relaxed text-[#c4b7aa]">
          A simple way to exchange your details and stay connected.
        </p>
        {!loaded.ok && loaded.reason === "unavailable" ? (
          <p className="mt-8 text-[15px] leading-relaxed text-[#c4b7aa]">
            The card is unavailable right now.
          </p>
        ) : (
          <div className="mt-7">
            <MyCardForm card={card} publicUrl={publicUrl} />
          </div>
        )}
      </div>
    </ConciergeShell>
  );
}
