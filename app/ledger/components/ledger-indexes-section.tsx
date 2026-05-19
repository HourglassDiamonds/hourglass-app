import Link from "next/link";
import { LEDGER_HUB_INDEXES } from "../ledger-data";

export default function LedgerIndexesSection() {
  return (
    <section
      className="border-b border-[#e4dbcf] py-16 md:py-20"
      aria-labelledby="ledger-indexes-heading"
    >
      <div className="mx-auto max-w-[920px]">
        <p className="font-sans text-[10px] uppercase tracking-[0.32em] text-[#8a8176]">
          Indexes
        </p>
        <h2
          id="ledger-indexes-heading"
          className="mt-3 font-serif text-[1.4rem] font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.55rem]"
        >
          The Ledger index system
        </h2>
        <p className="mt-4 max-w-[36rem] text-[0.95rem] leading-[1.85] text-[#6f6760]">
          Five weekly readings — each designed to clarify a different layer of
          pressure, narrative, capability, material conditions, and physical
          infrastructure.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {LEDGER_HUB_INDEXES.map((index) => (
            <Link
              key={index.id}
              href={`/ledger/${index.slug}`}
              className="group block rounded-[14px] border border-[#e4dbcf] bg-[#faf7f2]/50 p-6 transition-colors hover:border-[#d4c9bb] hover:bg-[#faf7f2]/80 md:p-7"
            >
              <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-[#8a8176] group-hover:text-[#6f6760]">
                Index
              </p>
              <h3 className="mt-2 font-serif text-[1.15rem] font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.2rem]">
                {index.displayTitle}
              </h3>
              <p className="mt-3 text-[0.9rem] leading-[1.8] text-[#6f6760]">
                {index.hubDescription}
              </p>
              <span className="mt-4 inline-block font-sans text-[10px] uppercase tracking-[0.2em] text-[#8a8176] group-hover:text-[#4a4540]">
                View index →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

