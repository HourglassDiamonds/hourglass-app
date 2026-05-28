"use client";

import type { ProfileAxis } from "@/lib/diamond-intelligence/client-balance-profile";
import { referenceEnvelopeRadius } from "@/lib/diamond-intelligence/client-balance-profile";

const CX = 110;
const CY = 104;
const MAX_R = 72;
const REF_R = referenceEnvelopeRadius(MAX_R);
const UNCERTAIN_R = MAX_R * 0.4;
const LABEL_R = MAX_R + 13;

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
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
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
    <div className="relative mx-auto w-full max-w-[min(440px,94vw)]">
      <svg
        viewBox="0 0 220 210"
        className="h-auto w-full"
        style={{ maxHeight: "min(320px, 50vw)" }}
        aria-label="Performance profile chart"
        role="img"
      >
        {/* concentric reference rings */}
        {gridLevels.map((level) => (
          <polygon
            key={level}
            points={polygonPoints(axes.map(() => MAX_R * level))}
            fill="none"
            stroke="rgba(232,224,212,0.10)"
            strokeWidth={level === 1 ? 0.5 : 0.4}
          />
        ))}

        {/* axis spokes */}
        {axes.map((_, i) => {
          const end = polar(MAX_R, axisAngle(i, n));
          return (
            <line
              key={i}
              x1={CX}
              y1={CY}
              x2={end.x}
              y2={end.y}
              stroke="rgba(232,224,212,0.12)"
              strokeWidth="0.35"
            />
          );
        })}

        {/* ideal reference envelope */}
        <polygon
          points={envelope}
          fill="rgba(196,176,138,0.035)"
          stroke="rgba(212,192,154,0.42)"
          strokeWidth="0.7"
          strokeDasharray="2.5 3.5"
        />

        {/* measured profile */}
        <polygon
          points={profile}
          fill={empty ? "none" : "rgba(214,194,156,0.12)"}
          stroke={empty ? "rgba(232,224,212,0.18)" : "rgba(238,230,216,0.95)"}
          strokeWidth="1.4"
          strokeLinejoin="round"
          strokeDasharray={uncertainFlags.some(Boolean) ? "4 3" : undefined}
        />

        {/* profile vertices */}
        {!empty
          ? radii.map((r, i) => {
              if (uncertainFlags[i]) return null;
              const pt = polar(r, axisAngle(i, n));
              return (
                <circle
                  key={`v-${i}`}
                  cx={pt.x}
                  cy={pt.y}
                  r="1.4"
                  fill="rgba(238,230,216,0.95)"
                />
              );
            })
          : null}

        {/* axis labels */}
        {axes.map((axis, i) => {
          const pt = polar(LABEL_R, axisAngle(i, n));
          const anchor =
            pt.x < CX - 6 ? "end" : pt.x > CX + 6 ? "start" : "middle";
          return (
            <text
              key={axis.key}
              x={pt.x}
              y={pt.y}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-[#cbc4ba]"
              style={{
                fontSize: "8px",
                letterSpacing: "0.14em",
                fontWeight: 500,
              }}
            >
              {axis.label.toUpperCase()}
            </text>
          );
        })}

        {/* central focus marker */}
        <circle
          cx={CX}
          cy={CY}
          r={empty ? 2.5 : 4}
          fill={empty ? "rgba(232,224,212,0.1)" : "rgba(214,194,156,0.32)"}
          stroke={empty ? "rgba(232,224,212,0.22)" : "rgba(238,230,216,0.6)"}
          strokeWidth="0.6"
        />

        <text
          x={CX}
          y={empty ? CY + 1 : CY - 5}
          textAnchor="middle"
          dominantBaseline="middle"
          className={empty ? "fill-[#8f8980]" : "fill-[#efe9df] font-serif"}
          style={{ fontSize: empty ? "7.5px" : "15px", letterSpacing: empty ? "0.12em" : undefined }}
        >
          {empty ? "AWAITING REPORT" : centerLabel}
        </text>
        {!empty ? (
          <text
            x={CX}
            y={CY + 13}
            textAnchor="middle"
            className="fill-[#938d84]"
            style={{ fontSize: "6.5px", letterSpacing: "0.16em" }}
          >
            OVERALL READ
          </text>
        ) : null}
      </svg>
    </div>
  );
}
