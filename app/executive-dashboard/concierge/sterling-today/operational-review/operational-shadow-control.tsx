"use client";

import { useState } from "react";
import {
  PRODUCTION_STAGING_OPERATIONAL_SHADOW_RESULT_ROUTE,
  PRODUCTION_STAGING_OPERATIONAL_SHADOW_RUN_ROUTE,
} from "@/lib/continuum/production-staging-access";
import type { OperationalShadowResult } from "@/lib/continuum/today-sterling/operational-shadow-review";

const CACHE_KEY = "continuum:sterling:operational-shadow:v11";

export function OperationalShadowControl() {
  const [result, setResult] = useState<OperationalShadowResult | null>(null);
  const [pending, setPending] = useState(false);
  const request = async (method: "POST" | "GET" | "DELETE") => {
    setPending(true);
    try {
      const route = method === "POST"
        ? PRODUCTION_STAGING_OPERATIONAL_SHADOW_RUN_ROUTE
        : PRODUCTION_STAGING_OPERATIONAL_SHADOW_RESULT_ROUTE;
      const response = await fetch(route, { method, credentials: "same-origin", cache: "no-store" });
      const next = await response.json() as OperationalShadowResult | { ok: true; status: "deleted" } | { ok: false; reason: string };
      if (method === "DELETE") {
        if (response.ok && next.ok && "status" in next && next.status === "deleted") {
          sessionStorage.removeItem(CACHE_KEY);
          setResult(null);
        } else {
          setResult({ ok: false, verdict: "UNAVAILABLE", reason: "result-cleanup-failed" });
        }
      } else {
        const shadow = next as OperationalShadowResult;
        setResult(shadow);
        if (shadow.ok) sessionStorage.setItem(CACHE_KEY, JSON.stringify(shadow));
      }
    } catch {
      setResult({ ok: false, verdict: "UNAVAILABLE", reason: "shadow-request-failed" });
    } finally {
      setPending(false);
    }
  };
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
      <div className="mt-6">
        <button type="button" onClick={() => void request("POST")} disabled={pending} className="min-h-11 rounded-xl bg-[#ad9164] px-5 text-[11px] uppercase tracking-[0.15em] text-[#17120e] disabled:opacity-50">
          {pending ? "Running bounded review…" : "Run authorized shadow review once"}
        </button>
      </div>
      {!result ? <button type="button" onClick={() => void request("GET")} disabled={pending} className="mt-3 min-h-11 rounded-xl border border-white/15 px-4 text-[11px] uppercase tracking-[0.15em] text-[#c4b7aa]">Restore durable result without rerun</button> : null}
      {result ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5 text-[12px] text-[#c4b7aa]">
          <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-[#a9bd8e]" : "text-[#d39a8a]"}>
            {result.verdict}{result.ok ? "" : ` · ${result.reason}`}
          </p>
          {result.ok ? <><button type="button" onClick={download} className="mt-4 min-h-11 rounded-xl border border-white/15 px-4 text-[11px] uppercase tracking-[0.15em]">Download sanitized result</button>
            <button type="button" onClick={() => void request("DELETE")} disabled={pending} className="ml-3 mt-4 min-h-11 rounded-xl border border-[#d39a8a]/40 px-4 text-[11px] uppercase tracking-[0.15em] text-[#d39a8a]">Delete retained result</button></> : null}
          <details className="mt-4"><summary className="cursor-pointer text-[#ad9164]">Inspect sanitized JSON</summary>
            <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap break-all text-[10px]">{JSON.stringify(result, null, 2)}</pre>
          </details>
          <p className="mt-4 text-[#81766c]">The sanitized result is founder-bound and recoverable for at most 24 hours without rerunning Gmail or model work. Download it, then delete the retained copy.</p>
        </div>
      ) : null}
    </section>
  );
}
