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

type GraphMode = "full" | "preliminary" | "limited";

type Props = {
  axes: ProfileAxis[];
  centerLabel: string;
  empty?: boolean;
  /** Center label shown in placeholder (empty/orientation) mode. */
  emptyLabel?: string;
  /** Caption shown under the placeholder center label. */
  emptySubLabel?: string;
  /** Display mode from the interpretation context — controls strength + labels. */
  graphMode?: GraphMode;
  /** 0–1 multiplier that pulls the profile toward center for lower confidence. */
  strengthMultiplier?: number;
};

export default function OpticalBalanceGraph({
  axes,
  centerLabel,
  empty = false,
  emptyLabel = "AWAITING REPORT",
  emptySubLabel,
  graphMode = "full",
  strengthMultiplier = 1,
}: Props) {
  const n = axes.length || 6;
  const gridLevels = [0.5, 1];

  const restrained = !empty && graphMode !== "full";
  const mult = empty ? 1 : Math.max(0, Math.min(1, strengthMultiplier));

  const radii = axes.map((a) => {
    if (a.uncertain || a.value === null) return UNCERTAIN_R * mult;
    return (a.value / 100) * MAX_R * mult;
  });
  const uncertainFlags = axes.map((a) => a.uncertain || a.value === null);
  const dashedProfile = restrained || uncertainFlags.some(Boolean);
  const profileFill = empty
    ? "none"
    : graphMode === "limited"
      ? "rgba(214,194,156,0.06)"
      : graphMode === "preliminary"
        ? "rgba(214,194,156,0.09)"
        : "rgba(214,194,156,0.12)";
  const profileStroke = empty
    ? "rgba(232,224,212,0.18)"
    : graphMode === "limited"
      ? "rgba(232,224,212,0.5)"
      : graphMode === "preliminary"
        ? "rgba(238,230,216,0.72)"
        : "rgba(238,230,216,0.95)";
  const centerText = empty
    ? emptyLabel
    : graphMode === "preliminary"
      ? "Preliminary"
      : graphMode === "limited"
        ? "Review"
        : centerLabel;
  const subLabel =
    graphMode === "preliminary"
      ? "MODERATE CONFIDENCE"
      : graphMode === "limited"
        ? "LIMITED DATA"
        : "HIGH CONFIDENCE";

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
          fill={profileFill}
          stroke={profileStroke}
          strokeWidth={restrained ? 1.1 : 1.4}
          strokeLinejoin="round"
          strokeDasharray={dashedProfile ? "4 3" : undefined}
        />

        {/* profile vertices */}
        {!empty && graphMode === "full"
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
          className={
            empty
              ? "fill-[#8f8980]"
              : restrained
                ? "fill-[#d9d2c7] font-serif"
                : "fill-[#efe9df] font-serif"
          }
          style={{
            fontSize: empty ? "7.5px" : restrained ? "11px" : "15px",
            letterSpacing: empty || restrained ? "0.06em" : undefined,
          }}
        >
          {centerText}
        </text>
        {!empty ? (
          <text
            x={CX}
            y={restrained ? CY + 12 : CY + 13}
            textAnchor="middle"
            className="fill-[#938d84]"
            style={{ fontSize: "6.5px", letterSpacing: "0.16em" }}
          >
            {subLabel}
          </text>
        ) : emptySubLabel ? (
          <text
            x={CX}
            y={CY + 12}
            textAnchor="middle"
            className="fill-[#7c766d]"
            style={{ fontSize: "6px", letterSpacing: "0.16em" }}
          >
            {emptySubLabel}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
