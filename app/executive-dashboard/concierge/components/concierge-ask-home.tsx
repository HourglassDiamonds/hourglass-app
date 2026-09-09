import { ASK_UNSUPPORTED_DETAIL } from "@/lib/continuum/client-memory/ask/types";
import { AskConciergeShell } from "./ask-concierge-shell";
import { QuickCapture } from "./quick-capture";

export function ConciergeAskHome() {
  return (
    <div data-concierge-ask className="hg-concierge-fade flex min-w-0 flex-col gap-12">
      <div>
        <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#efe8de]">
          Concierge
        </h1>
        <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          A quiet place to ask Continuum, then capture what should be remembered.
        </p>
        <p className="mt-3 max-w-[36ch] text-[13px] leading-relaxed text-[#7d7268]">
          {ASK_UNSUPPORTED_DETAIL}
        </p>
        <div className="mt-8">
          <AskConciergeShell />
        </div>
      </div>
      <QuickCapture />
    </div>
  );
}
