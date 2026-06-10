"use client";

import { useState } from "react";
import type { ReportGradeHints } from "@/lib/diamond-intelligence/report-grade-hints";
import {
  DI_V3_BRAND,
  DI_V3_PARTIAL_CARD,
  DI_V3_PRODUCT,
} from "./di-v3-styles";
import {
  hasUsableDisplayColor,
  isListedPartialColor,
  PARTIAL_CLARITY_GRADES,
  PARTIAL_COLOR_RANGE_GRADES,
  PARTIAL_COLOR_SINGLE_GRADES,
} from "./v3-presentation";

const SELECT_CLASS =
  "w-full appearance-none border border-[rgba(58,48,38,0.28)] bg-[rgba(255,255,255,0.55)] px-4 py-4 font-serif text-lg text-[#1e1a16] outline-none transition-[border-color,box-shadow] focus:border-[rgba(181,150,98,0.55)] focus:shadow-[0_0_0_3px_rgba(181,150,98,0.12)]";

export default function DiV3PartialGradeReview({
  gradeHints,
  onComplete,
}: {
  gradeHints?: ReportGradeHints;
  onComplete: (hints: ReportGradeHints) => void;
}) {
  const [color, setColor] = useState(gradeHints?.color ?? "");
  const [clarity, setClarity] = useState(gradeHints?.clarity ?? "");

  const extractedColor = gradeHints?.color?.trim() ?? "";
  const showExtractedColorOption =
    Boolean(extractedColor) &&
    hasUsableDisplayColor(extractedColor) &&
    !isListedPartialColor(extractedColor);

  function handleSubmit() {
    if (!color.trim() || !clarity.trim()) return;
    onComplete({ ...gradeHints, color: color.trim(), clarity: clarity.trim() });
  }

  const canSubmit = Boolean(color.trim() && clarity.trim());

  return (
    <article className={DI_V3_PARTIAL_CARD}>
      <div className="mb-8">
        <div className={DI_V3_BRAND}>Hourglass Diamonds</div>
        <div className={`${DI_V3_PRODUCT} mt-3.5`}>Diamond Intelligence</div>
      </div>

      <p className="text-[11px] uppercase tracking-[0.18em] text-[#9b8b78]">
        Concierge Review
      </p>

      <h1 className="mt-4 font-serif text-[clamp(34px,5.5vw,52px)] font-normal uppercase leading-[0.98] tracking-[0.035em] text-[#1e1a16]">
        Missing Information Needed
      </h1>

      <p className="mx-auto mt-6 max-w-[520px] text-[17px] leading-[1.72] text-[#6f665b]">
        We were able to read most of the report, but a few grading details could
        not be verified automatically.
      </p>

      <div className="mx-auto mt-10 max-w-[520px] text-left">
        <p className="mb-4 text-[11px] uppercase tracking-[0.14em] text-[#9b8b78]">
          To complete your assessment
        </p>
        <ul className="mb-8 grid list-none gap-2.5 p-0 text-[15px] text-[#514536]">
          <li className="relative pl-5">
            <span className="absolute left-0 text-[#b59662]">•</span>
            Color Grade
          </li>
          <li className="relative pl-5">
            <span className="absolute left-0 text-[#b59662]">•</span>
            Clarity Grade
          </li>
        </ul>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-[18px] border border-[rgba(181,150,98,0.28)] bg-[rgba(255,255,255,0.35)] p-5 text-left">
            <label className="block">
              <span className="mb-3 block text-[11px] uppercase tracking-[0.13em] text-[#9b8b78]">
                Color Grade
              </span>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Select color</option>
                {showExtractedColorOption ? (
                  <option value={extractedColor}>
                    {extractedColor} (from report)
                  </option>
                ) : null}
                <optgroup label="Single grades">
                  {PARTIAL_COLOR_SINGLE_GRADES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Range grades">
                  {PARTIAL_COLOR_RANGE_GRADES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          </div>

          <div className="rounded-[18px] border border-[rgba(181,150,98,0.28)] bg-[rgba(255,255,255,0.35)] p-5 text-left">
            <label className="block">
              <span className="mb-3 block text-[11px] uppercase tracking-[0.13em] text-[#9b8b78]">
                Clarity Grade
              </span>
              <select
                value={clarity}
                onChange={(e) => setClarity(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Select clarity</option>
                {PARTIAL_CLARITY_GRADES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-10 border border-[#b59662] bg-[rgba(181,150,98,0.14)] px-6 py-4 text-sm tracking-[0.06em] text-[#1e1a16] transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Complete Assessment →
      </button>
    </article>
  );
}
