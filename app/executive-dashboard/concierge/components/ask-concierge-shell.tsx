"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { askConcierge } from "../actions";
import { AskConciergeAnswerView } from "./ask-concierge-answer";
import {
  ASK_PENDING_MESSAGE,
  type AskConciergeAnswer,
} from "@/lib/continuum/client-memory/ask/types";

const EXAMPLES = [
  "Who has a birthday in November?",
  "Birthdays next month",
] as const;

export function AskConciergeShell() {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<AskConciergeAnswer | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const next = await askConcierge(trimmed);
      setAnswer(next);
    });
  }

  return (
    <section>
      <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
        Ask Concierge
      </h2>
      <form className="mt-4" onSubmit={onSubmit} noValidate>
        <label htmlFor={inputId} className="sr-only">
          Ask Concierge
        </label>
        <div className="flex items-stretch gap-3">
          <input
            id={inputId}
            type="search"
            name="ask"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="Ask anything about your relationships…"
            className="min-h-14 w-full rounded-[22px] border border-white/[0.08] bg-[#1d1916] px-5 text-[17px] text-[#efe8de] outline-none placeholder:text-[#7d7268] focus-visible:border-[#ad9164]/70 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
          />
          <button
            type="submit"
            className="shrink-0 px-1 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
          >
            Ask
          </button>
        </div>
      </form>
      {pending ? (
        <p className="mt-4 text-[14px] leading-relaxed text-[#c4b7aa]" role="status">
          {ASK_PENDING_MESSAGE}
        </p>
      ) : answer ? (
        <AskConciergeAnswerView answer={answer} />
      ) : (
        <p className="mt-4 text-[12px] leading-relaxed text-[#7d7268]">
          {EXAMPLES[0]}
          <br />
          {EXAMPLES[1]}
        </p>
      )}
    </section>
  );
}
