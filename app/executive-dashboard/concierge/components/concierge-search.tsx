"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { searchConciergeClients } from "../actions";
import { ClientSearchResultRow } from "./client-search-result";
import type { ClientSearchResult } from "@/lib/continuum/client-memory/read/types";

const DEBOUNCE_MS = 180;

export function ConciergeSearch() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      requestIdRef.current += 1;
      setResults(null);
      setError(null);
      return;
    }
    const handle = window.setTimeout(() => {
      const requestId = ++requestIdRef.current;
      startTransition(async () => {
        const state = await searchConciergeClients(trimmed);
        if (requestId !== requestIdRef.current) return;
        if (!state.ok) {
          setResults([]);
          setError(
            state.reason === "unauthorized"
              ? "Sign in to continue."
              : "Client record unavailable.",
          );
          return;
        }
        setError(null);
        setResults(state.results);
      });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  const trimmed = query.trim();
  const showEmptyHome = !trimmed;
  const showNoResults =
    Boolean(trimmed) && !pending && results && results.length === 0 && !error;

  return (
    <div>
      <label htmlFor={inputId} className="sr-only">
        Search clients
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        value={query}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        placeholder="Search clients"
        onChange={(event) => setQuery(event.target.value)}
        className="min-h-14 w-full rounded-[22px] border border-white/[0.08] bg-[#1d1916] px-5 text-[17px] text-[#efe8de] outline-none placeholder:text-[#7d7268] focus-visible:border-[#ad9164]/70 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
      />

      <div className="mt-8 min-h-[8rem]" aria-live="polite">
        {showEmptyHome ? (
          <p className="max-w-[18ch] font-serif text-[1.45rem] leading-[1.2] tracking-[-0.03em] text-[#d8cfc4]">
            Search your client memory.
          </p>
        ) : null}

        {pending && trimmed && !results ? (
          <p className="text-[13px] tracking-[0.04em] text-[#9a8e82]">Searching…</p>
        ) : null}

        {error ? (
          <p className="text-[14px] leading-relaxed text-[#d2b8a8]">{error}</p>
        ) : null}

        {showNoResults ? (
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            No clients found.
          </p>
        ) : null}

        {results && results.length > 0 ? (
          <ul className="hg-concierge-fade divide-y divide-white/[0.06]">
            {results.map((result) => (
              <li key={result.personId}>
                <ClientSearchResultRow result={result} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
