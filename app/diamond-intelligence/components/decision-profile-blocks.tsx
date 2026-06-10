import type { DiamondDecisionProfile } from "@/lib/diamond-intelligence/diamond-decision-profile";
import { CONSUMER_COPY } from "./consumer-display-labels";

export function RecommendationBlock({
  profile,
}: {
  profile: DiamondDecisionProfile;
}) {
  return (
    <div className="rounded-lg bg-[#faf8f4]/80 px-4 py-4 ring-1 ring-[#e4dbcf]/35 md:px-5 md:py-5">
      <p className="text-[10px] uppercase tracking-[0.28em] text-[#a8926a]">
        {CONSUMER_COPY.recommendationLabel}
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

export function ProfileDimensionRow({
  label,
  band,
  score,
  explanation,
  subdued = false,
}: {
  label: string;
  band: string;
  score?: number | null;
  explanation: string;
  subdued?: boolean;
}) {
  const labelClass = subdued
    ? "text-[9px] uppercase tracking-[0.2em] text-[#b0a698]"
    : "text-[10px] uppercase tracking-[0.22em] text-[#948a80]";
  const bandClass = subdued
    ? "text-[0.88rem] font-medium tracking-[-0.01em] text-[#6f665d]"
    : "text-right text-[0.94rem] font-medium tracking-[-0.01em] text-[#1f1d1a]";
  const bodyClass = subdued
    ? "mt-2 text-[12px] leading-[1.65] text-[#948a80]"
    : "mt-2 text-[13px] leading-[1.7] text-[#5f5851]";

  return (
    <div className="border-t border-[#ebe4da]/30 pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className={labelClass}>{label}</p>
        <p className={bandClass}>
          {band}
          {score !== null &&
          score !== undefined &&
          label === "Optical Performance" ? (
            <span className="ml-1.5 text-[11px] font-normal text-[#b0a698]">
              ({Math.round(score)})
            </span>
          ) : null}
        </p>
      </div>
      <p className={bodyClass}>{explanation}</p>
    </div>
  );
}
