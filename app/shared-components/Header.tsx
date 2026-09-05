"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import ConsultationCtaLink from "./ConsultationCtaLink";
import { isNavCurrent } from "./nav-current";

const NAV_ITEMS = [
  { href: "/the-house", label: "The House" },
  { href: "/engagement-rings", label: "Engagement Rings" },
  { href: "/custom-design", label: "Custom Design" },
  { href: "/diamond-guide", label: "Diamond Guide" },
  { href: "/diamond-studio", label: "Diamond Studio" },
  { href: "/concierge", label: "Concierge" },
] as const;

type HeaderProps = {
  currentPage?: string;
};

function isFeaturedNav(href: string): boolean {
  return href === "/diamond-studio";
}

/** Quiet emphasis for Concierge — editorial, not button-like. */
function isEmphasizedNav(href: string): boolean {
  return href === "/concierge";
}

function navLinkClass(
  isActive: boolean,
  featured?: boolean,
  emphasized?: boolean,
): string {
  if (isActive) {
    return "font-medium text-hg-ink";
  }
  if (emphasized) {
    return "font-medium text-[#35312c] underline-offset-4 transition-colors duration-300 hover:text-hg-ink hover:underline";
  }
  if (featured) {
    return "font-medium text-[#35312c] hover:text-hg-ink";
  }
  return "text-[#6a635c] hover:text-hg-ink";
}

function BrandMark() {
  return (
    <span className="relative block h-[48px] w-[48px] shrink-0 sm:h-[52px] sm:w-[52px] lg:h-[78px] lg:w-[78px]">
      <Image
        src="/hourglass-logo-gold.png"
        alt=""
        fill
        sizes="(max-width: 1023px) 52px, 78px"
        className="object-contain opacity-80"
      />
    </span>
  );
}

export default function Header({ currentPage = "" }: HeaderProps) {
  const pathname = usePathname() ?? "";
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        // WCAG 2.4.3: return focus to the disclosure toggle when Escape closes the menu.
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  return (
    <>
      {/* Skip link lives with the header so activating it lands *after* the
          repeated navigation (WCAG 2.4.1). The header renders inside <main>
          on every page, so targeting the layout-level <main> cannot bypass it.
          `.hg-skip-link` (globals.css) is the sr-only → focus-reveal pattern:
          Tailwind `sr-only` + `focus:not-sr-only` leaves `clip-path: inset(50%)`
          in place, so keyboard focus never visually unclips the control. */}
      <a href="#hg-page-content" className="hg-skip-link">
        Skip to main content
      </a>
      <header className="sticky top-0 z-50 w-full max-w-[100vw] overflow-x-clip overflow-y-visible border-b border-hg-line/55 bg-hg-ivory/88 backdrop-blur-[10px] supports-[backdrop-filter]:bg-hg-ivory/78">
      {/* Desktop nav from `lg` (1024px) — six nowrap links crowd the bar at
          768–1023px (audit Pass 2 / mobile deep-dive). */}
      <div className="relative mx-auto box-border flex w-full min-w-0 max-w-[1200px] flex-wrap items-center justify-between gap-x-4 gap-y-0 px-0 py-3.5 lg:flex-nowrap lg:items-end lg:gap-8 lg:py-0 lg:pb-6 lg:pt-7">
        <Link
          href="/"
          className="flex shrink-0 items-center transition-opacity duration-300 hover:opacity-90 lg:items-end"
          aria-label="Hourglass Diamonds home"
          aria-current={isNavCurrent(pathname, "/") ? "page" : undefined}
        >
          <BrandMark />
        </Link>

        <div className="relative z-[55] shrink-0 lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="hg-mobile-nav"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-hg-line/90 bg-[#f7f3ec]/80 px-4 py-2.5 text-[11px] uppercase tracking-[0.22em] text-[#625b54] transition-colors duration-300 hover:text-hg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hg-focus focus-visible:ring-offset-2 focus-visible:ring-offset-hg-ivory"
          >
            Menu
          </button>
        </div>

        <nav
          aria-label="Primary"
          className="hidden min-w-0 flex-1 items-end justify-end gap-4 pb-1.5 lg:flex lg:gap-5 lg:pb-2 xl:gap-6"
        >
          {NAV_ITEMS.map((item) => {
            const key = item.href.replace("/", "");
            const isActive =
              currentPage === key || isNavCurrent(pathname, item.href);
            const className = `inline-flex min-h-11 shrink-0 items-end whitespace-nowrap text-[12px] tracking-[0.04em] transition-colors duration-300 lg:text-[13px] ${navLinkClass(
              isActive,
              isFeaturedNav(item.href),
              isEmphasizedNav(item.href),
            )}`;

            if (item.href === "/concierge") {
              return (
                <ConsultationCtaLink
                  key={item.href}
                  location="header:nav"
                  className={className}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </ConsultationCtaLink>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={className}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {mobileMenuOpen ? (
          <nav
            id="hg-mobile-nav"
            aria-label="Mobile navigation"
            className="z-[80] mt-4 w-full min-w-0 basis-full overflow-hidden rounded-hg-panel border border-hg-line bg-[#f6f2eb]/95 shadow-hg-lifted ring-1 ring-[#e6ddd1]/60 backdrop-blur-[12px] lg:hidden"
          >
            <div className="px-4 py-3.5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-hg-eyebrow">
                Navigation
              </p>
            </div>

            <ul className="border-t border-hg-line/80">
              {NAV_ITEMS.map((item) => {
                const key = item.href.replace("/", "");
                const isActive =
                  currentPage === key || isNavCurrent(pathname, item.href);
                const className = `flex min-h-11 items-center px-4 py-3.5 text-[13px] tracking-[0.02em] transition-colors duration-300 focus-visible:rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hg-focus ${navLinkClass(
                  isActive,
                  isFeaturedNav(item.href),
                  isEmphasizedNav(item.href),
                )}`;

                if (item.href === "/concierge") {
                  return (
                    <li key={item.href}>
                      <ConsultationCtaLink
                        location="header:nav"
                        onClick={() => setMobileMenuOpen(false)}
                        className={className}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {item.label}
                      </ConsultationCtaLink>
                    </li>
                  );
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={className}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}
      </div>
      </header>
      {/* Skip-link destination: focus lands here, immediately past the header. */}
      <div id="hg-page-content" tabIndex={-1} />
    </>
  );
}
