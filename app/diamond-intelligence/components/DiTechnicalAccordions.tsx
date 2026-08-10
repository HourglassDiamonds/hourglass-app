"use client";

import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import type { ClientSafeMetadata } from "@/lib/diamond-intelligence/client-api";
import type { DiamondDecisionProfile } from "@/lib/diamond-intelligence/diamond-decision-profile";
import type { FaceUpPresenceCopy } from "@/lib/diamond-intelligence/client-performance-copy";
import {
  CLIENT_FIELD_LABELS,
} from "@/lib/diamond-intelligence";
import { presentOpticalPerformanceDisplay } from "@/lib/diamond-intelligence/interpretation-display";
import DiAccordion from "./DiAccordion";
import { MetricRow, dashValue } from "./DashboardCard";
import { DI_BODY, DI_BODY_MUTED, DI_EYEBROW, DI_SECTION } from "./di-editorial-classes";

function formatCarat(carat: string): string {
  const v = carat.trim();
  if (!v) return "—";
  return v.includes("ct") ? v : `${v} ct`;
}

function stoneTypeLabel(stoneType: string): string | null {
  if (stoneType === "natural") return "Natural";
  if (stoneType === "lab-grown") return "Lab-grown";
  return null;
}

function ProfileDimension({
  label,
  band,
  score,
  explanation,
}: {
  label: string;
  band: string;
  score?: number | null;
  explanation: string;
}) {
  return (
    <div className="border-t border-[#ebe4da]/45 py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={DI_EYEBROW}>{label}</p>
        <p className="text-right text-[0.95rem] font-medium text-[#1f1d1a]">
          {band}
          {score !== null &&
          score !== undefined &&
          label === "Optical Performance" ? (
            <span className="ml-1.5 font-normal text-[#6d655e]">
              ({Math.round(score)})
            </span>
          ) : null}
        </p>
      </div>
      <p className={`${DI_BODY} mt-2 text-[0.94rem]`}>{explanation}</p>
    </div>
  );
}

