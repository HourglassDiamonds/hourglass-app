"use client";

import type { DiamondDecisionProfile } from "@/lib/diamond-intelligence/diamond-decision-profile";
import { presentOpticalPerformanceDisplay } from "@/lib/diamond-intelligence/interpretation-display";
import {
  consumerProfileDimensionLabel,
  consumerConfidenceBandLabel,
  CONSUMER_COPY,
} from "./consumer-display-labels";
import { ProfileDimensionRow } from "./decision-profile-blocks";
import { DashboardCard } from "./DashboardCard";

export default function DiamondTechnicalProfileSection({
  profile,
}: {
  profile: DiamondDecisionProfile | null;
}) {
  if (!profile) return null;

  const opticalDisplay = presentOpticalPerformanceDisplay(profile);

  return (
    <DashboardCard
      title={CONSUMER_COPY.technicalDecisionProfileTitle}
      tone="subdued"
      className="!shadow-none"
    >
      <p className="mb-4 text-[12px] leading-[1.6] text-[#948a80]">
        Architecture, presence, confidence, and risk — each answers a different
        question.
      </p>
      <ProfileDimensionRow
        label={profile.opticalPerformance.label}
        band={opticalDisplay.band}
        score={opticalDisplay.score}
        explanation={profile.opticalPerformance.explanation}
      />
      <ProfileDimensionRow
        label={profile.visualPresence.label}
        band={profile.visualPresence.band}
        explanation={profile.visualPresence.explanation}
      />
      <ProfileDimensionRow
        label={consumerProfileDimensionLabel(profile.confidence.label)}
        band={consumerConfidenceBandLabel(profile.confidence.band)}
        explanation={profile.confidence.explanation}
      />
      <ProfileDimensionRow
        label={consumerProfileDimensionLabel(profile.riskProfile.label)}
        band={profile.riskProfile.band}
        explanation={profile.riskProfile.explanation}
      />
    </DashboardCard>
  );
}
