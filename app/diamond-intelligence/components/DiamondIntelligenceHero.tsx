"use client";

import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import type { DiamondDecisionProfile } from "@/lib/diamond-intelligence/diamond-decision-profile";
import type { ReportGradeHints } from "@/lib/diamond-intelligence/report-grade-hints";
import type { ClientSafeMetadata } from "@/lib/diamond-intelligence";
import DiEditorialFacetMotif from "./DiEditorialFacetMotif";
import { DI_EYEBROW_STUDIO, DI_SERIF_HEADLINE } from "./di-studio-styles";

function formatReportReviewLine(input: {
  metadata: ClientSafeMetadata;
  fields: CalibrationReportFields;
  gradeHints?: ReportGradeHints;
}): string {
  const lab = input.metadata.lab?.trim() || "—";
  const shape = input.fields.shape?.trim() || "—";
  const caratRaw = input.fields.carat?.trim();
  const carat = caratRaw
    ? caratRaw.includes("ct")
      ? caratRaw.replace(/\s*ct\s*$/i, "")
      : caratRaw
    : "—";
  const color = input.gradeHints?.color?.trim() || "—";
  const clarity = input.gradeHints?.clarity?.trim() || "—";
  return `Report reviewed: ${lab} · ${shape} · ${carat} ct · ${color} / ${clarity}`;
}

export default function DiamondIntelligenceHero({
  verdictLabel,
  personalityDescriptor,
  interpretationSummary,
  decisionProfile,
  metadata,
  fields,
  gradeHints,
}: {
  verdictLabel: string;
  personalityDescriptor: string;
  interpretationSummary: string;
  decisionProfile: DiamondDecisionProfile;
  metadata: ClientSafeMetadata;
  fields: CalibrationReportFields;
  gradeHints?: ReportGradeHints;
  formatCarat?: (carat: string) => string;
}) {
  const humanInterpretation = [personalityDescriptor, interpretationSummary]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="relative py-4 md:py-6 lg:py-8">
      <DiEditorialFacetMotif variant="hero" />

      <div className="relative">
        <p className={DI_EYEBROW_STUDIO}>Diamond Intelligence</p>

        <h1
          className={`${DI_SERIF_HEADLINE} mt-5 max-w-4xl text-6xl leading-[1.02] tracking-[-0.03em] xl:text-7xl xl:leading-[1.02]`}
          style={{ textWrap: "balance" }}
        >
          {verdictLabel}
        </h1>

        <p
          className="mt-8 max-w-3xl text-xl leading-9 text-[#5b4d43] md:mt-10 md:max-w-4xl md:text-[1.35rem] md:leading-[2rem]"
          style={{ textWrap: "balance" }}
        >
          {humanInterpretation}
        </p>

        <div className="mt-12 max-w-3xl border-t border-[#e6dacb]/80 pt-8 md:mt-14 md:max-w-4xl">
          <p className="text-sm leading-6 text-[#75675e]">
            {formatReportReviewLine({ metadata, fields, gradeHints })}
          </p>
          <p className="mt-3 font-serif text-lg italic leading-8 text-[#3b3029] md:text-xl">
            {decisionProfile.overallRecommendation.explanation}
          </p>
        </div>
      </div>
    </section>
  );
}
