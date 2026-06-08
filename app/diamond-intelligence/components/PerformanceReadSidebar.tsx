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
      tone="subdued"
      contentClassName="!mt-4"
    >
      {hasReport ? (
        <>
          {showPerformanceScore && overallScore !== null ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="font-serif text-[1.85rem] tracking-[-0.03em] text-[#1f1d1a]">
                  {overallScore}
                  <span className="ml-1.5 text-sm font-normal text-[#b8afa6]">
                    / 100
                  </span>
                </p>
              </div>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#ebe4da]/80">
                <div
                  className="h-full rounded-full bg-[#c4b08a] transition-all duration-500"
                  style={{ width: `${overallScore}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] tracking-[0.1em] text-[#948a80]">
                {CONSUMER_COPY.estimatedReadLabel}
              </p>
            </>
          ) : tierLabel ? (
            <p className="font-serif text-xl text-[#1f1d1a]">{tierLabel}</p>
          ) : (
            <p className="font-serif text-xl text-[#1f1d1a]">Starting point</p>
          )}
        </>
      ) : (
        <p className="text-sm leading-relaxed text-[#948a80]">
          Upload a report to see your performance read.
        </p>
      )}
    </DashboardCard>
  );
}
