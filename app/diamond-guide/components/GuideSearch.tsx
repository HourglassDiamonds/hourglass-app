"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { searchGuideArticles } from "@/lib/diamond-guide/guide-search";
import { GUIDE_NAV_GROUPS, type GuideSearchRecord } from "@/lib/diamond-guide/guide-nav";

type GuideSearchProps = {
  records: GuideSearchRecord[];
  inputId?: string;
  showPopular?: boolean;
};

const MAX_VISIBLE_RESULTS = 16;

const POPULAR_SEARCHES = [
  { label: "Carat size", query: "carat size" },
  { label: "Oval diamonds", query: "oval diamonds" },
  { label: "VS1 vs VS2", query: "vs1 vs vs2" },
  { label: "Lab vs natural", query: "lab vs natural" },
] as const;

export default function GuideSearch({
  records,
  inputId = "diamond-guide-search",
  showPopular = false,
}: GuideSearchProps) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const results = useMemo(
    () => (trimmed.length >= 2 ? searchGuideArticles(trimmed, records) : []),
    [records, trimmed],
  );
  const searching = trimmed.length >= 2;
  const visible = results.slice(0, MAX_VISIBLE_RESULTS);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <form className="relative z-20 w-full" role="search" onSubmit={onSubmit}>
      <label htmlFor={inputId} className="sr-only">
        Search the Diamond Guide
      </label>
      <div className="relative">
        <span
          className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-[#8a8279]"
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            className="h-[18px] w-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="10.5" cy="10.5" r="6.25" />
            <path d="M15.4 15.4 20 20" strokeLinecap="round" />
          </svg>
        </span>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the Diamond Guide…"
          autoComplete="off"
          enterKeyHint="search"
          className="h-[58px] w-full rounded-[10px] border border-[#c9c0b4] bg-[#f6f1ea] py-3 pl-12 pr-5 text-[1.02rem] leading-[1.5] text-[#1d1b18] outline-none transition-[border-color,box-shadow] duration-300 placeholder:text-[#8a8279] [-webkit-appearance:none] focus:border-[#9a9188] focus:shadow-[0_0_0_3px_rgba(154,145,136,0.16)] md:h-[60px] [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
        />
      </div>

      {showPopular && !searching ? (
        <p className="mt-3 text-left text-[0.82rem] leading-[1.7] text-[#7a726a]">
          <span className="text-[#6d655e]">Popular:</span>{" "}
          {POPULAR_SEARCHES.map((item, index) => (
            <span key={item.query}>
              {index > 0 ? (
                <span aria-hidden="true" className="text-[#c4bbb0]">
                  {" "}
                  ·{" "}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setQuery(item.query)}
                className="text-[#5c534a] underline decoration-[#d4cbc0] underline-offset-[0.22em] transition-colors duration-300 hover:text-[#1d1b18] hover:decoration-[#1d1b18]"
              >
                {item.label}
              </button>
            </span>
          ))}
        </p>
      ) : null}

      {searching ? (
        <div className="absolute inset-x-0 top-[58px] z-30 mt-2 max-h-[min(24rem,52vh)] overflow-y-auto overscroll-contain rounded-[10px] border border-[#e4dbcf] bg-[#efe8de] px-4 pb-3 pt-3 shadow-[0_18px_40px_rgba(48,36,28,0.08)] md:top-[60px]">
          <div aria-live="polite">
            <p className="text-left text-[11px] uppercase tracking-[0.28em] text-[#6d655e]">
              {results.length === 0
                ? "No matching guides"
                : results.length > MAX_VISIBLE_RESULTS
                  ? `Showing ${MAX_VISIBLE_RESULTS} of ${results.length} guides`
                  : `${results.length} ${results.length === 1 ? "guide" : "guides"}`}
            </p>
          </div>

          {results.length === 0 ? (
            <p className="mt-4 text-left text-[0.95rem] leading-[1.75] text-[#6f675f]">
              Nothing in the library matches that yet. Try a subject such as
              color, fluorescence, oval, or certificates.
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-[#e7ddd2] text-left">
              {visible.map((result) => (
                <li key={result.slug}>
                  <Link
                    href={result.href}
                    className="group flex items-start justify-between gap-6 py-4 transition-colors duration-300 hover:opacity-90"
                  >
                    <span className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-[0.28em] text-[#6d655e]">
                        {GUIDE_NAV_GROUPS.find(
                          (group) => group.articleCategory === result.category,
                        )?.navTitle ?? result.category}
                      </span>
                      <span className="mt-1.5 block font-serif text-[1.08rem] tracking-[-0.02em] text-[#1d1b18] group-hover:text-[#0f0e0d]">
                        {result.title}
                      </span>
                      <span className="mt-2 block max-w-[52ch] text-[0.9rem] leading-[1.65] text-[#6f675f]">
                        {result.excerpt}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className="mt-6 shrink-0 text-[0.95rem] text-[#b7aea4] transition-colors duration-300 group-hover:text-[#1d1b18]"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </form>
  );
}
