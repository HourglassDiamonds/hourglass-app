"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
};

/** Legacy suite nav — kept for reference; prefer diamond-studio-suite-nav-config. */
const NAV: NavItem[] = [
  { label: "See It On a Finger", href: "/diamond-studio" },
  { label: "See It On Your Hand", href: "/diamond-shape-studio" },
  { label: "Analyze Sparkle", href: "/diamond-intelligence" },
];

function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/diamond-studio") {
    return (
      pathname === "/diamond-studio" || pathname.startsWith("/diamond-studio/")
    );
  }
  if (item.href === "/diamond-shape-studio") {
    return (
      pathname === "/diamond-shape-studio" ||
      pathname.startsWith("/diamond-shape-studio/")
    );
  }
  if (item.href === "/diamond-intelligence") {
    return (
      pathname === "/diamond-intelligence" ||
      pathname.startsWith("/diamond-intelligence/")
    );
  }
  return false;
}

export default function LightPerformanceStudioNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-[#e4dbcf]/80 bg-[#f7f3ee]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3"
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
          {NAV.map((item) => {
            const active = isNavActive(pathname, item);
            return (
              <div key={item.label} className="text-center">
                {active ? (
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
                {active ? (
                  <span
                    className="mx-auto mt-2 block h-px w-full max-w-[120px] bg-[#b8a99a]"
                    aria-hidden
                  />
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
