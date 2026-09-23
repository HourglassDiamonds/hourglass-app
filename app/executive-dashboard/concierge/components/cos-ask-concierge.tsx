"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import type { TodayBriefingPacket } from "@/lib/continuum/chief-of-staff/operating-loop/briefing-packet";
import type { CosBriefingV1 } from "@/lib/continuum/chief-of-staff/operating-loop/cos-briefing-v1";
import { TODAY_ASK_PLACEHOLDER } from "@/lib/continuum/chief-of-staff/operating-loop/briefing-ask";

export type TodayAskAction = (input: {
  query: string;
  mode?: "brain-dump" | "conversation" | "design";
  todayContext: {
    itemId: string;
    packet: TodayBriefingPacket;
    briefing?: CosBriefingV1 | null;
  };
}) => Promise<{ text?: string } | { kind: string }>;

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

  if (!askAction) {
    return (
      <p className="hg-cos-ask mt-4 min-w-0 text-[14px] text-[#6f675f]" data-cos-ask-item="">
        {TODAY_ASK_PLACEHOLDER}
      </p>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || !askAction) return;
    startTransition(async () => {
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
      setReply(text);
      setQuery("");
    });
  }

  return (
    <form
      className="hg-cos-ask mt-4 min-w-0"
      onSubmit={onSubmit}
      data-cos-ask-item=""
      data-cos-ask-ball={packet.ballHolder}
    >
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
        placeholder={TODAY_ASK_PLACEHOLDER}
        className="hg-cos-ask-input min-h-11 w-full border-0 bg-transparent px-0 text-[14px] text-[#efe8de] outline-none placeholder:text-[#6f675f] focus-visible:text-[#efe8de]"
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
  );
}
