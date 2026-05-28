"use client";

import type { ProfileAxis } from "@/lib/diamond-intelligence/client-balance-profile";
import { referenceEnvelopeRadius } from "@/lib/diamond-intelligence/client-balance-profile";

const CX = 100;
const CY = 100;
const MAX_R = 78;
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

function polygonPoints(radii: number[]): string {
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
  const gridLevels = [0.5, 1];

  const radii = axes.map((a) => {
    if (a.uncertain || a.value === null) return UNCERTAIN_R;
    return (a.value / 100) * MAX_R;
  });
  const uncertainFlags = axes.map((a) => a.uncertain || a.value === null);

  const envelope = polygonPoints(axes.map(() => REF_R));
  const profile = polygonPoints(radii);

  return (
    <div className="relative mx-auto w-full max-w-[min(420px,92vw)]">
      <svg
        viewBox="0 0 200 200"
        className="h-auto w-full"
        style={{ maxHeight: "min(300px, 48vw)" }}
        aria-label="Performance profile chart"
        role="img"
      >
        <rect width="200" height="200" fill="transparent" />

        {gridLevels.map((level) => (
          <polygon
            key={level}
            points={polygonPoints(axes.map(() => MAX_R * level))}
            fill="none"
            stroke="rgba(232,224,212,0.11)"
            strokeWidth="0.45"
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
              stroke="rgba(232,224,212,0.14)"
              strokeWidth="0.4"
            />
          );
        })}

        <polygon
          points={envelope}
          fill="rgba(196,176,138,0.04)"
          stroke="rgba(212,192,154,0.38)"
          strokeWidth="0.7"
          strokeDasharray="3 4"
        />

        <polygon
          points={profile}
          fill={empty ? "none" : "rgba(212,192,154,0.1)"}
          stroke={empty ? "rgba(232,224,212,0.2)" : "rgba(236,228,214,0.92)"}
          strokeWidth="1.35"
          strokeLinejoin="round"
          strokeDasharray={uncertainFlags.some(Boolean) ? "4 3" : undefined}
        />

        {axes.map((axis, i) => {
          const labelR = MAX_R + 11;
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
              className="fill-[#b5aea4]"
              style={{ fontSize: "8.5px", letterSpacing: "0.1em" }}
            >
              {axis.label.toUpperCase()}
            </text>
          );
        })}

        <circle
          cx={CX}
          cy={CY}
          r={empty ? 3 : 4.5}
          fill={empty ? "rgba(232,224,212,0.12)" : "rgba(212,192,154,0.35)"}
          stroke={empty ? "rgba(232,224,212,0.2)" : "rgba(236,228,214,0.55)"}
          strokeWidth="0.6"
        />

        <text
          x={CX}
          y={CY - 5}
          textAnchor="middle"
          className="fill-[#ece6dc] font-serif"
          style={{ fontSize: "14px" }}
        >
          {empty ? "—" : centerLabel}
        </text>
        {!empty ? (
          <text
            x={CX}
            y={CY + 13}
            textAnchor="middle"
            className="fill-[#8f8980]"
            style={{ fontSize: "7px", letterSpacing: "0.1em" }}
          >
            OVERALL READ
          </text>
        ) : null}
      </svg>
    </div>
  );
}
