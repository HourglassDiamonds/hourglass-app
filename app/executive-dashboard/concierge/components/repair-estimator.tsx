"use client";

import { useState, useTransition, type FormEvent } from "react";
import { searchGellerLines } from "../repair-quote-actions";
import { estimateRepairPrompt } from "../repair-estimate-actions";
import type { RepairEstimate, RepairEstimateOutcome } from "@/lib/continuum/repair-estimator/types";

function EstimateBody({ estimate }: { estimate: RepairEstimate }) {
  return (
    <div data-repair-estimate className="mt-8 border-t border-white/10 pt-6">
      <p
        data-repair-retail-caption
        className={
          estimate.retailCaption === "Estimated retail"
            ? "text-[11px] uppercase tracking-[0.28em] text-[#8d8073]"
            : "text-[15px] leading-relaxed text-[#efe8de]"
        }
      >
        {estimate.retailCaption}
      </p>
      <p className="mt-2 font-serif text-[2.4rem] leading-none tracking-[-0.04em] text-[#efe8de]">
        {estimate.totalLabel}
      </p>
      <ul className="mt-5 space-y-1 text-[15px] text-[#efe8de]">
        {estimate.specs.map((spec) => (
          <li key={spec}>{spec}</li>
        ))}
      </ul>
      {estimate.includes.length > 0 ? (
        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#8d8073]">Includes</p>
          <ul className="mt-2 space-y-1 text-[14px] text-[#c4b7aa]">
            {estimate.includes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {estimate.assumptions.length > 0 ? (
        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#8d8073]">Assumptions</p>
          <ul className="mt-2 space-y-1 text-[14px] text-[#c4b7aa]">
            {estimate.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {estimate.inspectionFlags.length > 0 ? (
        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#8d8073]">Needs inspection</p>
          <ul className="mt-2 space-y-1 text-[14px] text-[#c4b7aa]">
            {estimate.inspectionFlags.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <details className="mt-6">
        <summary className="cursor-pointer text-[11px] uppercase tracking-[0.22em] text-[#ad9164]">
          Price basis
        </summary>
        <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-[#c4b7aa]">
          {estimate.assumptions
            .filter((item) => item.startsWith("Hourglass pricing rule:"))
            .map((item) => (
              <p key={item}>{item}</p>
            ))}
          <p>
            {estimate.source.editionLabel}. {estimate.source.exportFile}.
          </p>
          <p>{estimate.source.pricingBasis}</p>
          <p>Raw book total {estimate.rawLabel}. Estimated retail {estimate.totalLabel}.</p>
          <ul className="space-y-3">
            {estimate.lineItems.map((line) => (
              <li key={`${line.sourceTask}-${line.detail}`}>
                <p className="text-[#efe8de]">
                  {line.label} · {line.detail} · {line.lineLabel}
                </p>
                <p>
                  Base {line.baseLabel}
                  {line.modifierLabel ? ` ${line.modifierLabel}` : ""}
                  {line.modifierReason ? `. ${line.modifierReason}` : ""}
                </p>
                <p>{line.sourceTask}</p>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}

export function RepairEstimator() {
  const [prompt, setPrompt] = useState("");
  const [outcome, setOutcome] = useState<RepairEstimateOutcome | { status: "unauthorized" } | null>(
    null,
  );
  const [browseQuery, setBrowseQuery] = useState("");
  const [browseHits, setBrowseHits] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function onEstimate(event: FormEvent) {
    event.preventDefault();
    const next = prompt.trim();
    if (!next) return;
    startTransition(async () => {
      setOutcome(await estimateRepairPrompt(next));
    });
  }

  function onBrowse(event: FormEvent) {
    event.preventDefault();
    const next = browseQuery.trim();
    if (!next) return;
    startTransition(async () => {
      const result = await searchGellerLines(next);
      setBrowseHits(result.hits.map((hit) => hit.taskDescription));
    });
  }

  return (
    <section data-repair-estimator className="mt-8">
      <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">Repair estimator</h2>
      <form onSubmit={onEstimate} className="mt-4">
        <label htmlFor="repair-estimate-prompt" className="block text-[15px] text-[#efe8de]">
          Ask about a repair
        </label>
        <input
          id="repair-estimate-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="14KY 2mm shank, size 6 to 7.75"
          className="mt-3 w-full border-b border-white/15 bg-transparent py-3 text-[16px] text-[#efe8de] outline-none placeholder:text-[#7d7268]"
          autoComplete="off"
        />
        <p className="mt-3 text-[13px] text-[#7d7268]">Example: “14KY 2mm shank, size 6 to 7.75”</p>
        <button
          type="submit"
          disabled={pending}
          className="mt-4 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164]"
        >
          {pending ? "Estimating" : "Estimate"}
        </button>
      </form>

      {outcome?.status === "unauthorized" ? (
        <p className="mt-6 text-[15px] text-[#c4b7aa]">Sign in to continue.</p>
      ) : null}
      {outcome?.status === "estimate" ? <EstimateBody estimate={outcome.estimate} /> : null}
      {outcome?.status === "clarification" ? (
        <p data-repair-clarification className="mt-6 max-w-[42ch] text-[15px] leading-relaxed text-[#efe8de]">
          {outcome.question}
        </p>
      ) : null}
      {outcome?.status === "no_reliable_estimate" ? (
        <p data-repair-no-estimate className="mt-6 max-w-[42ch] text-[15px] leading-relaxed text-[#efe8de]">
          {outcome.reason}
        </p>
      ) : null}

      <details className="mt-8">
        <summary className="cursor-pointer text-[11px] uppercase tracking-[0.22em] text-[#8d8073]">
          Browse repair book
        </summary>
        <form onSubmit={onBrowse} className="mt-4">
          <label htmlFor="repair-book-browse" className="text-[13px] text-[#c4b7aa]">
            Search the repair book. This does not save a quote.
          </label>
          <input
            id="repair-book-browse"
            value={browseQuery}
            onChange={(event) => setBrowseQuery(event.target.value)}
            className="mt-2 w-full border-b border-white/10 bg-transparent py-2 text-[15px] text-[#efe8de] outline-none"
          />
        </form>
        <ul className="mt-4 space-y-2 text-[13px] text-[#c4b7aa]">
          {browseHits.map((hit) => (
            <li key={hit}>{hit}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
