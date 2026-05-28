"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CalibrationReportFields, ReportFieldKey } from "@/lib/calibration-library/types";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import {
  CLIENT_CULET_OPTIONS,
  CLIENT_FIELD_HINTS,
  CLIENT_FIELD_LABELS,
  CLIENT_GIRDLE_OPTIONS,
  assessReportCapability,
  assessSuspiciousProportionCombinations,
  buildClientInterpretationSnapshot,
  isClientManualFieldKey,
  validateClientManualField,
  type ClientSafeReportCapability,
} from "@/lib/diamond-intelligence";

const SURFACE =
  "rounded-lg border border-[#d4c4a8]/45 bg-[#faf7f2]/90 shadow-[0_4px_16px_rgba(168,146,106,0.06)] ring-1 ring-[#e8dcc8]/50";
const INPUT =
  "mt-1 w-full rounded-sm border border-[#e4dbcf]/80 bg-white/80 px-2.5 py-1.5 text-sm text-[#1f1d1a] outline-none focus:border-[#b8a99a]";

export type GuidedReportCompletionProps = {
  extractedFields: CalibrationReportFields;
  capability?: ClientSafeReportCapability;
  onInterpretationUpdate?: (
    snapshot: ReturnType<typeof buildClientInterpretationSnapshot>,
  ) => void;
  conciergeHref?: string;
};

