"use client";

import { CONSUMER_COPY } from "./consumer-display-labels";
import { DashboardCard } from "./DashboardCard";

export default function PerformanceReadSidebar({
  hasReport,
  showPerformanceScore,
  overallScore,
  tierLabel,
}: {
  hasReport: boolean;
  showPerformanceScore: boolean;
  overallScore: number | null;
  tierLabel: string | null;
}) {
  return (
    <DashboardCard
      title="Performance read"
      variant="minimal"
      contentClassName="!mt-3"
    >
      {hasReport ? (
        <>
          {showPerformanceScore && overallScore !== null ? (
            <>
              <p className="font-serif text-[1.65rem] tracking-[-0.03em] text-[#1f1d1a]">
                {overallScore}
                <span className="ml-1 text-[13px] font-normal text-[#b8afa6]">
                  / 100
                </span>
              </p>
              <p className="mt-2 text-[10px] tracking-[0.1em] text-[#6d655e]">
                {CONSUMER_COPY.estimatedReadLabel}
              </p>
            </>
          ) : tierLabel ? (
            <p className="font-serif text-lg leading-snug tracking-[-0.02em] text-[#1f1d1a]">
              {tierLabel}
            </p>
          ) : (
            <p className="font-serif text-lg text-[#1f1d1a]">Starting point</p>
          )}
        </>
      ) : (
        <p className="text-[13px] leading-relaxed text-[#6d655e]">
          Upload a report to see your performance read.
        </p>
      )}
    </DashboardCard>
  );
}