export default function DiTechnicalAccordions({
  decisionProfile,
  fields,
  metadata,
  faceUpCopy,
  diameter,
}: {
  decisionProfile: DiamondDecisionProfile | null;
  fields: CalibrationReportFields | null;
  metadata: ClientSafeMetadata | null;
  faceUpCopy: FaceUpPresenceCopy | null;
  diameter: string | null;
}) {
  if (!decisionProfile || !fields || !metadata) return null;

  const opticalDisplay = presentOpticalPerformanceDisplay(decisionProfile);

  return (
    <section className={DI_SECTION}>
      <p className={DI_EYEBROW}>Technical Details</p>
      <h2
        className="mt-4 font-serif text-[1.45rem] font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.55rem]"
      >
        For those who want to explore further
      </h2>
      <p className={`${DI_BODY_MUTED} mt-3 max-w-xl`}>
        Collapsed by default — most buyers never need this level of detail.
      </p>

      <div className="mt-8 md:mt-10">
        <DiAccordion
          title="Diamond Decision Profile"
          description="Architecture, presence, confidence, risk, and recommendation."
        >
          <p className={`${DI_BODY_MUTED} mb-4 text-[0.9rem]`}>
            Each dimension answers a different question about this stone.
          </p>
          <ProfileDimension
            label={decisionProfile.opticalPerformance.label}
            band={opticalDisplay.band}
            score={opticalDisplay.score}
            explanation={decisionProfile.opticalPerformance.explanation}
          />
          <ProfileDimension
            label={decisionProfile.visualPresence.label}
            band={decisionProfile.visualPresence.band}
            explanation={decisionProfile.visualPresence.explanation}
          />
          <ProfileDimension
            label={decisionProfile.confidence.label}
            band={decisionProfile.confidence.band}
            explanation={decisionProfile.confidence.explanation}
          />
          <ProfileDimension
            label={decisionProfile.riskProfile.label}
            band={decisionProfile.riskProfile.band}
            explanation={decisionProfile.riskProfile.explanation}
          />
          <ProfileDimension
            label={decisionProfile.overallRecommendation.label}
            band={decisionProfile.overallRecommendation.band}
            explanation={decisionProfile.overallRecommendation.explanation}
          />
          <p className={`${DI_BODY_MUTED} mt-4 text-[0.88rem]`}>
            Primary limitation: {decisionProfile.primaryLimitingFactor.display}
          </p>
        </DiAccordion>

        <DiAccordion
          title="Proportions & Angles"
          description="Table, depth, crown, pavilion, girdle, and culet from your report."
        >
          <MetricRow
            editorial
            label={CLIENT_FIELD_LABELS.tablePercent}
            value={
              fields.tablePercent?.trim() ? `${fields.tablePercent}%` : "—"
            }
          />
          <MetricRow
            editorial
            label={CLIENT_FIELD_LABELS.depthPercent}
            value={
              fields.depthPercent?.trim() ? `${fields.depthPercent}%` : "—"
            }
          />
          <MetricRow
            editorial
            label={CLIENT_FIELD_LABELS.crownAngle}
            value={fields.crownAngle?.trim() ? `${fields.crownAngle}°` : "—"}
          />
          <MetricRow
            editorial
            label={CLIENT_FIELD_LABELS.pavilionAngle}
            value={
              fields.pavilionAngle?.trim() ? `${fields.pavilionAngle}°` : "—"
            }
          />
          <MetricRow
            editorial
            label={CLIENT_FIELD_LABELS.girdle}
            value={dashValue(fields.girdle)}
          />
          <MetricRow
            editorial
            label={CLIENT_FIELD_LABELS.culet}
            value={dashValue(fields.culet)}
          />
        </DiAccordion>

        <DiAccordion
          title="Finish"
          description="Polish, symmetry, fluorescence, and cut grade lines."
        >
          <MetricRow
            editorial
            label={CLIENT_FIELD_LABELS.polish}
            value={dashValue(fields.polish)}
          />
          <MetricRow
            editorial
            label={CLIENT_FIELD_LABELS.symmetry}
            value={dashValue(fields.symmetry)}
          />
          <MetricRow
            editorial
            label={CLIENT_FIELD_LABELS.fluorescence}
            value={dashValue(fields.fluorescence)}
          />
          <MetricRow
            editorial
            label={CLIENT_FIELD_LABELS.cutGrade}
            value={dashValue(fields.cutGrade)}
          />
          <p className={`${DI_BODY_MUTED} mt-3 text-[0.86rem]`}>
            Finish lines from your report — not a standalone lab grade.
          </p>
        </DiAccordion>

        <DiAccordion
          title="Report Details"
          description="Laboratory, report number, measurements, and face-up presence."
        >
          <MetricRow label="Laboratory" value={metadata.lab} />
          <MetricRow
            label="Report number"
            value={dashValue(metadata.reportNumber)}
          />
          <MetricRow label="Shape" value={dashValue(fields.shape)} />
          <MetricRow label="Carat weight" value={formatCarat(fields.carat)} />
          <MetricRow
            label="Measurements"
            value={dashValue(fields.measurements)}
          />
          {stoneTypeLabel(metadata.stoneType) ? (
            <MetricRow
              label="Stone"
              value={stoneTypeLabel(metadata.stoneType)!}
            />
          ) : null}
          {faceUpCopy ? (
            <div className="mt-4 border-t border-[#ebe4da]/45 pt-4">
              {faceUpCopy.tierLabel ? (
                <p className={`${DI_EYEBROW} mb-2`}>{faceUpCopy.tierLabel}</p>
              ) : null}
              <p className={DI_BODY}>{faceUpCopy.summary}</p>
            </div>
          ) : null}
          {diameter ? (
            <MetricRow editorial label="Avg. diameter" value={`${diameter} mm`} />
          ) : null}
        </DiAccordion>

        <DiAccordion
          title="How to Read This Analysis"
          description="What a report can and cannot confirm on its own."
        >
          <p className={DI_BODY}>
            A grading report is one important part of evaluating a diamond, but
            it does not tell the entire story. This analysis reviews proportions,
            visual presence, risk factors, and recommendation context from the
            report itself.
          </p>
          <div className="mt-6 grid gap-8 sm:grid-cols-2">
            <div>
              <p className={`${DI_EYEBROW} text-[#6b5048]`}>
                What this can review
              </p>
              <ul className="mt-3 space-y-2">
                {[
                  "Report-based proportion analysis",
                  "Optical architecture from available measurements",
                  "Face-up presence and weight distribution",
                  "Risk signals from clarity, color, fluorescence, finish, and missing data",
                ].map((item) => (
                  <li key={item} className={`${DI_BODY} flex gap-2 text-[0.92rem]`}>
                    <span className="mt-[0.5em] h-1 w-1 shrink-0 rounded-full bg-[#c4b08a]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className={`${DI_EYEBROW} text-[#6b5048]`}>
                What a report cannot fully confirm
              </p>
              <ul className="mt-3 space-y-2">
                {[
                  "Whether the diamond is eye-clean",
                  "Real-world transparency",
                  "Actual video performance",
                  "Optical imaging results such as ASET or IdealScope",
                  "Certain light leakage, obstruction, or patterning behaviors",
                ].map((item) => (
                  <li key={item} className={`${DI_BODY} flex gap-2 text-[0.92rem]`}>
                    <span className="mt-[0.5em] h-1 w-1 shrink-0 rounded-full bg-[#6d655e]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className={`${DI_BODY} mt-6`}>
            For diamonds being seriously considered, additional review can provide
            greater confidence — direct expert review, video analysis, eye-clean
            verification, or optical imaging when available.
          </p>
        </DiAccordion>
      </div>
    </section>
  );
}
