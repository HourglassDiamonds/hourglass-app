"use client";

import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import { CLIENT_FIELD_LABELS } from "@/lib/diamond-intelligence";
import type { FaceUpPresenceCopy } from "@/lib/diamond-intelligence/client-performance-copy";
import { CONSUMER_COPY } from "./consumer-display-labels";
import { dashValue } from "./DashboardCard";

export default function ReportMeasurementsSection({
  fields,
  faceUpCopy,
  diameter,
  formatCarat,
}: {
  fields: CalibrationReportFields | null;
  faceUpCopy: FaceUpPresenceCopy | null;
  diameter: string | null;
  formatCarat: (carat: string) => string;
}) {
  if (!fields) return null;

  const lines: string[] = [];

  const push = (label: string, value: string) => {
    if (value && value !== "—") lines.push(`${label}: ${value}`);
  };

  push(CLIENT_FIELD_LABELS.tablePercent, fields.tablePercent?.trim() ? `${fields.tablePercent}%` : "—");
  push(CLIENT_FIELD_LABELS.depthPercent, fields.depthPercent?.trim() ? `${fields.depthPercent}%` : "—");
  push(CLIENT_FIELD_LABELS.crownAngle, fields.crownAngle?.trim() ? `${fields.crownAngle}°` : "—");
  push(CLIENT_FIELD_LABELS.pavilionAngle, fields.pavilionAngle?.trim() ? `${fields.pavilionAngle}°` : "—");
  push(CLIENT_FIELD_LABELS.girdle, dashValue(fields.girdle));
  push(CLIENT_FIELD_LABELS.culet, dashValue(fields.culet));
  push(CLIENT_FIELD_LABELS.polish, dashValue(fields.polish));
  push(CLIENT_FIELD_LABELS.symmetry, dashValue(fields.symmetry));
  push(CLIENT_FIELD_LABELS.fluorescence, dashValue(fields.fluorescence));
  push(CLIENT_FIELD_LABELS.cutGrade, dashValue(fields.cutGrade));
  if (diameter) push("Avg. diameter", `${diameter} mm`);
  push("Measurements", dashValue(fields.measurements));
  push("Carat", formatCarat(fields.carat ?? ""));
  if (faceUpCopy?.summary) lines.push(`Face-up: ${faceUpCopy.summary}`);

  return (
    <section className="border-t border-[#ebe4da]/40 py-5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#c4bbb2]">
        {CONSUMER_COPY.reportMeasurementsTitle}
      </p>
      <div className="mt-3 max-w-3xl text-[10px] leading-[1.6] text-[#756a5f]">
        <p className="mb-2">{CONSUMER_COPY.reportMeasurementsSubcopy}</p>
        <p>{lines.filter((l) => !l.endsWith(": —")).join(" · ")}</p>
      </div>
    </section>
  );
}
