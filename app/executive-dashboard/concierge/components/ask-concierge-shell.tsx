"use client";

import { useEffect, useId, useState, useTransition, type FormEvent } from "react";
import { askConcierge } from "../ask-actions";
import { AskConciergeAnswerView, type AskAnswer } from "./ask-concierge-answer";
import {
  ASK_PENDING_MESSAGE,
} from "@/lib/continuum/client-memory/ask/types";
import type { ConciergeAskMode } from "@/lib/continuum/client-memory/read/presentation";
import type { ConciergeSolHistoryTurn } from "@/lib/continuum/concierge-sol/types";
import { CONCIERGE_SOL_PENDING_MESSAGE } from "@/lib/continuum/concierge-sol/types";

const EXAMPLES = [
  "Who has a birthday in November?",
  "Birthdays next month",
] as const;

type Turn = {
  role: ConciergeSolHistoryTurn["role"];
  text: string;
  answer: AskAnswer | null;
};

export function AskConciergeShell({
  initialQuery = "",
  placeholder,
  mode = "conversation",
}: {
  initialQuery?: string;
  placeholder?: string;
  mode?: ConciergeAskMode;
} = {}) {
  const inputId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, startTransition] = useTransition();
  const resolvedPlaceholder = placeholder ?? EXAMPLES[0];

  useEffect(() => {
    const trimmed = initialQuery.trim();
    if (!trimmed) return;
    submit(trimmed, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-ask from Home hub q=
  }, [initialQuery]);

  function historyFrom(rows: Turn[]): ConciergeSolHistoryTurn[] {
    const history: ConciergeSolHistoryTurn[] = [];
    for (const row of rows) {
      if (row.role === "founder") {
        history.push({ role: "founder", text: row.text });
        continue;
      }
      if (row.answer && row.answer.kind === "conversation") {
        history.push({ role: "concierge", text: row.answer.text });
      }
    }
    return history;
  }

  function submit(trimmed: string, prior: Turn[]) {
    startTransition(async () => {
      const next = await askConcierge({
        query: trimmed,
        mode,
        history: historyFrom(prior),
      });
      setTurns([
        ...prior,
        { role: "founder", text: trimmed, answer: null },
        { role: "concierge", text: "", answer: next },
      ]);
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    submit(trimmed, turns);
    setQuery("");
  }

  const last = [...turns].reverse().find((row) => row.answer);
  const earlier = turns.filter((row) => row.role === "founder" || row.answer);

  return (
    <section data-ask-mode={mode} className="hg-concierge-sol">
      <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
        {mode === "brain-dump" ? "Brain Dump" : mode === "design" ? "Design Mode" : "Ask Concierge"}
      </h2>
      {earlier.length > 0 ? (
        <ol className="hg-concierge-sol-thread mt-4 flex flex-col gap-3" data-concierge-sol-thread="">
          {earlier.map((row, index) => (
            <li key={`${row.role}-${index}`} data-concierge-sol-turn={row.role}>
              {row.role === "founder" ? (
                <p className="text-[13px] leading-snug text-[#8d8073]">{row.text}</p>
              ) : row.answer ? (
                <AskConciergeAnswerView answer={row.answer} />
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
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
            placeholder={resolvedPlaceholder}
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
          {mode === "conversation" ? CONCIERGE_SOL_PENDING_MESSAGE : ASK_PENDING_MESSAGE}
        </p>
      ) : last?.answer || earlier.length > 0 ? null : mode === "conversation" ? (
        <p className="mt-4 text-[12px] leading-relaxed text-[#7d7268]">
          {EXAMPLES[0]}
          <br />
          {EXAMPLES[1]}
        </p>
      ) : null}
    </section>
  );
}
