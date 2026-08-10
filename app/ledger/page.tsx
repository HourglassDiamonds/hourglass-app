import type { Metadata } from "next";
import Link from "next/link";
import GlobalPressureMeter from "./components/global-pressure-meter";
import LedgerIndexesSection from "./components/ledger-indexes-section";
import LedgerShell from "./components/ledger-shell";
import WeeklySynopsis from "./components/weekly-synopsis";
import { QUIET_METRICS, TRACK_TOPICS } from "./constants";

export const metadata: Metadata = {
  title: "Hourglass Ledger — Calm intelligence for a volatile world",
  description:
    "The Ledger: a weekly signal brief on markets, infrastructure, energy, AI, commodities, and global systems from Hourglass Diamonds.",
  alternates: {
    canonical: "/ledger",
  },
  openGraph: {
    url: "/ledger",
  },
};

const LEDGER_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Hourglass Ledger",
  alternateName: "The Ledger",
  description:
    "Weekly intelligence on markets, infrastructure, AI, energy, and global systems.",
  publisher: {
    "@type": "Organization",
    name: "Hourglass Diamonds",
  },
};

export default function LedgerPage() {
  return (
    <LedgerShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(LEDGER_JSON_LD) }}
      />

      {/* Hero */}
      <section className="border-b border-[#e4dbcf] pb-20 pt-14 md:pb-24 md:pt-20">
        <div className="mx-auto max-w-[720px] text-center">
          <p className="text-[10px] uppercase tracking-[0.34em] text-[#6d655e]">
            The Ledger
          </p>
          <h1
            className="mx-auto mt-4 max-w-[20ch] font-serif text-[1.75rem] font-normal leading-[1.1] tracking-[-0.02em] text-[#1f1d1a] md:text-[2.35rem]"
            style={{ textWrap: "balance" }}
          >
            Calm intelligence for a volatile world.
          </h1>
          <p className="mx-auto mt-6 max-w-[40rem] text-[0.98rem] leading-[1.9] text-[#615a53]">
            A weekly signal brief on markets, infrastructure, energy, AI,
            commodities, and global systems — designed to clarify pressure
            without amplifying noise.
          </p>
          <div className="mt-10 flex justify-center">
            <Link
              href="/ledger/global-pressure-index"
              className="inline-block rounded-sm border border-[#3a3632] bg-[#2f2b27] px-7 py-3.5 text-[10px] uppercase tracking-[0.28em] text-[#faf7f2] transition-colors hover:bg-[#1f1d1a]"
            >
              Read the Latest Brief
            </Link>
          </div>
        </div>
      </section>

      {/* Context */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-[720px]">
          <p className="text-[10px] uppercase tracking-[0.34em] text-[#6d655e]">
            Why this belongs here
          </p>
          <div className="mt-6 space-y-5 text-[0.95rem] leading-[1.85] text-[#615a53]">
            <p>
              Diamonds do not exist outside the world. They move through energy
              markets, shipping routes, currency pressure, mining regions,
              laboratory capacity, insurance, credit, and consumer confidence
              before they ever reach a ring box.
            </p>
            <p>
              The Ledger is our weekly reading of those pressure systems. It is
              not financial advice, political commentary, or a prediction
              engine. It is a calm way to understand the conditions shaping rare
              materials, global sourcing, and the decisions clients may face when
              timing a meaningful purchase.
            </p>
          </div>
        </div>
      </section>

      <LedgerIndexesSection />

      {/* Current reading — compact GPI + weekly synopsis */}
      <section className="border-b border-[#e4dbcf] py-16 md:py-20">
        <GlobalPressureMeter variant="compact" />
        <WeeklySynopsis />
      </section>

      {/* Quiet metrics */}
      <section className="border-b border-[#e4dbcf] py-16 md:py-20">
        <div className="grid gap-4 md:grid-cols-3">
          {QUIET_METRICS.map((metric) => (
            <article
              key={metric.label}
              className="rounded-sm border border-[#e4dbcf] bg-[#faf7f2]/40 p-6 md:p-7"
            >
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#6d655e]">
                {metric.label}
              </p>
              <p className="mt-3 font-serif text-[1.35rem] font-normal tracking-[-0.02em] text-[#1f1d1a]">
                {metric.value}
              </p>
              <p className="mt-3 text-[0.88rem] leading-[1.8] text-[#6f6760]">
                {metric.note}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* What we track */}
      <section className="py-16 md:py-20">
        <div className="mb-10 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#6d655e]">
            What we track
          </p>
          <h2 className="mt-3 font-serif text-[1.4rem] font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.55rem]">
            Systems that shape pressure
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRACK_TOPICS.map((topic) => (
            <article
              key={topic.title}
              className="rounded-sm border border-[#e4dbcf] bg-[#faf7f2]/30 p-6"
            >
              <h3 className="font-serif text-[1.1rem] font-normal tracking-[-0.02em] text-[#1f1d1a]">
                {topic.title}
              </h3>
              <p className="mt-3 text-[0.88rem] leading-[1.8] text-[#6f6760]">
                {topic.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </LedgerShell>
  );
}
