"use client";

import type { DiamondDecisionProfile } from "@/lib/diamond-intelligence/diamond-decision-profile";
import { presentOpticalPerformanceDisplay } from "@/lib/diamond-intelligence/interpretation-display";
import {
  consumerProfileDimensionLabel,
  consumerConfidenceBandLabel,
  CONSUMER_COPY,
} from "./consumer-display-labels";
import { ProfileDimensionRow } from "./decision-profile-blocks";
import { DI_EYEBROW_STUDIO } from "./di-studio-styles";

export default function DiamondTechnicalProfileSection({
  profile,
}: {
  profile: DiamondDecisionProfile | null;
}) {
  if (!profile) return null;

  const opticalDisplay = presentOpticalPerformanceDisplay(profile);

  return (
    <section className="border-t border-[#ebe4da]/50 py-6 md:py-8">
      <p className={`${DI_EYEBROW_STUDIO} text-[9px] tracking-[0.24em] text-[#b0a698]`}>
        {CONSUMER_COPY.technicalDecisionProfileTitle}
      </p>
      <div className="mt-4 max-w-3xl space-y-4 text-xs leading-[1.65] text-[#948a80]">
        <ProfileDimensionRow
          label={profile.opticalPerformance.label}
          band={opticalDisplay.band}
          score={opticalDisplay.score}
          explanation={profile.opticalPerformance.explanation}
          subdued
        />
        <ProfileDimensionRow
          label={profile.visualPresence.label}
          band={profile.visualPresence.band}
          explanation={profile.visualPresence.explanation}
          subdued
        />
        <ProfileDimensionRow
          label={consumerProfileDimensionLabel(profile.confidence.label)}
          band={consumerConfidenceBandLabel(profile.confidence.band)}
          explanation={profile.confidence.explanation}
          subdued
        />
        <ProfileDimensionRow
          label={consumerProfileDimensionLabel(profile.riskProfile.label)}
          band={profile.riskProfile.band}
          explanation={profile.riskProfile.explanation}
          subdued
        />
      </div>
    </section>
  );
}
