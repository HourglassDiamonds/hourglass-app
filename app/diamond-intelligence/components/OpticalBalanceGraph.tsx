"use client";

import type { ProfileAxis } from "@/lib/diamond-intelligence/client-balance-profile";
import { referenceEnvelopeRadius } from "@/lib/diamond-intelligence/client-balance-profile";

const CX = 100;
const CY = 100;
const MAX_R = 68;
const REF_R = referenceEnvelopeRadius(MAX_R);
const UNCERTAIN_R = MAX_R * 0.38;

function axisAngle(index: number, total: number): number {
  return -Math.PI / 2 + (index * 2 * Math.PI) / total;
}

function polar(r: number, angle: number): { x: number; y: number } {
  return {
    x: CX + r * Math.cos(angle),
    y: CY + r * Math.sin(angle),
  };
}

function polygonPoints(
  radii: number[],
  uncertain: boolean[],
): string {
  return radii
    .map((r, i) => {
      const pt = polar(r, axisAngle(i, radii.length));
      return `${pt.x},${pt.y}`;
    })
    .join(" ");
}

type Props = {
  axes: ProfileAxis[];
  centerLabel: string;
  empty?: boolean;
};

export default function OpticalBalanceGraph({
  axes,
  centerLabel,
  empty = false,
}: Props) {
  const n = axes.length || 6;
  const gridLevels = [0.25, 0.5, 0.75, 1];

  const radii = axes.map((a) => {
    if (a.uncertain || a.value === null) return UNCERTAIN_R;
    return (a.value / 100) * MAX_R;
  });
  const uncertainFlags = axes.map((a) => a.uncertain || a.value === null);

  const envelope = polygonPoints(
    axes.map(() => REF_R),
    axes.map(() => false),
  );
  const profile = polygonPoints(radii, uncertainFlags);

  return (
    <div className="relative w-full max-w-[min(340px,88vw)] mx-auto">
      <svg
        viewBox="0 0 200 200"
        className="h-auto w-full"
        style={{ maxHeight: "min(240px, 42vw)" }}
        aria-label="Performance profile chart"
        role="img"
      >
        <rect width="200" height="200" fill="transparent" />

        {gridLevels.map((level) => (
          <polygon
            key={level}
            points={polygonPoints(
              axes.map(() => MAX_R * level),
              axes.map(() => false),
            )}
            fill="none"
            stroke="rgba(232,224,212,0.07)"
            strokeWidth="0.4"
          />
        ))}

        {axes.map((_, i) => {
          const end = polar(MAX_R, axisAngle(i, n));
          return (
            <line
              key={i}
              x1={CX}
              y1={CY}
              x2={end.x}
              y2={end.y}
              stroke="rgba(232,224,212,0.1)"
              strokeWidth="0.35"
            />
          );
        })}

        <polygon
          points={envelope}
          fill="none"
          stroke="rgba(196,176,138,0.22)"
          strokeWidth="0.6"
          strokeDasharray="2 3"
        />

        <polygon
          points={profile}
          fill={empty ? "none" : "rgba(196,176,138,0.06)"}
          stroke={empty ? "rgba(232,224,212,0.15)" : "rgba(232,224,212,0.75)"}
          strokeWidth="1.1"
          strokeLinejoin="round"
          strokeDasharray={
            uncertainFlags.some(Boolean) ? "4 3" : undefined
          }
        />

        {axes.map((axis, i) => {
          const labelR = MAX_R + 14;
          const pt = polar(labelR, axisAngle(i, n));
          const anchor =
            pt.x < CX - 8 ? "end" : pt.x > CX + 8 ? "start" : "middle";
          return (
            <text
              key={axis.key}
              x={pt.x}
              y={pt.y}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-[#9a948c]"
              style={{ fontSize: "7px", letterSpacing: "0.12em" }}
            >
              {axis.label.toUpperCase()}
            </text>
          );
        })}

        <text
          x={CX}
          y={CY - 4}
          textAnchor="middle"
          className="fill-[#e8e2d8] font-serif"
          style={{ fontSize: "13px" }}
        >
          {empty ? "—" : centerLabel}
        </text>
        {!empty ? (
          <text
            x={CX}
            y={CY + 12}
            textAnchor="middle"
            className="fill-[#6f6a62]"
            style={{ fontSize: "6.5px", letterSpacing: "0.08em" }}
          >
            OVERALL READ
          </text>
        ) : null}
      </svg>
    </div>
  );
}