export default function GuidedReportCompletion({
  extractedFields,
  capability: capabilityProp,
  onInterpretationUpdate,
  conciergeHref = "/concierge",
}: GuidedReportCompletionProps) {
  const capability =
    capabilityProp ?? assessReportCapability({ fields: extractedFields });

  const fieldsToAsk = capability.guidedCompletionFields;
  const showExpertDiagramNote = capability.needsExpertDiagramReview;

  const [draft, setDraft] = useState<Partial<CalibrationReportFields>>({});
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<ReportFieldKey, string>>
  >({});
  const [comboWarnings, setComboWarnings] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const shortBody = useMemo(() => {
    const n = fieldsToAsk.length;
    if (n === 0) return null;
    const names = fieldsToAsk
      .slice(0, 3)
      .map((k) => CLIENT_FIELD_LABELS[k])
      .join(", ");
    const more = n > 3 ? ` +${n - 3} more` : "";
    return `From your report: ${names}${more}.`;
  }, [fieldsToAsk]);

  if (fieldsToAsk.length === 0 && !showExpertDiagramNote) {
    return null;
  }

  if (fieldsToAsk.length === 0 && showExpertDiagramNote) {
    return (
      <div className={`${SURFACE} px-4 py-3.5 md:px-5 md:py-4`}>
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#a8926a]">
          Deeper optical read
        </p>
        <p className="mt-1 font-serif text-base text-[#1f1c19]">
          Diagram details are best verified by an expert
        </p>
        <p className="mt-2 text-xs leading-snug text-[#6f665d]">
          A deeper optical review requires additional diagram details that are
          not always easy to read from a report. Justin can verify those
          details for you.
        </p>
        <Link
          href={conciergeHref}
          className="mt-3 inline-flex rounded-full bg-[#2b2723] px-4 py-2 text-[9px] uppercase tracking-[0.24em] text-white transition-opacity hover:opacity-90"
          onClick={() =>
            trackConsultationCtaClicked(
              "diamond_intelligence:expert_diagram_review",
            )
          }
        >
          Have Justin verify the deeper optical details
        </Link>
      </div>
    );
  }

  function updateDraft(key: ReportFieldKey, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSubmitted(false);
  }

  function validateDraft(): boolean {
    const errors: Partial<Record<ReportFieldKey, string>> = {};
    const numericForCombo: Parameters<
      typeof assessSuspiciousProportionCombinations
    >[0] = {};

    for (const key of fieldsToAsk) {
      const raw = draft[key]?.trim() ?? "";
      if (!raw) continue;
      if (!isClientManualFieldKey(key)) continue;
      const result = validateClientManualField(key, raw);
      if (!result.ok) {
        errors[key] = result.error;
      } else if (key in numericForCombo || key === "tablePercent") {
        numericForCombo[key as keyof typeof numericForCombo] = result.normalized;
      }
    }

    setFieldErrors(errors);
    setComboWarnings(assessSuspiciousProportionCombinations(numericForCombo));

    const hasAnyInput = fieldsToAsk.some((k) => draft[k]?.trim());
    if (!hasAnyInput) {
      errors[fieldsToAsk[0]!] = "Add one value or ask Justin to review.";
    }

    return Object.keys(errors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateDraft()) return;

    const normalized: Partial<CalibrationReportFields> = {};
    for (const key of fieldsToAsk) {
      const raw = draft[key]?.trim();
      if (!raw || !isClientManualFieldKey(key)) continue;
      const result = validateClientManualField(key, raw);
      if (result.ok) normalized[key] = result.normalized;
    }

    const snapshot = buildClientInterpretationSnapshot({
      extractedFields,
      clientCompletedFields: normalized,
    });
    setSubmitted(true);
    onInterpretationUpdate?.(snapshot);
  }

  return (
    <div className={`${SURFACE} px-4 py-3.5 md:px-5 md:py-4`}>
      <p className="text-[10px] uppercase tracking-[0.28em] text-[#a8926a]">
        Optional refinement
      </p>
      <p className="mt-1 font-serif text-base text-[#1f1c19]">
        A few details would make this interpretation stronger
      </p>
      {shortBody ? (
        <p className="mt-1 text-xs leading-snug text-[#6f665d]">{shortBody}</p>
      ) : null}

      {showExpertDiagramNote ? (
        <p className="mt-2 text-xs leading-snug text-[#6f665d]">
          A deeper optical review requires additional diagram details that are
          not always easy to read from a report. Justin can verify those
          details for you.
        </p>
      ) : null}

      <form className="mt-3" onSubmit={handleSubmit}>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {fieldsToAsk.map((key) => (
            <label
              key={key}
              className="block text-[9px] uppercase tracking-[0.24em] text-[#948a80]"
            >
              {CLIENT_FIELD_LABELS[key]}
              {key === "girdle" ? (
                <select
                  className={INPUT}
                  value={draft[key] ?? ""}
                  onChange={(e) => updateDraft(key, e.target.value)}
                >
                  <option value="">Select</option>
                  {CLIENT_GIRDLE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : key === "culet" ? (
                <select
                  className={INPUT}
                  value={draft[key] ?? ""}
                  onChange={(e) => updateDraft(key, e.target.value)}
                >
                  <option value="">Select</option>
                  {CLIENT_CULET_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={INPUT}
                  inputMode="decimal"
                  value={draft[key] ?? ""}
                  onChange={(e) => updateDraft(key, e.target.value)}
                  placeholder={CLIENT_FIELD_HINTS[key]}
                />
              )}
              {fieldErrors[key] ? (
                <span className="mt-0.5 block text-[10px] normal-case tracking-normal text-[#8a4a3a]">
                  {fieldErrors[key]}
                </span>
              ) : null}
            </label>
          ))}
        </div>

        {comboWarnings.map((w) => (
          <p key={w} className="mt-2 text-[10px] leading-snug text-[#6b5048]">
            {w}
          </p>
        ))}

        <p className="mt-2 text-[10px] leading-snug text-[#948a80]">
          For this interpretation only — not a laboratory grade.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-full bg-[#2b2723] px-4 py-2 text-[9px] uppercase tracking-[0.24em] text-white transition-opacity hover:opacity-90"
          >
            Update interpretation
          </button>
          <Link
            href={conciergeHref}
            className="text-[9px] uppercase tracking-[0.22em] text-[#6b5048] underline underline-offset-2"
            onClick={() =>
              trackConsultationCtaClicked(
                "diamond_intelligence:guided_completion",
              )
            }
          >
            Have Justin review this diamond
          </Link>
        </div>

        {submitted ? (
          <p className="mt-2 text-xs text-[#5f5851]">Interpretation updated.</p>
        ) : null}
      </form>
    </div>
  );
}
