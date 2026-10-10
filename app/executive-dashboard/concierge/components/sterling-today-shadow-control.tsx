"use client";

import { useActionState } from "react";
import {
  runSterlingTodayAssemblyAction,
  runSterlingTodaySemanticAction,
  type SterlingTodayActionState,
} from "../sterling-today-actions";

function Count({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  );
}

function SafeResult({ state }: { state: NonNullable<SterlingTodayActionState> }) {
  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#ad9164]">{state.verdict}</p>
      <dl className="mt-4 space-y-2 text-[13px] text-[#c4b7aa]">
        <Count label="Work units" value={state.counts?.workUnits} />
        <Count label="Eligible" value={state.completeness?.modelEligibleWorkUnitCount} />
        <Count label="Blocked" value={state.completeness?.blockedWorkUnitCount} />
        <Count label="Scoped" value={state.scope?.total} />
        <Count label="Scope unresolved" value={state.scope?.unresolved} />
        <Count label="Gmail requested" value={state.gmail?.requestedThreadCount} />
        <Count label="Gmail completed" value={state.gmail?.completedThreadCount} />
        <Count label="Gmail failed" value={state.gmail?.failedThreadCount} />
        <Count label="Assembly ms" value={state.performance?.assemblyLatencyMs} />
        <Count label="Model ms" value={state.performance?.modelLatencyMs} />
        <Count label="Input tokens" value={state.performance?.tokenUsage?.inputTokens} />
        <Count label="Output tokens" value={state.performance?.tokenUsage?.outputTokens} />
        <Count label="Validation errors" value={state.validation?.errorCount} />
      </dl>
      {state.safeErrors.length ? (
        <p className="mt-4 text-[12px] text-[#9d9084]">Safe status: {state.safeErrors.join(", ")}</p>
      ) : null}
    </div>
  );
}

export function SterlingTodayShadowControl({ semanticAvailable }: { semanticAvailable: boolean }) {
  const [assembly, assemblyAction, assemblyPending] = useActionState(runSterlingTodayAssemblyAction, null);
  const [semantic, semanticAction, semanticPending] = useActionState(runSterlingTodaySemanticAction, null);
  return (
    <section className="mt-8 max-w-2xl rounded-3xl border border-[#ad9164]/25 bg-[#17130f] p-6 md:p-8">
      <p className="text-[10px] uppercase tracking-[0.24em] text-[#ad9164]">Founder shadow execution</p>
      <h1 className="mt-3 font-serif text-[1.9rem] font-normal tracking-[-0.035em] text-[#efe8de]">
        Sterling-native Today
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-[#a99c90]">
        Read-only acceptance. This control does not publish Today or apply canonical changes.
      </p>
      <form action={assemblyAction} className="mt-7">
        <button type="submit" disabled={assemblyPending || semanticPending}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] disabled:text-[#71685f]">
          {assemblyPending ? "Assembling…" : "Run evidence assembly"}
        </button>
      </form>
      {assembly ? <SafeResult state={assembly} /> : null}
      <div className="mt-8 border-t border-white/10 pt-7">
        <form action={semanticAction}>
          <button type="submit" disabled={!semanticAvailable || assemblyPending || semanticPending}
            className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] disabled:text-[#71685f]">
            {semanticPending ? "Reasoning…" : "Run semantic shadow"}
          </button>
        </form>
        <p className="mt-2 text-[12px] text-[#81766c]">
          {semanticAvailable ? "Founder-triggered semantic shadow is available." : "Semantic execution is disabled."}
        </p>
        {semantic ? <SafeResult state={semantic} /> : null}
      </div>
    </section>
  );
}
