"use client";

import { useState } from "react";
import type {
  LedgerComparisonPeriod,
  LedgerHistoricalComparison,
} from "../historical-comparison";

function signedDegrees(value: number): string {
  return `${value > 0 ? "+" : ""}${value}°`;
}

export default function LedgerHistoryComparison({
  comparisons,
}: {
  comparisons: readonly LedgerHistoricalComparison[];
}) {
  const [period, setPeriod] = useState<LedgerComparisonPeriod>("1M");
  const selected = comparisons.find((entry) => entry.period === period);
  if (!selected) return null;

  return (
    <section
      className="border-b border-[#e4dbcf] py-16 md:py-20"
      aria-labelledby="ledger-history-comparison-heading"
      data-ledger-history-comparison="true"
    >
      <div className="mx-auto max-w-[920px]">
        <p className="font-sans text-[10px] uppercase tracking-[0.32em] text-[#6d655e]">
          Historical comparison
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h2
              id="ledger-history-comparison-heading"
              className="font-serif text-[1.4rem] font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.55rem]"
            >
              Pressure and reserve, then and now
            </h2>
            <p className="mt-3 max-w-[42rem] text-[0.92rem] leading-[1.8] text-[#6f6760]">
              Comparisons use the latest formal published snapshot on or before
              each target date. The actual comparison date is always shown.
            </p>
          </div>
          <div
            className="flex rounded-full border border-[#d9cfc3] bg-[#faf7f2] p-1"
            aria-label="Historical comparison period"
          >
            {comparisons.map((entry) => (
              <button
                key={entry.period}
                type="button"
                aria-pressed={entry.period === period}
                onClick={() => setPeriod(entry.period)}
                className={`rounded-full px-3 py-2 font-sans text-[10px] uppercase tracking-[0.16em] transition-colors ${
                  entry.period === period
                    ? "bg-[#2f2b27] text-[#faf7f2]"
                    : "text-[#6d655e] hover:text-[#1f1d1a]"
                }`}
              >
                {entry.period}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <article className="rounded-[14px] border border-[#e4dbcf] bg-[#faf7f2]/70 p-6">
            <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-[#6d655e]">
              System Temperature
            </p>
            <p className="mt-4 font-serif text-[2rem] text-[#1f1d1a]">
              {selected.system.currentDegrees}°
            </p>
            <p className="mt-1 text-[0.82rem] text-[#6f6760]">
              Current snapshot · {selected.system.currentDate}
            </p>
            {selected.system.available ? (
              <div className="mt-6 border-t border-[#e4dbcf] pt-5" data-system-history-available="true">
                <p className="text-[0.95rem] text-[#4f4943]">
                  {selected.system.comparisonDegrees}° on {selected.system.comparisonDate}
                </p>
                <p className="mt-2 font-sans text-[10px] uppercase tracking-[0.16em] text-[#6d655e]">
                  {signedDegrees(selected.system.delta ?? 0)} since actual comparison snapshot
                </p>
              </div>
            ) : (
              <div className="mt-6 border-t border-[#e4dbcf] pt-5" data-system-history-available="false">
                <p className="text-[0.92rem] leading-[1.7] text-[#6f6760]">
                  {selected.system.unavailableMessage}
                </p>
              </div>
            )}
            <p className="mt-4 text-[0.78rem] text-[#81786f]">
              {selected.period} target date: {selected.system.targetDate}
            </p>
          </article>

          <article className="rounded-[14px] border border-[#e4dbcf] bg-[#faf7f2]/70 p-6">
            <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-[#6d655e]">
              Buffer Health shadow
            </p>
            <p className="mt-3 text-[0.88rem] leading-[1.7] text-[#6f6760]">
              October 1, 2026 is the first formal Buffer Health baseline. A
              ghost overlay appears only when a prior formal snapshot exists.
            </p>
            <div className="mt-5 space-y-3">
              {selected.buffer.currentDomains.map((domain) => {
                const prior = selected.buffer.comparisonDomains.find(
                  (entry) => entry.id === domain.id,
                );
                return (
                  <div key={domain.id} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3">
                    <span className="text-[0.8rem] text-[#5c554d]">{domain.label}</span>
                    <span className="relative h-2 overflow-visible rounded-full bg-[#e5ddd3]">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full bg-[#7d8f8a]"
                        style={{ width: `${domain.fill ?? 0}%` }}
                        aria-hidden="true"
                      />
                      {selected.buffer.available && prior?.fill !== null && prior ? (
                        <span
                          className="absolute -top-1 h-4 rounded-sm border border-dashed border-[#655d55]/70 bg-[#faf7f2]/30"
                          style={{ width: `${prior.fill}%` }}
                          aria-hidden="true"
                          data-buffer-shadow-overlay={domain.id}
                        />
                      ) : null}
                    </span>
                    <span className="font-sans text-[9px] uppercase tracking-[0.12em] text-[#6d655e]">
                      {domain.state}
                    </span>
                  </div>
                );
              })}
            </div>
            {selected.buffer.available ? (
              <p className="mt-5 text-[0.82rem] text-[#6f6760]" data-buffer-history-available="true">
                Ghost overlay: {selected.buffer.comparisonDate}
              </p>
            ) : (
              <p className="mt-5 text-[0.92rem] leading-[1.7] text-[#6f6760]" data-buffer-history-available="false">
                {selected.buffer.unavailableMessage}
              </p>
            )}
            <p className="mt-3 text-[0.78rem] text-[#81786f]">
              {selected.period} target date: {selected.buffer.targetDate}
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
