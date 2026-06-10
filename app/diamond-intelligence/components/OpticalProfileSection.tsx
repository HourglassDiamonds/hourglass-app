"use client";

import type { ProfileAxis } from "@/lib/diamond-intelligence/client-balance-profile";
import OpticalBalanceGraph from "./OpticalBalanceGraph";
import { axisPerformanceSummary } from "./consumer-display-labels";
import {
  DI_EDITORIAL_CARD,
  DI_EYEBROW_STUDIO,
} from "./di-studio-styles";

export default function OpticalProfileSection({
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
    <section className={`${DI_EDITORIAL_CARD} px-8 py-10 md:px-12 md:py-14`}>
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <p className={DI_EYEBROW_STUDIO}>Optical Profile</p>
        <p className="mt-4 max-w-md text-sm leading-6 text-[#6f6258]">
          A directional view based on available report data.
        </p>

        <div className="mt-8 w-full max-w-sm">
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
            compact
          />
        </div>

        {hasReport && canShowGraph ? (
          <ul className="mt-6 w-full max-w-md space-y-1.5 text-center">
            {axes.map((axis) => {
              const summary = axisPerformanceSummary(axis);
              if (!summary) return null;
              return (
                <li
                  key={axis.key}
                  className="text-[11px] leading-[1.55] text-[#9a8673]"
                >
                  {summary}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
