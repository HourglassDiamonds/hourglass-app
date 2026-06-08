"use client";

import type { ProfileAxis } from "@/lib/diamond-intelligence/client-balance-profile";
import OpticalBalanceGraph from "./OpticalBalanceGraph";
import DiEditorialImage from "./DiEditorialImage";
import {
  DI_BODY_MUTED,
  DI_EYEBROW,
  DI_HEADLINE_SERIF,
  DI_SECTION,
} from "./di-editorial-classes";

export default function DiPerformanceProfileSection({
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
    <section className={DI_SECTION}>
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:gap-14">
        <div className="max-w-md">
          <p className={DI_EYEBROW}>At a Glance</p>
          <h2
            className={`${DI_HEADLINE_SERIF} mt-4 text-[1.5rem] md:text-[1.65rem]`}
          >
            Performance profile
          </h2>
          <p className={`${DI_BODY_MUTED} mt-4`}>
            {hasReport && !canShowGraph
              ? "Not enough proportion detail yet for a calculated profile."
              : "Reported proportions translated into a visual balance profile — a supporting view, not the verdict itself."}
          </p>
          <p className={`${DI_BODY_MUTED} mt-4 text-[0.84rem]`}>
            Based on reported proportions and finish. Not a laboratory scan.
          </p>
        </div>

        <div className="relative flex justify-center lg:justify-end">
          <div className="relative w-full max-w-[280px]">
            <DiEditorialImage
              slot="performance-watermark"
              variant="watermark"
              className="overflow-hidden rounded-full"
            />
            <div className="relative opacity-90">
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
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
