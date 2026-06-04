"use client";

import type { DiamondDecisionProfile } from "@/lib/diamond-intelligence/diamond-decision-profile";
import { DashboardCard } from "./DashboardCard";

function DimensionRow({
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
    <div className="border-t border-[#ebe4da]/55 pt-3.5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-[11px] tracking-[0.14em] text-[#948a80]">{label}</p>
        <p className="text-right font-medium text-[#3a352f]">
          {band}
          {score !== null && score !== undefined && label === "Optical Performance" ? (
            <span className="ml-1.5 text-[12px] font-normal text-[#948a80]">
              ({Math.round(score)})
            </span>
          ) : null}
        </p>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-[1.65] text-[#5f5851]">
        {explanation}
      </p>
    </div>
  );
}

export default function DiamondDecisionProfileSection({
  profile,
}: {
  profile: DiamondDecisionProfile | null;
}) {
  if (!profile) return null;

  return (
    <DashboardCard title="Diamond Decision Profile" tone="subdued" className="!p-4 md:!p-5">
      <p className="mb-3 text-[12px] leading-[1.6] text-[#948a80]">
        How this stone may perform, present, and what to review before you decide — not a lab grade.
      </p>
      <DimensionRow
        label={profile.opticalPerformance.label}
        band={profile.opticalPerformance.band}
        score={profile.opticalPerformance.score}
        explanation={profile.opticalPerformance.explanation}
      />
      <DimensionRow
        label={profile.visualPresence.label}
        band={profile.visualPresence.band}
        explanation={profile.visualPresence.explanation}
      />
      <DimensionRow
        label={profile.riskProfile.label}
        band={profile.riskProfile.band}
        explanation={profile.riskProfile.explanation}
      />
      <DimensionRow
        label={profile.overallRecommendation.label}
        band={profile.overallRecommendation.band}
        explanation={profile.overallRecommendation.explanation}
      />
    </DashboardCard>
  );
}
