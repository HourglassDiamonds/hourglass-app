"use client";

import React from "react";
import Link from "next/link";

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

function BrandMark() {
  return (
    <div className="text-[10px] uppercase tracking-[0.30em] text-[#746c62] md:text-[11px]">
      Hourglass Diamonds
    </div>
  );
}

export default function Header({ currentPage = "" }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-6 px-6 py-6 md:gap-10 md:px-8 md:py-7">
      <Link href="/" className="flex items-center" aria-label="Hourglass home">
        <BrandMark />
      </Link>

      <div className="relative md:hidden">
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="inline-flex items-center justify-center rounded-full border border-[#e4dbcf] bg-white/65 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-[#625b54] shadow-[0_10px_22px_rgba(48,36,28,0.05)] transition-colors duration-200 hover:text-[#1f1d1a] focus:outline-none focus:ring-2 focus:ring-[#cbbda9] focus:ring-offset-2 focus:ring-offset-[#efe8de]"
        >
          Menu
        </button>

        {mobileMenuOpen ? (
          <div
            role="menu"
            aria-label="Mobile navigation"
            className="absolute right-0 top-[calc(100%+12px)] z-50 w-[min(86vw,320px)] overflow-hidden rounded-[18px] border border-[#e4dbcf] bg-[#f6f2eb] shadow-[0_26px_60px_rgba(48,36,28,0.12)] ring-1 ring-[#e6ddd1]/60"
          >
            <div className="px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.28em] text-[#8a8177]">
                Navigation
              </div>
            </div>

            <div className="border-t border-[#e4dbcf]">
              {NAV_ITEMS.map((item) => {
                const key = item.href.replace("/", "");
                const isActive = currentPage === key;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-3 text-[13px] tracking-[0.02em] transition-colors duration-200 ${
                      isActive
                        ? "text-[#1f1d1a]"
                        : "text-[#625b54] hover:text-[#1f1d1a]"
                    }`}
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
        className="hidden shrink-0 items-center gap-5 md:flex xl:gap-8"
      >
        {NAV_ITEMS.map((item) => {
          const key = item.href.replace("/", "");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`text-[12px] tracking-[0.04em] transition-colors duration-300 ${
                currentPage === key
                  ? "text-[#1f1d1a]"
                  : "text-[#625b54] hover:text-[#1f1d1a]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}