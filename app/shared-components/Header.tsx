"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";

const NAV_ITEMS = [
  { href: "/the-house", label: "The House" },
  { href: "/engagement-rings", label: "Engagement Rings" },
  { href: "/custom-design", label: "Custom Design" },
  { href: "/diamond-guide", label: "Diamond Guide" },
  { href: "/diamond-studio", label: "Diamond Studio" },
  { href: "/concierge", label: "Concierge" },
];

type HeaderProps = {
  currentPage?: string;
};

function isFeaturedNav(href: string): boolean {
  return href === "/diamond-studio";
}

function navLinkClass(isActive: boolean, featured?: boolean): string {
  if (isActive) {
    return "text-[#1f1d1a]";
  }
  if (featured) {
    return "font-medium text-[#35312c] hover:text-[#1f1d1a]";
  }
  return "text-[#6a635c] hover:text-[#1f1d1a]";
}

function BrandMark() {
  return (
    <span className="relative block h-[72px] w-[72px] shrink-0 md:h-[78px] md:w-[78px]">
      <Image
        src="/hourglass-logo-gold.png"
        alt=""
        fill
        sizes="(max-width: 768px) 72px, 78px"
        className="object-contain opacity-80"
      />
    </span>
  );
}

export default function Header({ currentPage = "" }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-50 w-full max-w-[100vw] overflow-x-hidden border-b border-[#e4dbcf]/55 bg-[#efe8de]/88 backdrop-blur-[10px] supports-[backdrop-filter]:bg-[#efe8de]/78">
      <div className="mx-auto box-border flex w-full min-w-0 max-w-[1200px] items-end justify-between gap-4 px-0 pb-5 pt-6 md:gap-8 md:pb-6 md:pt-7">
        <Link
          href="/"
          className="flex shrink-0 items-end transition-opacity duration-300 hover:opacity-90"
          aria-label="Hourglass Diamonds home"
        >
          <BrandMark />
        </Link>

        <div className="relative shrink-0 pb-1 md:hidden md:pb-1.5">
          <button
            type="button"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="inline-flex items-center justify-center rounded-full border border-[#e4dbcf]/90 bg-[#f7f3ec]/80 px-4 py-2.5 text-[11px] uppercase tracking-[0.22em] text-[#625b54] transition-colors duration-300 hover:text-[#1f1d1a] focus:outline-none focus:ring-2 focus:ring-[#cbbda9]/80 focus:ring-offset-2 focus:ring-offset-[#efe8de]"
          >
            Menu
          </button>

          {mobileMenuOpen ? (
            <div
              role="menu"
              aria-label="Mobile navigation"
              className="absolute right-0 top-[calc(100%+12px)] z-50 w-[min(86vw,320px)] max-w-[calc(100vw-3rem)] overflow-hidden rounded-[18px] border border-[#e4dbcf] bg-[#f6f2eb]/95 shadow-[0_26px_60px_rgba(48,36,28,0.12)] ring-1 ring-[#e6ddd1]/60 backdrop-blur-[12px]"
            >
              <div className="px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#8a8177]">
                  Navigation
                </p>
              </div>

              <div className="border-t border-[#e4dbcf]/80">
                {NAV_ITEMS.map((item) => {
                  const key = item.href.replace("/", "");
                  const isActive = currentPage === key;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-4 py-3.5 text-[13px] tracking-[0.02em] transition-colors duration-300 ${navLinkClass(
                        isActive,
                        isFeaturedNav(item.href),
                      )}`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <nav
          aria-label="Primary"
          className="hidden min-w-0 flex-1 items-end justify-end gap-5 pb-1.5 md:flex md:pb-2 lg:gap-6 xl:gap-7"
        >
          {NAV_ITEMS.map((item) => {
            const key = item.href.replace("/", "");
            const isActive = currentPage === key;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 whitespace-nowrap text-[12px] tracking-[0.04em] transition-colors duration-300 lg:text-[13px] ${navLinkClass(
                  isActive,
                  isFeaturedNav(item.href),
                )}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
