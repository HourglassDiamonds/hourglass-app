"use client";

import { DashboardCard } from "./DashboardCard";

const CAN_REVIEW = [
  "Report-based proportion analysis",
  "Optical architecture from available measurements",
  "Face-up presence and weight distribution",
  "Risk signals from clarity, color, fluorescence, finish, and missing data",
] as const;

const CANNOT_CONFIRM = [
  "Whether the diamond is eye-clean",
  "Real-world transparency",
  "Actual video performance",
  "Optical imaging results such as ASET or IdealScope",
  "Certain light leakage, obstruction, or patterning behaviors",
] as const;

export default function ReportStartingPointPanel({
  visible,
}: {
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <section className="mb-5 rounded-lg border border-[#e4dbcf]/55 bg-[#fdfbf7]/90 px-5 py-5 md:px-6 md:py-6">
      <p className="text-[11px] tracking-[0.18em] text-[#a8926a]">
        How to read this
      </p>
      <h2 className="mt-1.5 font-serif text-[1.15rem] font-normal tracking-[-0.01em] text-[#1f1d1a] md:text-[1.2rem]">
        A Report Is the Starting Point
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-[1.7] text-[#5f5851]">
        A grading report is one important part of evaluating a diamond, but it
        does not tell the entire story. This analysis reviews the information
        available on the report itself — proportions, visual presence, risk
        factors, and recommendation context.
      </p>
      <p className="mt-3 max-w-3xl text-sm leading-[1.7] text-[#5f5851]">
        The strongest diamond decisions combine report analysis with direct
        review whenever possible.
      </p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-medium tracking-[0.12em] text-[#6b5048]">
            What this analysis can review
          </p>
          <ul className="mt-2.5 space-y-1.5 text-[13px] leading-[1.65] text-[#5f5851]">
            {CAN_REVIEW.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-[#c4b08a]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-[0.12em] text-[#6b5048]">
            What a report cannot fully confirm
          </p>
          <ul className="mt-2.5 space-y-1.5 text-[13px] leading-[1.65] text-[#5f5851]">
            {CANNOT_CONFIRM.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-[#948a80]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
