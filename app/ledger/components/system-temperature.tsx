/**
 * Ledger System Temperature — hub-only compression component.
 * Do not mount on individual monitor routes.
 */

import Link from "next/link";
import {
  SYSTEM_TEMPERATURE_LEDGER_NOTE,
  SYSTEM_TEMPERATURE_METHODOLOGY_POINTS,
  SYSTEM_TEMPERATURE_METHODOLOGY_SHORT,
  SYSTEM_TEMPERATURE_READING,
  SYSTEM_TEMPERATURE_SCALE_INTRO,
  TEMPERATURE_BANDS,
} from "../system-temperature";

function confidenceLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function SystemTemperature() {
  const reading = SYSTEM_TEMPERATURE_READING;
  const markerPercent = Math.min(100, Math.max(0, reading.degrees));

  return (
    <section
      className="ledger-system-temperature border-b border-[#e4dbcf] py-16 md:py-20"
      aria-labelledby="ledger-system-temperature-heading"
      data-ledger-system-temperature="true"
    >
      <div className="mx-auto max-w-[920px]">
        <p className="font-sans text-[10px] uppercase tracking-[0.32em] text-[#6d655e]">
          Ledger System Temperature
        </p>
        <h2
          id="ledger-system-temperature-heading"
          className="mt-3 font-serif text-[1.4rem] font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.55rem]"
        >
          One reading for system-wide pressure
        </h2>
        <p className="mt-4 max-w-[40rem] text-[0.95rem] leading-[1.85] text-[#6f6760]">
          A governed compression of underlying pressure channels with explicit
          transmission caps. It is not an average of the five monitors below,
          and it is not comparable to archived numerical scores.
        </p>

        <article className="ledger-temp-card mt-10 rounded-[14px] border border-[#e4dbcf] bg-[#faf7f2]/70 p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p
                className="font-serif text-[clamp(3.4rem,8vw,5rem)] font-normal leading-none tracking-[-0.04em] text-[#1f1d1a]"
                aria-label={`${reading.degrees} degrees`}
              >
                {reading.degrees}
                <span className="text-[0.55em]">°</span>
              </p>
              <p className="mt-3 font-sans text-[10px] uppercase tracking-[0.22em] text-[#6d655e]">
                {reading.bandLabel}
              </p>
              <p className="mt-2 font-sans text-[10px] uppercase tracking-[0.18em] text-[#6d655e]">
                {reading.functioningLabel}
              </p>
            </div>
            <div className="max-w-[22rem] text-left md:text-right">
              <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-[#6d655e]">
                Confidence: {confidenceLabel(reading.confidence)}
              </p>
              {reading.weeklyDelta !== null ? (
                <p className="mt-2 font-sans text-[10px] uppercase tracking-[0.14em] text-[#6d655e]">
                  {reading.weeklyDelta > 0 ? "+" : ""}
                  {reading.weeklyDelta}° from the August 12 baseline
                </p>
              ) : reading.baselineLabel ? (
                <p className="mt-2 font-sans text-[10px] uppercase tracking-[0.14em] text-[#6d655e]">
                  {reading.baselineLabel}
                </p>
              ) : null}
              <p className="mt-2 text-[0.88rem] leading-[1.7] text-[#6f6760]">
                Evidence reviewed through {reading.evidenceCutoff}
              </p>
            </div>
          </div>

          <div className="ledger-temp-scale mt-8" aria-hidden="true">
            <div className="relative h-[10px] overflow-visible rounded-full bg-[linear-gradient(90deg,#8a9aa8_0%,#b0b5a8_18%,#c9c0a8_36%,#c6b384_52%,#bd8d55_68%,#985844_84%,#5f2d31_100%)] opacity-80">
              <span
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#3a3632] bg-[#faf7f2] shadow-[0_1px_2px_rgba(28,24,20,0.18)]"
                style={{ left: `${markerPercent}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between font-sans text-[9px] uppercase tracking-[0.14em] text-[#6d655e]">
              <span>0°</span>
              <span>50° normal</span>
              <span>100°</span>
            </div>
          </div>

          <p className="mt-6 max-w-[44rem] text-[0.95rem] leading-[1.85] text-[#5c554d]">
            {reading.explanation}
          </p>

          <div className="mt-8 border-t border-[#e4dbcf] pt-6">
            <p className="font-sans text-[10px] uppercase tracking-[0.28em] text-[#6d655e]">
              Ledger Note
            </p>
            <p className="mt-3 max-w-[44rem] text-[0.95rem] leading-[1.85] text-[#5c554d]">
              {SYSTEM_TEMPERATURE_LEDGER_NOTE}
            </p>
          </div>

          <p className="mt-4 text-[0.88rem] leading-[1.75] text-[#6f6760]">
            {SYSTEM_TEMPERATURE_METHODOLOGY_SHORT}{" "}
            <Link
              href="#ledger-temperature-methodology"
              className="underline decoration-[#d4c9bb] underline-offset-4 hover:text-[#1f1d1a]"
            >
              Methodology
            </Link>
          </p>
        </article>

        <div className="mt-10" data-ledger-temperature-scale-key="true">
          <p className="font-sans text-[10px] uppercase tracking-[0.28em] text-[#6d655e]">
            Temperature ranges
          </p>
          <p className="mt-3 max-w-[40rem] text-[0.92rem] leading-[1.8] text-[#6f6760]">
            {SYSTEM_TEMPERATURE_SCALE_INTRO}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {TEMPERATURE_BANDS.map((band) => (
              <article
                key={band.id}
                className={`rounded-[12px] border border-[#e4dbcf] bg-[#faf7f2]/40 px-4 py-4 ${
                  band.id === reading.band ? "border-[#c4b49a] bg-[#faf7f2]/90" : ""
                }`}
              >
                <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-[#6d655e]">
                  {band.min}–{band.max}° · {band.label}
                </p>
                <p className="mt-2 text-[0.88rem] leading-[1.7] text-[#5c554d]">
                  {band.summary}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div
          id="ledger-temperature-methodology"
          className="mt-12 border-t border-[#e4dbcf] pt-10"
        >
          <p className="font-sans text-[10px] uppercase tracking-[0.28em] text-[#6d655e]">
            Methodology
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {SYSTEM_TEMPERATURE_METHODOLOGY_POINTS.map((point) => (
              <article key={point.title}>
                <h3 className="font-serif text-[1.05rem] font-normal tracking-[-0.02em] text-[#1f1d1a]">
                  {point.title}
                </h3>
                <p className="mt-2 text-[0.9rem] leading-[1.8] text-[#6f6760]">
                  {point.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
