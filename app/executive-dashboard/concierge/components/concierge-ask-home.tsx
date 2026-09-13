import { ASK_UNSUPPORTED_DETAIL } from "@/lib/continuum/client-memory/ask/types";
import type { ConciergeAskMode } from "@/lib/continuum/client-memory/read/presentation";
import { AskConciergeShell } from "./ask-concierge-shell";
import { QuickCapture } from "./quick-capture";

const MODE_COPY: Record<
  ConciergeAskMode,
  { title: string; detail: string; placeholder?: string }
> = {
  conversation: {
    title: "Concierge",
    detail: "A quiet place to ask Continuum, then capture what should be remembered.",
  },
  "brain-dump": {
    title: "Brain Dump",
    detail: "Get it out of your head. Capture first.",
  },
  design: {
    title: "Design Mode",
    detail: "Ask about a piece, a spec, or a design decision.",
    placeholder: "Ask about a design, spec, or piece…",
  },
};

export function ConciergeAskHome({
  mode = "conversation",
  initialQuery = "",
}: {
  mode?: ConciergeAskMode;
  initialQuery?: string;
}) {
  const copy = MODE_COPY[mode] ?? MODE_COPY.conversation;
  const captureFirst = mode === "brain-dump";

  return (
    <div data-concierge-ask className="hg-concierge-fade flex min-w-0 flex-col gap-12">
      <div>
        <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#efe8de]">
          {copy.title}
        </h1>
        <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          {copy.detail}
        </p>
        {mode === "conversation" ? (
          <p className="mt-3 max-w-[36ch] text-[13px] leading-relaxed text-[#7d7268]">
            {ASK_UNSUPPORTED_DETAIL}
          </p>
        ) : null}
        {captureFirst ? (
          <div className="mt-8">
            <QuickCapture />
          </div>
        ) : (
          <div className="mt-8">
            <AskConciergeShell
              initialQuery={initialQuery}
              placeholder={copy.placeholder}
            />
          </div>
        )}
      </div>
      {captureFirst ? (
        <AskConciergeShell initialQuery={initialQuery} placeholder={copy.placeholder} />
      ) : (
        <QuickCapture />
      )}
    </div>
  );
}
