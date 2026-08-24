import Link from "next/link";
import { LEDGER_HUB_INDEXES } from "../ledger-data";

const HUB_METHOD_NOTICE =
  "Individual monitors are qualitative. They use states, direction, documented evidence, and defined change triggers. System Temperature, published on the Ledger hub, is the only composite numerical reading.";

function hubCardKind(id: string): string {
  if (id === "information-signal") return "Map";
  return "Monitor";
}

function hubCardCta(id: string): string {
  if (id === "information-signal") return "View map →";
  return "View monitor →";
}

export default function LedgerIndexesSection() {
  return (
    <section
      className="border-b border-[#e4dbcf] py-16 md:py-20"
      aria-labelledby="ledger-indexes-heading"
    >
      <div className="mx-auto max-w-[920px]">
        <p className="font-sans text-[10px] uppercase tracking-[0.32em] text-[#6d655e]">
          Monitors
        </p>
        <h2
          id="ledger-indexes-heading"
          className="mt-3 font-serif text-[1.4rem] font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.55rem]"
        >
          The Ledger monitoring system
        </h2>
        <p className="mt-4 max-w-[36rem] text-[0.95rem] leading-[1.85] text-[#6f6760]">
          Six Ledger surfaces — clarifying pressure, narrative, capability,
          material conditions, physical infrastructure, and water through qualitative
          states, direction, documented evidence, and defined change triggers.
        </p>
        <p className="ledger-hub-method-notice" role="note">
          {HUB_METHOD_NOTICE}
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {LEDGER_HUB_INDEXES.map((index) => (
            <Link
              key={index.id}
              href={`/ledger/${index.slug}`}
              className="group block rounded-[14px] border border-[#e4dbcf] bg-[#faf7f2]/50 p-6 transition-colors hover:border-[#d4c9bb] hover:bg-[#faf7f2]/80 md:p-7"
            >
              <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-[#6d655e] group-hover:text-[#6f6760]">
                {hubCardKind(index.id)}
              </p>
              <h3 className="mt-2 font-serif text-[1.15rem] font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.2rem]">
                {index.displayTitle}
              </h3>
              <p className="mt-2 font-sans text-[10px] uppercase tracking-[0.14em] text-[#6d655e]">
                {index.status}
              </p>
              <p className="mt-3 text-[0.9rem] leading-[1.8] text-[#6f6760]">
                {index.hubDescription}
              </p>
              <span className="mt-4 inline-block font-sans text-[10px] uppercase tracking-[0.2em] text-[#6d655e] group-hover:text-[#4a4540]">
                {hubCardCta(index.id)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
