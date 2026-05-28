"use client";

import Image from "next/image";
import Link from "next/link";

type NavItem = {
  label: string;
  href: string;
  active: boolean;
  soon?: boolean;
};

const NAV: NavItem[] = [
  { label: "Diamond Size Studio", href: "/diamond-studio", active: false },
  {
    label: "Shape Comparison",
    href: "/diamond-studio",
    active: false,
    soon: true,
  },
  {
    label: "Light Performance",
    href: "/diamond-intelligence",
    active: true,
  },
];

export default function LightPerformanceStudioNav() {
  return (
    <header className="border-b border-[#e4dbcf]/80 bg-[#f7f3ee]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 shrink-0"
          aria-label="Hourglass Diamonds home"
        >
          <Image
            src="/hourglass-logo-gold.png"
            alt=""
            width={28}
            height={28}
            className="opacity-90"
          />
          <span className="text-[10px] uppercase tracking-[0.32em] text-[#6f665d]">
            Diamond Studio
          </span>
        </Link>

        <nav
          className="flex flex-1 flex-wrap items-center justify-center gap-6 md:gap-10"
          aria-label="Diamond Studio tools"
        >
          {NAV.map((item) => (
            <div key={item.label} className="text-center">
              {item.active ? (
                <span className="block text-[10px] uppercase tracking-[0.26em] text-[#1f1d1a]">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="block text-[10px] uppercase tracking-[0.26em] text-[#948a80] transition hover:text-[#5f5851]"
                >
                  {item.label}
                </Link>
              )}
              {item.active ? (
                <span
                  className="mx-auto mt-2 block h-px w-full max-w-[120px] bg-[#b8a99a]"
                  aria-hidden
                />
              ) : item.soon ? (
                <span className="mt-1 block text-[8px] uppercase tracking-[0.2em] text-[#b5a99a]">
                  Coming soon
                </span>
              ) : null}
            </div>
          ))}
        </nav>

        <Link
          href="/"
          className="shrink-0 rounded-full border border-[#ddd1c2] bg-white/80 px-4 py-2 text-[9px] uppercase tracking-[0.22em] text-[#5f5851] transition hover:border-[#cbbda9] hover:bg-white"
        >
          Home
        </Link>
      </div>
    </header>
  );
}
