import Link from "next/link";
import ConsultationCtaLink from "./ConsultationCtaLink";

/* 44px-tall link rows (WCAG 2.5.8 target-size best practice) — the text
   stays small and quiet; the interactive row grows, not the type. */
const NAV_LINK = "inline-flex min-h-11 items-center hover:text-[#1f1d1a]";
const LEGAL_LINK = "inline-flex min-h-11 items-center hover:text-[#1f1d1a]";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-hg-line">
      <div className="mx-auto max-w-[1200px] px-6 py-10 md:px-10 md:py-12">
        
        {/* Top row */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
          
          <div className="text-[10px] uppercase tracking-[0.30em] text-[#746c62]">
            Hourglass Diamonds
          </div>

          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-5 text-[12px] text-[#625b54] md:gap-x-4"
          >
            <Link href="/the-house" className={NAV_LINK}>The House</Link>
            <Link href="/our-approach" className={NAV_LINK}>Our Approach</Link>
            <Link href="/conversations" className={NAV_LINK}>
              Conversations
            </Link>
            <Link href="/engagement-rings" className={NAV_LINK}>Engagement Rings</Link>
            <Link href="/custom-design" className={NAV_LINK}>Custom Design</Link>
            <Link href="/diamond-guide" className={NAV_LINK}>Diamond Guide</Link>
            <Link href="/diamond-studio" className={NAV_LINK}>Diamond Studio</Link>
            <ConsultationCtaLink
              location="footer:nav_concierge"
              className={NAV_LINK}
            >
              Concierge
            </ConsultationCtaLink>
          </nav>

        </div>

        {/* The Ledger — quiet editorial module */}
        <div className="mt-10 grid gap-8 border-t border-hg-line/70 pt-10 md:grid-cols-2 md:gap-12">
          <div className="max-w-[28rem]">
            <p className="text-[10px] uppercase tracking-[0.32em] text-hg-eyebrow">
              The Ledger
            </p>
            <p className="mt-3 text-[12px] leading-[1.75] text-[#7a7268]">
              Weekly intelligence on markets, infrastructure, AI, energy, and
              global systems.
            </p>
            <Link
              href="/ledger"
              className="mt-2 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.26em] text-[#625b54] transition-colors hover:text-[#1f1d1a]"
            >
              Explore the Ledger
            </Link>
          </div>
          <div className="max-w-[28rem]">
            <p className="text-[10px] uppercase tracking-[0.32em] text-hg-eyebrow">
              Whispered Praise
            </p>
            <p className="mt-3 text-[12px] leading-[1.75] text-[#7a7268]">
              Quiet reflections from clients who trusted the process.
            </p>
            <Link
              href="/whispered-praise"
              className="mt-2 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.26em] text-[#625b54] transition-colors hover:text-[#1f1d1a]"
            >
              Read Whispered Praise
            </Link>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-8 flex flex-col gap-2 border-t border-hg-line pt-4 md:flex-row md:items-center md:justify-between md:gap-4 md:pt-6">

          <div className="text-[11px] text-[#8a8178]">
            © {new Date().getFullYear()} Hourglass Diamonds · Charlotte, NC
          </div>

          <div className="flex flex-wrap items-center gap-x-5 text-[11px] text-[#8a8178] md:gap-x-4">
            <Link href="/privacy" className={LEGAL_LINK}>
              Privacy
            </Link>
            <Link href="/terms" className={LEGAL_LINK}>
              Terms
            </Link>
          </div>

        </div>

      </div>
    </footer>
  );
}
