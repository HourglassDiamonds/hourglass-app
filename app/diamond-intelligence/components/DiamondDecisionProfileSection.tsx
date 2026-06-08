"use client";

import type { DiamondDecisionProfile } from "@/lib/diamond-intelligence/diamond-decision-profile";
import { presentOpticalPerformanceDisplay } from "@/lib/diamond-intelligence/interpretation-display";
import DiamondPurchasePersonalitySection from "./DiamondPurchasePersonalitySection";
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
    <div className="border-t border-[#ebe4da]/45 pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[#948a80]">
          {label}
        </p>
        <p className="text-right text-[0.94rem] font-medium tracking-[-0.01em] text-[#1f1d1a]">
          {band}
          {score !== null &&
          score !== undefined &&
          label === "Optical Performance" ? (
            <span className="ml-1.5 text-[12px] font-normal text-[#948a80]">
              ({Math.round(score)})
            </span>
          ) : null}
        </p>
      </div>
      <p className="mt-2 text-[13px] leading-[1.7] text-[#5f5851]">
        {explanation}
      </p>
    </div>
  );
}

function RecommendationBlock({
  profile,
}: {
  profile: DiamondDecisionProfile;
}) {
  return (
    <div className="rounded-lg bg-[#faf8f4]/80 px-4 py-4 ring-1 ring-[#e4dbcf]/35 md:px-5 md:py-5">
      <p className="text-[10px] uppercase tracking-[0.28em] text-[#a8926a]">
        {profile.overallRecommendation.label}
      </p>
      <p className="mt-2.5 font-serif text-[1.35rem] leading-[1.15] tracking-[-0.02em] text-[#1f1d1a] md:text-[1.42rem]">
        {profile.overallRecommendation.band}
      </p>
      <p className="mt-2 text-[11px] font-medium tracking-[0.04em] text-[#6b5048]">
        Primary limitation: {profile.primaryLimitingFactor.display}
      </p>
      <p className="mt-2.5 text-[13px] leading-[1.72] text-[#5f5851]">
        {profile.overallRecommendation.explanation}
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

  const opticalDisplay = presentOpticalPerformanceDisplay(profile);

  return (
    <DashboardCard
      title="Diamond Decision Profile"
      tone="secondary"
      contentClassName="space-y-5"
    >
      <RecommendationBlock profile={profile} />

      <DiamondPurchasePersonalitySection personality={profile.purchasePersonality} />

      <div className="border-t border-[#ebe4da]/50 pt-5">
        <p className="mb-4 text-[10px] uppercase tracking-[0.26em] text-[#b8afa6]">
          Technical dimensions
        </p>
        <p className="mb-4 text-[12px] leading-[1.6] text-[#948a80]">
          Architecture, presence, confidence, and risk — each answers a different
          question.
        </p>
        <DimensionRow
          label={profile.opticalPerformance.label}
          band={opticalDisplay.band}
          score={opticalDisplay.score}
          explanation={profile.opticalPerformance.explanation}
        />
        <DimensionRow
          label={profile.visualPresence.label}
          band={profile.visualPresence.band}
          explanation={profile.visualPresence.explanation}
        />
        <DimensionRow
          label={profile.confidence.label}
          band={profile.confidence.band}
          explanation={profile.confidence.explanation}
        />
        <DimensionRow
          label={profile.riskProfile.label}
          band={profile.riskProfile.band}
          explanation={profile.riskProfile.explanation}
        />
      </div>
    </DashboardCard>
  );
}
