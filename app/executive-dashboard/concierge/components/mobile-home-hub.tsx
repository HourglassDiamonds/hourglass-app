import Link from "next/link";
import { greetingLine } from "@/lib/continuum/dashboard/compose";
import type { ContinuumHomeModel } from "@/lib/continuum/dashboard/types";
import { CONCIERGE_ASK_PATH } from "@/lib/continuum/operating-shell/destinations";
import {
  MOBILE_HUB_ASK_PLACEHOLDER,
  MOBILE_HUB_CONCIERGE_MODES,
  MOBILE_HUB_DESTINATIONS,
  type HomeGlanceTile,
} from "@/lib/continuum/operating-shell/home-hub";
import { ContinuumMark } from "./continuum-mark";

function DestinationIcon({ id }: { id: (typeof MOBILE_HUB_DESTINATIONS)[number]["id"] }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 18 18",
    fill: "none",
    "aria-hidden": true,
    className: "shrink-0 text-[#9a8d7c]",
  } as const;
  const stroke = {
    stroke: "currentColor",
    strokeWidth: 1.15,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (id === "today") {
    return (
      <svg {...common}>
        <rect x="3" y="4.5" width="12" height="10.5" rx="1.4" {...stroke} />
        <path d="M3 7.5h12M6.5 3v2.5M11.5 3v2.5" {...stroke} />
      </svg>
    );
  }
  if (id === "projects") {
    return (
      <svg {...common}>
        <path d="M3.5 5.5h11v9h-11z" {...stroke} />
        <path d="M3.5 5.5 6 3h4.5l2 2.5" {...stroke} />
      </svg>
    );
  }
  if (id === "repairs") {
    return (
      <svg {...common}>
        <path d="M7 11.5 12.5 6A2.4 2.4 0 1 0 10 3.5L4.5 9 7 11.5z" {...stroke} />
        <path d="M4.5 9 3 10.5 5.5 13 7 11.5" {...stroke} />
      </svg>
    );
  }
  if (id === "clients") {
    return (
      <svg {...common}>
        <circle cx="9" cy="6.2" r="2.2" {...stroke} />
        <path d="M4.2 14c.7-2.6 2.5-3.8 4.8-3.8s4.1 1.2 4.8 3.8" {...stroke} />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M9 14.5c-3.4-2.2-5.5-4.4-5.5-7A3.1 3.1 0 0 1 9 5.2 3.1 3.1 0 0 1 14.5 7.5c0 2.6-2.1 4.8-5.5 7z" {...stroke} />
    </svg>
  );
}

export function MobileHomeHub({
  model,
  glance,
}: {
  model: ContinuumHomeModel;
  glance: readonly HomeGlanceTile[];
}) {
  return (
    <div
      data-mobile-home
      className="hg-mobile-home hg-concierge-fade mx-auto w-full max-w-[26.5rem]"
    >
      <header className="flex flex-col items-start gap-5">
        <div className="flex items-center gap-3">
          <ContinuumMark size={52} />
          <p className="font-serif text-[1.05rem] tracking-[0.14em] text-[#efe8de]">
            Continuum
          </p>
        </div>
        <h1 className="font-serif text-[2.05rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#efe8de]">
          {greetingLine(model)}
        </h1>
      </header>

      <nav aria-label="Primary destinations" className="mt-10">
        <ul className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {MOBILE_HUB_DESTINATIONS.map((destination) => (
            <li key={destination.id}>
              <Link
                href={destination.href}
                data-mobile-home-destination={destination.id}
                className="flex min-h-[4.35rem] items-center gap-4 py-3 outline-none transition-colors hover:text-[#ad9164] focus-visible:text-[#ad9164]"
              >
                <DestinationIcon id={destination.id} />
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-[1.28rem] leading-[1.12] tracking-[-0.03em] text-[#efe8de]">
                    {destination.label}
                  </span>
                  <span className="mt-1 block text-[12px] leading-snug text-[#8d8073]">
                    {destination.descriptor}
                  </span>
                </span>
                <span aria-hidden className="text-[1.05rem] text-[#6f655c]">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="mt-12" data-mobile-home-concierge>
        <h2 className="font-serif text-[1.45rem] font-normal tracking-[-0.03em] text-[#efe8de]">
          Concierge
        </h2>
        <form action={CONCIERGE_ASK_PATH} method="get" className="mt-5">
          <label htmlFor="mobile-home-ask" className="sr-only">
            Ask Concierge
          </label>
          <input
            id="mobile-home-ask"
            type="search"
            name="q"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder={MOBILE_HUB_ASK_PLACEHOLDER}
            className="min-h-14 w-full border-b border-white/[0.12] bg-transparent px-0 text-[17px] text-[#efe8de] outline-none placeholder:text-[#7d7268] focus-visible:border-[#ad9164]/70"
          />
        </form>
        <ul className="mt-6 flex flex-col gap-1">
          {MOBILE_HUB_CONCIERGE_MODES.map((mode) => (
            <li key={mode.id}>
              <Link
                href={mode.href}
                data-mobile-home-concierge-mode={mode.id}
                className="flex min-h-12 items-baseline justify-between gap-4 outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164]"
              >
                <span className="text-[13px] tracking-[0.04em] text-[#efe8de]">
                  {mode.label}
                </span>
                <span className="max-w-[18ch] text-right text-[11px] leading-snug text-[#8d8073]">
                  {mode.descriptor}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {glance.length > 0 ? (
        <section className="mt-12" data-mobile-home-glance>
          <h2 className="text-[10px] uppercase tracking-[0.28em] text-[#6f655c]">
            At a glance
          </h2>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {glance.map((tile) => (
              <li
                key={tile.id}
                data-mobile-home-glance-tile={tile.id}
                className="text-[12px] tracking-[0.02em] text-[#8d8073]"
              >
                <span className="text-[#efe8de]">{tile.count}</span> {tile.label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
