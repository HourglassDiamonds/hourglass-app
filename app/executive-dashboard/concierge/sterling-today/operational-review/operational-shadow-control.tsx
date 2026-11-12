"use client";

import { useActionState, useEffect, useState } from "react";
import { runOperationalShadowAction, type OperationalShadowActionState } from "./actions";

const CACHE_KEY = "continuum:sterling:operational-shadow:v11";

export function OperationalShadowControl() {
  const [state, action, pending] = useActionState(runOperationalShadowAction, null);
  const [cached, setCached] = useState<OperationalShadowActionState>(null);
  useEffect(() => {
    if (!state) return;
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch { /* explicit download remains available */ }
  }, [state]);
  const restore = () => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) setCached(JSON.parse(raw) as OperationalShadowActionState);
    } catch { /* cache is optional */ }
  };
  const result = state ?? cached;
  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "sterling-operational-shadow-v11.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="mt-8 max-w-4xl rounded-3xl border border-[#ad9164]/25 bg-[#17130f] p-6 md:p-8">
      <p className="text-[10px] uppercase tracking-[0.24em] text-[#ad9164]">Founder only · 23 exact threads · shadow read-only</p>
      <h1 className="mt-3 font-serif text-[1.9rem] font-normal tracking-[-0.035em] text-[#efe8de]">Operational v11 comparison</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[#a99c90]">
        One bounded execution retrieves only the server-owned thread set, runs the existing assembler and comparator, and returns a sanitized result. It cannot publish Today or change business records.
      </p>
      <form action={action} className="mt-6">
        <button disabled={pending} className="min-h-11 rounded-xl bg-[#ad9164] px-5 text-[11px] uppercase tracking-[0.15em] text-[#17120e] disabled:opacity-50">
          {pending ? "Running bounded review…" : "Run authorized shadow review once"}
        </button>
      </form>
      {!result ? <button type="button" onClick={restore} className="mt-3 min-h-11 rounded-xl border border-white/15 px-4 text-[11px] uppercase tracking-[0.15em] text-[#c4b7aa]">Restore completed result without rerun</button> : null}
      {result ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5 text-[12px] text-[#c4b7aa]">
          <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-[#a9bd8e]" : "text-[#d39a8a]"}>
            {result.verdict}{result.ok ? "" : ` · ${result.reason}`}
          </p>
          {result.ok ? <button type="button" onClick={download} className="mt-4 min-h-11 rounded-xl border border-white/15 px-4 text-[11px] uppercase tracking-[0.15em]">Download sanitized result</button> : null}
          <details className="mt-4"><summary className="cursor-pointer text-[#ad9164]">Inspect sanitized JSON</summary>
            <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap break-all text-[10px]">{JSON.stringify(result, null, 2)}</pre>
          </details>
          <p className="mt-4 text-[#81766c]">This tab caches only the sanitized response in session storage so refresh does not rerun Gmail or model work.</p>
        </div>
      ) : null}
    </section>
  );
}
