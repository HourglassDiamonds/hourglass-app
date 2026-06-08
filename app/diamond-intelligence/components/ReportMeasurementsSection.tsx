"use client";

import type { ReactNode } from "react";
import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import { CLIENT_FIELD_LABELS } from "@/lib/diamond-intelligence";
import type { FaceUpPresenceCopy } from "@/lib/diamond-intelligence/client-performance-copy";
import { CONSUMER_COPY } from "./consumer-display-labels";
import { dashValue } from "./DashboardCard";

function CompactMetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#ebe4da]/35 py-2 text-[12px] last:border-0">
      <span className="text-[#948a80]">{label}</span>
      <span className="shrink-0 text-right font-medium text-[#5f5851]">{value}</span>
    </div>
  );
}

function CompactPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#ebe4da]/30 bg-white/20 px-3.5 py-3 md:px-4 md:py-3.5">
      <p className="text-[9px] uppercase tracking-[0.22em] text-[#b8afa6]">{title}</p>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

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

  return (
    <section className="rounded-lg border border-[#ebe4da]/30 bg-white/15 px-3.5 py-3.5 md:px-4 md:py-4">
      <p className="text-[9px] uppercase tracking-[0.2em] text-[#c4bbb2]">
        {CONSUMER_COPY.reportMeasurementsTitle}
      </p>
      <p className="mt-1.5 text-[11px] leading-[1.55] text-[#b0a698]">
        {CONSUMER_COPY.reportMeasurementsSubcopy}
      </p>
      <div className="mt-3 grid gap-2.5 md:grid-cols-3 md:gap-3">
        <CompactPanel title="Proportions">
          <CompactMetricRow
            label={CLIENT_FIELD_LABELS.tablePercent}
            value={fields.tablePercent?.trim() ? `${fields.tablePercent}%` : "—"}
          />
          <CompactMetricRow
            label={CLIENT_FIELD_LABELS.depthPercent}
            value={fields.depthPercent?.trim() ? `${fields.depthPercent}%` : "—"}
          />
          <CompactMetricRow
            label={CLIENT_FIELD_LABELS.crownAngle}
            value={fields.crownAngle?.trim() ? `${fields.crownAngle}°` : "—"}
          />
          <CompactMetricRow
            label={CLIENT_FIELD_LABELS.pavilionAngle}
            value={
              fields.pavilionAngle?.trim() ? `${fields.pavilionAngle}°` : "—"
            }
          />
          <CompactMetricRow
            label={CLIENT_FIELD_LABELS.girdle}
            value={dashValue(fields.girdle)}
          />
          <CompactMetricRow
            label={CLIENT_FIELD_LABELS.culet}
            value={dashValue(fields.culet)}
          />
        </CompactPanel>

        <CompactPanel title="Finish">
          <CompactMetricRow
            label={CLIENT_FIELD_LABELS.polish}
            value={dashValue(fields.polish)}
          />
          <CompactMetricRow
            label={CLIENT_FIELD_LABELS.symmetry}
            value={dashValue(fields.symmetry)}
          />
          <CompactMetricRow
            label={CLIENT_FIELD_LABELS.fluorescence}
            value={dashValue(fields.fluorescence)}
          />
          <CompactMetricRow
            label={CLIENT_FIELD_LABELS.cutGrade}
            value={dashValue(fields.cutGrade)}
          />
        </CompactPanel>

        <CompactPanel title="Face-up presence">
          {faceUpCopy?.tierLabel ? (
            <p className="mb-1.5 text-[10px] tracking-[0.12em] text-[#b0a698]">
              {faceUpCopy.tierLabel}
            </p>
          ) : null}
          {faceUpCopy?.summary ? (
            <p className="mb-2 text-[11px] leading-[1.55] text-[#948a80]">
              {faceUpCopy.summary}
            </p>
          ) : null}
          {diameter ? (
            <CompactMetricRow label="Avg. diameter" value={`${diameter} mm`} />
          ) : null}
          <CompactMetricRow
            label="Measurements"
            value={dashValue(fields.measurements)}
          />
          <CompactMetricRow label="Carat" value={formatCarat(fields.carat ?? "")} />
        </CompactPanel>
      </div>
    </section>
  );
}
