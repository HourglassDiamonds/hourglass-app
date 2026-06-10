"use client";

import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import type { ReportGradeHints } from "@/lib/diamond-intelligence/report-grade-hints";
import type { ClientSafeMetadata } from "@/lib/diamond-intelligence";
import { dashValue } from "./DashboardCard";
import {
  DI_EDITORIAL_CARD,
  DI_EYEBROW_STUDIO,
  DI_SERIF_HEADLINE,
} from "./di-studio-styles";

type DossierRow = { label: string; value: string };

function buildRows(input: {
  metadata: ClientSafeMetadata;
  fields: CalibrationReportFields;
  gradeHints?: ReportGradeHints;
  formatCarat: (carat: string) => string;
}): DossierRow[] {
  const color = input.gradeHints?.color?.trim();
  const clarity = input.gradeHints?.clarity?.trim();
  const colorClarity =
    color || clarity
      ? [color, clarity].filter(Boolean).join(" / ")
      : "—";

  const rows: DossierRow[] = [
    { label: "Laboratory", value: input.metadata.lab || "—" },
    { label: "Report number", value: dashValue(input.metadata.reportNumber) },
    { label: "Shape", value: dashValue(input.fields.shape) },
    { label: "Carat weight", value: input.formatCarat(input.fields.carat ?? "") },
    { label: "Color / clarity", value: colorClarity },
  ];

  const measurements = input.fields.measurements?.trim();
  if (measurements) {
    rows.push({ label: "Measurements", value: measurements });
  }

  return rows;
}

export default function ReportDossier({
  metadata,
  fields,
  gradeHints,
  formatCarat,
  compact = false,
  className = "",
}: {
  metadata: ClientSafeMetadata;
  fields: CalibrationReportFields;
  gradeHints?: ReportGradeHints;
  formatCarat: (carat: string) => string;
  compact?: boolean;
  className?: string;
}) {
  const rows = buildRows({ metadata, fields, gradeHints, formatCarat });

  return (
    <section
      className={`${compact ? "" : `${DI_EDITORIAL_CARD} sticky top-8 p-7`} ${className}`}
    >
      <p className={DI_EYEBROW_STUDIO}>Report Dossier</p>
      <dl className={`${compact ? "mt-4" : "mt-6"} space-y-4`}>
        {rows.map((row) => (
          <div key={row.label} className="border-t border-[#e6dacb] pt-3">
            <dt className="text-[10px] uppercase tracking-[0.22em] text-[#9a8673]">
              {row.label}
            </dt>
            <dd className={`mt-1 ${DI_SERIF_HEADLINE} ${compact ? "text-base" : "text-lg"} text-[#241c17]`}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
