"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { requestAnalyticsConsentManager } from "@/lib/analytics/consent";
import ConsultationCtaLink from "./ConsultationCtaLink";
import { isNavCurrent } from "./nav-current";

/* 44px-tall link rows (WCAG 2.5.8 target-size best practice) — the text
   stays small and quiet; the interactive row grows, not the type. */
const NAV_LINK = "inline-flex min-h-11 items-center hover:text-[#1f1d1a]";
const LEGAL_LINK = "inline-flex min-h-11 items-center hover:text-[#1f1d1a]";

function footerLinkClass(base: string, current: boolean): string {
  return current ? `${base} font-medium text-[#1f1d1a]` : base;
}

function FooterLink({
  href,
  pathname,
  className,
  children,
}: {
  href: string;
  pathname: string;
  className: string;
  children: React.ReactNode;
}) {
  const current = isNavCurrent(pathname, href);
  return (
    <Link
      href={href}
      className={footerLinkClass(className, current)}
      aria-current={current ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

export default function Footer() {
  const pathname = usePathname() ?? "";
  const conciergeCurrent = isNavCurrent(pathname, "/concierge");

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
            <FooterLink href="/the-house" pathname={pathname} className={NAV_LINK}>The House</FooterLink>
            <FooterLink href="/our-approach" pathname={pathname} className={NAV_LINK}>Our Approach</FooterLink>
            <FooterLink href="/conversations" pathname={pathname} className={NAV_LINK}>
              Conversations
            </FooterLink>
            <FooterLink href="/engagement-rings" pathname={pathname} className={NAV_LINK}>Engagement Rings</FooterLink>
            <FooterLink href="/custom-design" pathname={pathname} className={NAV_LINK}>Custom Design</FooterLink>
            <FooterLink href="/diamond-guide" pathname={pathname} className={NAV_LINK}>Diamond Guide</FooterLink>
            <FooterLink href="/diamond-studio" pathname={pathname} className={NAV_LINK}>Diamond Studio</FooterLink>
            <ConsultationCtaLink
              location="footer:cta"
              className={footerLinkClass(NAV_LINK, conciergeCurrent)}
              aria-current={conciergeCurrent ? "page" : undefined}
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
            <p className="mt-3 text-[12px] leading-[1.75] text-[#6d655e]">
              Weekly intelligence on markets, infrastructure, AI, energy, and
              global systems.
            </p>
            <FooterLink
              href="/ledger"
              pathname={pathname}
              className="mt-2 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.26em] text-[#625b54] transition-colors hover:text-[#1f1d1a]"
            >
              Explore the Ledger
            </FooterLink>
          </div>
          <div className="max-w-[28rem]">
            <p className="text-[10px] uppercase tracking-[0.32em] text-hg-eyebrow">
              Whispered Praise
            </p>
            <p className="mt-3 text-[12px] leading-[1.75] text-[#6d655e]">
              Quiet reflections from clients who trusted the process.
            </p>
            <FooterLink
              href="/whispered-praise"
              pathname={pathname}
              className="mt-2 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.26em] text-[#625b54] transition-colors hover:text-[#1f1d1a]"
            >
              Read Whispered Praise
            </FooterLink>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-8 flex flex-col gap-2 border-t border-hg-line pt-4 md:flex-row md:items-center md:justify-between md:gap-4 md:pt-6">

          <div className="text-[11px] text-[#6d655e]">
            © {new Date().getFullYear()} Hourglass Diamonds · Charlotte, NC
          </div>

          <div className="flex flex-wrap items-center gap-x-5 text-[11px] text-[#6d655e] md:gap-x-4">
            <FooterLink href="/privacy" pathname={pathname} className={LEGAL_LINK}>
              Privacy
            </FooterLink>
            <button
              type="button"
              className={LEGAL_LINK}
              onClick={() => requestAnalyticsConsentManager()}
            >
              Analytics
            </button>
            <FooterLink href="/terms" pathname={pathname} className={LEGAL_LINK}>
              Terms
            </FooterLink>
          </div>

        </div>

      </div>
    </footer>
  );
}
