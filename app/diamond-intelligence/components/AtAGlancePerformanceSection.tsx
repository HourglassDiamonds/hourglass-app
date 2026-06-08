"use client";

import type { ProfileAxis } from "@/lib/diamond-intelligence/client-balance-profile";
import OpticalBalanceGraph from "./OpticalBalanceGraph";
import { DashboardCard } from "./DashboardCard";

export default function AtAGlancePerformanceSection({
  axes,
  centerLabel,
  canShowGraph,
  hasReport,
  graphMode,
  strengthMultiplier,
}: {
  axes: ProfileAxis[];
  centerLabel: string;
  canShowGraph: boolean;
  hasReport: boolean;
  graphMode: "full" | "preliminary" | "limited";
  strengthMultiplier: number;
}) {
  return (
    <DashboardCard title="At-a-glance performance" tone="default">
      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:gap-10">
        <div className="max-w-md">
          <p className="text-[10px] uppercase tracking-[0.26em] text-[#948a80]">
            Performance profile
          </p>
          <p className="mt-3 text-[13px] leading-[1.72] text-[#5f5851]">
            {hasReport && !canShowGraph
              ? "Not enough proportion detail yet for a calculated profile."
              : "Reported proportions translated into a visual balance profile — supporting evidence, not the verdict itself."}
          </p>
          <p className="mt-3 text-[11px] leading-[1.6] tracking-[0.02em] text-[#948a80]">
            Based on reported proportions and finish. Not a laboratory scan.
          </p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <OpticalBalanceGraph
            axes={axes}
            centerLabel={centerLabel}
            empty={!hasReport || !canShowGraph}
            emptyLabel={hasReport ? "STARTING POINT" : "AWAITING REPORT"}
            emptySubLabel={
              hasReport && !canShowGraph ? "AWAITING DETAIL" : undefined
            }
            graphMode={graphMode}
            strengthMultiplier={strengthMultiplier}
            refinedGold
            surface="light"
          />
        </div>
      </div>
    </DashboardCard>
  );
}
