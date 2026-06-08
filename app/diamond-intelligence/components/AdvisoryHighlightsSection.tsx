"use client";

import type { ProfileAxis } from "@/lib/diamond-intelligence/client-balance-profile";
import OpticalBalanceGraph from "./OpticalBalanceGraph";
import { CONSUMER_COPY, axisPerformanceSummary } from "./consumer-display-labels";
import { DashboardCard } from "./DashboardCard";

export default function AdvisoryHighlightsSection({
  strengths,
  worthKnowing,
  radar,
}: {
  strengths: string[];
  worthKnowing: string[];
  radar?: {
    axes: ProfileAxis[];
    centerLabel: string;
    canShowGraph: boolean;
    hasReport: boolean;
    graphMode: "full" | "preliminary" | "limited";
    strengthMultiplier: number;
  };
}) {
  const hasHighlights = strengths.length > 0 || worthKnowing.length > 0;
  if (!hasHighlights && !radar) return null;

  return (
    <DashboardCard title="Strengths & Worth Knowing" tone="default">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:items-start lg:gap-12">
        {hasHighlights ? (
          <div className="grid gap-8 md:grid-cols-2 md:gap-10">
            {strengths.length > 0 ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.26em] text-[#6b5048]">
                  Strengths
                </p>
                <ul className="mt-4 space-y-2.5">
                  {strengths.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2.5 text-[13px] leading-[1.7] text-[#5f5851]"
                    >
                      <span className="mt-[0.55em] shrink-0 text-[#a8926a]" aria-hidden>
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {worthKnowing.length > 0 ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.26em] text-[#6b5048]">
                  Worth Knowing
                </p>
                <ul className="mt-4 space-y-2.5">
                  {worthKnowing.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2.5 text-[13px] leading-[1.7] text-[#5f5851]"
                    >
                      <span
                        className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-[#948a80]"
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {radar ? (
          <div className={`min-w-0 ${hasHighlights ? "lg:border-l lg:border-[#ebe4da]/45 lg:pl-10" : ""}`}>
            <p
              className="text-[10px] uppercase leading-[1.45] tracking-[0.16em] text-[#948a80]"
              style={{ textWrap: "balance" }}
            >
              {CONSUMER_COPY.performanceAtAGlanceLabel}
            </p>
            <div className="mt-4 flex justify-center lg:justify-end">
              <OpticalBalanceGraph
                axes={radar.axes}
                centerLabel={radar.centerLabel}
                empty={!radar.hasReport || !radar.canShowGraph}
                emptyLabel={radar.hasReport ? "STARTING POINT" : "AWAITING REPORT"}
                emptySubLabel={
                  radar.hasReport && !radar.canShowGraph ? "AWAITING DETAIL" : undefined
                }
                graphMode={radar.graphMode}
                strengthMultiplier={radar.strengthMultiplier}
                refinedGold
                surface="light"
              />
            </div>
            {!radar.hasReport || !radar.canShowGraph ? null : (
              <ul className="mt-3 space-y-1">
                {radar.axes.map((axis) => {
                  const summary = axisPerformanceSummary(axis);
                  if (!summary) return null;
                  return (
                    <li
                      key={axis.key}
                      className="text-[11px] leading-[1.5] text-[#948a80]"
                    >
                      {summary}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </DashboardCard>
  );
}
