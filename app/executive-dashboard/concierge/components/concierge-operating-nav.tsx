"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONTINUUM_APP_NAME } from "@/lib/continuum/pwa/config";
import {
  CONCIERGE_HOME_PATH,
  OPERATING_DESTINATIONS,
  OPERATING_TOOL_LINKS,
  operatingDestinationForPath,
} from "@/lib/continuum/operating-shell/destinations";
import { ConciergeSignOut } from "./concierge-sign-out";

const navLinkClass =
  "inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.22em] outline-none transition-colors duration-200";

function destinationClass(active: boolean): string {
  return active
    ? `${navLinkClass} text-[#efe8de]`
    : `${navLinkClass} text-[#8d8073] hover:text-[#efe8de] focus-visible:text-[#efe8de]`;
}

function ToolsMenu() {
  return (
    <details className="hg-operating-tools relative">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]">
        Tools
      </summary>
      <div className="hg-operating-tools-panel absolute right-0 z-40 mt-1 min-w-[11rem] border-t border-white/[0.08] bg-[#14110f] py-2">
        {OPERATING_TOOL_LINKS.map((tool) => (
          <Link
            key={tool.id}
            href={tool.href}
            className="flex min-h-11 items-center px-1 text-[11px] uppercase tracking-[0.2em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
          >
            {tool.label}
          </Link>
        ))}
        <div className="mt-1 border-t border-white/[0.06] pt-1">
          <ConciergeSignOut />
        </div>
      </div>
    </details>
  );
}

export function ConciergeOperatingNav() {
  const pathname = usePathname() ?? CONCIERGE_HOME_PATH;
  const selected = operatingDestinationForPath(pathname);

  return (
    <>
      <header
        data-operating-nav="desktop"
        className="sticky top-0 z-30 hidden border-b border-white/[0.08] bg-[#14110f]/95 pt-[env(safe-area-inset-top)] backdrop-blur-[8px] md:block"
      >
        <div className="mx-auto flex w-full max-w-[75rem] items-center gap-8 px-8 py-2">
          <Link
            href={CONCIERGE_HOME_PATH}
            className="shrink-0 font-serif text-[1.05rem] tracking-[0.08em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164]"
          >
            {CONTINUUM_APP_NAME}
          </Link>
          <nav aria-label="Continuum" className="flex min-w-0 flex-1 items-center gap-6">
            {OPERATING_DESTINATIONS.map((destination) => {
              const active = selected === destination.id;
              return (
                <Link
                  key={destination.id}
                  href={destination.href}
                  aria-current={active ? "page" : undefined}
                  data-operating-destination={destination.id}
                  data-operating-selected={active ? "true" : "false"}
                  className={destinationClass(active)}
                >
                  {destination.label}
                </Link>
              );
            })}
          </nav>
          <ToolsMenu />
        </div>
      </header>

      <header
        data-operating-nav="mobile-top"
        className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-white/[0.08] bg-[#14110f]/95 px-5 pt-[max(0.55rem,env(safe-area-inset-top))] pb-1 backdrop-blur-[8px] md:hidden"
      >
        <Link
          href={CONCIERGE_HOME_PATH}
          className="inline-flex min-h-11 items-center font-serif text-[1.02rem] tracking-[0.08em] text-[#efe8de] outline-none"
        >
          {CONTINUUM_APP_NAME}
        </Link>
        <ToolsMenu />
      </header>

      <nav
        data-operating-nav="mobile"
        aria-label="Continuum"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-[#14110f]/98 pb-[env(safe-area-inset-bottom)] backdrop-blur-[8px] md:hidden"
      >
        <ul className="grid grid-cols-5">
          {OPERATING_DESTINATIONS.map((destination) => {
            const active = selected === destination.id;
            return (
              <li key={destination.id} className="min-w-0">
                <Link
                  href={destination.href}
                  aria-current={active ? "page" : undefined}
                  data-operating-destination={destination.id}
                  data-operating-selected={active ? "true" : "false"}
                  className={`flex min-h-[3.25rem] items-center justify-center px-1 text-center text-[10px] uppercase tracking-[0.14em] outline-none ${
                    active ? "text-[#efe8de]" : "text-[#8d8073]"
                  }`}
                >
                  {destination.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
