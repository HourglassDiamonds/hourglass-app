"use client";

import { useId, useState, type FormEvent } from "react";

const ASK_NOTICE = "Ask Concierge isn't connected yet.";

export function AskConciergeShell() {
  const inputId = useId();
  const [notice, setNotice] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(ASK_NOTICE);
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
      {notice ? (
        <p className="mt-4 text-[14px] leading-relaxed text-[#c4b7aa]" role="status">
          {notice}
        </p>
      ) : (
        <p className="mt-4 text-[12px] leading-relaxed text-[#7d7268]">
          How many birthdays are coming up?
          <br />
          Who should I follow up with?
          <br />
          What do I know about Sarah?
        </p>
      )}
    </section>
  );
}
