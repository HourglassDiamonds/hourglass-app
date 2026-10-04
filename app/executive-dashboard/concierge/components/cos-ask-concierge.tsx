"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import type { TodayBriefingPacket } from "@/lib/continuum/chief-of-staff/operating-loop/briefing-packet";
import type { CosBriefingV1 } from "@/lib/continuum/chief-of-staff/operating-loop/cos-briefing-v1";
import { TODAY_ASK_PLACEHOLDER } from "@/lib/continuum/chief-of-staff/operating-loop/briefing-ask";
import { proposeFounderOperation, proposeTodayFounderOperation } from "@/lib/continuum/concierge-sol/founder-command";
import { useTodayMutationActions } from "./today-optimistic-item";

export type TodayAskAction = (input: {
  query: string;
  mode?: "brain-dump" | "conversation" | "design";
  todayContext: {
    itemId: string;
    packet: TodayBriefingPacket;
    briefing?: CosBriefingV1 | null;
  };
}) => Promise<{ text?: string; founderDirectiveStatus?: "applied" | "clarify" | "failed"; refreshToday?: boolean } | { kind: string }>;

export function CosAskConcierge({
  packet,
  cosBriefing = null,
  askAction,
}: {
  packet: TodayBriefingPacket;
  cosBriefing?: CosBriefingV1 | null;
  askAction?: TodayAskAction;
}) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const mutation = useTodayMutationActions();

  if (!askAction) {
    return (
      <span className="inline-flex min-h-10 items-center text-[10px] uppercase tracking-[0.16em] text-[#6f675f]" data-cos-ask-item="">
        Ask Sterling
      </span>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || !askAction) return;
    const directive = proposeFounderOperation(trimmed) != null || proposeTodayFounderOperation(trimmed, packet) != null;
    const submit = async () => {
      if (directive) mutation?.beginDirective();
      try {
        const next = await askAction({
        query: trimmed,
        mode: "brain-dump",
        todayContext: {
          itemId: packet.itemId,
          packet,
          briefing: cosBriefing,
        },
        });
      const text =
        next && "text" in next && typeof next.text === "string"
          ? next.text
          : "I couldn't file that just now.";
        const status = "founderDirectiveStatus" in next ? next.founderDirectiveStatus : undefined;
        if (directive && status === "applied") {
          mutation?.succeedDirective();
        } else if (directive && status === "failed") {
          mutation?.failDirective(text, submit);
        } else if (directive) {
          mutation?.restoreDirective();
        }
        setReply(text);
        setQuery("");
      } catch {
        const message = "Unable to save that change. Try again.";
        if (directive) mutation?.failDirective(message, submit);
        setReply(message);
      }
    };
    startTransition(() => { void submit(); });
  }

  return (
    <details className="hg-cos-ask min-w-0" data-cos-ask-item="" data-cos-ask-ball={packet.ballHolder}>
      <summary className="inline-flex min-h-10 cursor-pointer items-center text-[10px] uppercase tracking-[0.16em] text-[#8d8073] outline-none hover:text-[#ad9164] focus-visible:text-[#efe8de]">
        Ask Sterling
      </summary>
      <form className="min-w-[min(19rem,calc(100vw-3rem))] pb-2" onSubmit={onSubmit}>
      <label htmlFor={inputId} className="sr-only">
        {TODAY_ASK_PLACEHOLDER}
      </label>
      <input
        id={inputId}
        type="text"
        name="ask"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="send"
        placeholder="Tell Sterling what changed…"
        className="hg-cos-ask-input min-h-10 w-full border-0 bg-transparent px-0 text-[14px] text-[#efe8de] outline-none placeholder:text-[#6f675f] focus-visible:text-[#efe8de]"
      />
      {pending ? (
        <p className="mt-2 text-[13px] leading-relaxed text-[#9a8e82]" role="status">
          Looking…
        </p>
      ) : reply ? (
        <p className="mt-2 text-[13px] leading-relaxed text-[#c4b7aa]" data-cos-ask-reply="">
          {reply}
        </p>
      ) : null}
      </form>
    </details>
  );
}
