"use client";

import type { ProfileAxis } from "@/lib/diamond-intelligence/client-balance-profile";
import { referenceEnvelopeRadius } from "@/lib/diamond-intelligence/client-balance-profile";
import { GRAPH_REPORT_CONFIDENCE_LABELS } from "./consumer-display-labels";

const CX = 120;
const CY = 112;
const MAX_R = 68;
const REF_R = referenceEnvelopeRadius(MAX_R);
const UNCERTAIN_R = MAX_R * 0.4;
const LABEL_R = MAX_R + 20;

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
  emptyLabel?: string;
  emptySubLabel?: string;
  graphMode?: GraphMode;
  strengthMultiplier?: number;
  refinedGold?: boolean;
  surface?: "dark" | "light";
  compact?: boolean;
};

export default function OpticalBalanceGraph({
  axes,
  centerLabel,
  empty = false,
  emptyLabel = "AWAITING REPORT",
  emptySubLabel,
  graphMode = "full",
  strengthMultiplier = 1,
  refinedGold = false,
  surface = "dark",
  compact = false,
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
      ? refinedGold
        ? "rgba(196,176,138,0.07)"
        : "rgba(214,194,156,0.06)"
      : graphMode === "preliminary"
        ? refinedGold
          ? "rgba(196,176,138,0.10)"
          : "rgba(214,194,156,0.09)"
        : refinedGold
          ? "rgba(196,176,138,0.14)"
          : "rgba(214,194,156,0.12)";
  const profileStroke = empty
    ? "rgba(232,224,212,0.18)"
    : graphMode === "limited"
      ? refinedGold
        ? "rgba(212,192,154,0.55)"
        : "rgba(232,224,212,0.5)"
      : graphMode === "preliminary"
        ? refinedGold
          ? "rgba(220,200,168,0.78)"
          : "rgba(238,230,216,0.72)"
        : refinedGold
          ? "rgba(232,214,184,0.92)"
          : "rgba(238,230,216,0.95)";
  const centerText = empty
    ? emptyLabel
    : graphMode === "preliminary"
      ? "Needs Review"
      : graphMode === "limited"
        ? "Needs Review"
        : centerLabel === "Open"
          ? "Needs Review"
          : centerLabel;
  const subLabel = empty
    ? emptySubLabel
    : graphMode === "preliminary"
      ? GRAPH_REPORT_CONFIDENCE_LABELS.preliminary
      : graphMode === "limited"
        ? GRAPH_REPORT_CONFIDENCE_LABELS.limited
        : GRAPH_REPORT_CONFIDENCE_LABELS.full;

  const envelope = polygonPoints(axes.map(() => REF_R));
  const profile = polygonPoints(radii);

  const gridStroke =
    surface === "light" ? "rgba(180,170,158,0.22)" : "rgba(232,224,212,0.10)";
  const spokeStroke =
    surface === "light" ? "rgba(180,170,158,0.28)" : "rgba(232,224,212,0.12)";
  const labelFill =
    surface === "light"
      ? refinedGold
        ? "#8a8177"
        : "#948a80"
      : refinedGold
        ? "#d4c4a8"
        : "#cbc4ba";
  const centerFill = empty
    ? surface === "light"
      ? "#948a80"
      : "#8f8980"
    : restrained
      ? surface === "light"
        ? "#5f5851"
        : "#d9d2c7"
      : surface === "light"
        ? "#1f1d1a"
        : "#efe9df";
  const subLabelFill = surface === "light" ? "#948a80" : "#938d84";
  const emptySubFill = surface === "light" ? "#948a80" : "#7c766d";
  const markerFill = empty
    ? surface === "light"
      ? "rgba(180,170,158,0.15)"
      : "rgba(232,224,212,0.1)"
    : "rgba(214,194,156,0.32)";
  const markerStroke = empty
    ? surface === "light"
      ? "rgba(180,170,158,0.35)"
      : "rgba(232,224,212,0.22)"
    : "rgba(238,230,216,0.6)";
  const vertexFill =
    surface === "light" ? "rgba(107,80,72,0.85)" : "rgba(238,230,216,0.95)";

  return (
    <div
      className={`relative mx-auto w-full px-1 py-2 ${compact ? "max-w-[220px]" : "max-w-[min(300px,100%)]"}`}
    >
      <svg
        viewBox="0 0 240 236"
        className="h-auto w-full overflow-visible"
        style={{
          maxHeight: compact ? "min(220px, 44vw)" : "min(300px, 52vw)",
        }}
        aria-label="Performance profile chart"
        role="img"
      >
        {gridLevels.map((level) => (
          <polygon
            key={level}
            points={polygonPoints(axes.map(() => MAX_R * level))}
            fill="none"
            stroke={gridStroke}
            strokeWidth={level === 1 ? 0.5 : 0.4}
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
              stroke={spokeStroke}
              strokeWidth="0.35"
            />
          );
        })}

        <polygon
          points={envelope}
          fill={refinedGold ? "rgba(196,176,138,0.045)" : "rgba(196,176,138,0.035)"}
          stroke={refinedGold ? "rgba(212,192,154,0.48)" : "rgba(212,194,156,0.42)"}
          strokeWidth="0.7"
          strokeDasharray="2.5 3.5"
        />

        <polygon
          points={profile}
          fill={profileFill}
          stroke={profileStroke}
          strokeWidth={restrained ? 1.1 : 1.4}
          strokeLinejoin="round"
          strokeDasharray={dashedProfile ? "4 3" : undefined}
        />

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
                  fill={vertexFill}
                />
              );
            })
          : null}

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
              fill={labelFill}
              style={{
                fontSize: refinedGold ? "6.5px" : "7px",
                letterSpacing: "0.14em",
                fontWeight: 500,
              }}
            >
              {axis.label.toUpperCase()}
            </text>
          );
        })}

        <circle
          cx={CX}
          cy={CY}
          r={empty ? 2.5 : 4}
          fill={markerFill}
          stroke={markerStroke}
          strokeWidth="0.6"
        />

        <text
          x={CX}
          y={empty ? CY + 1 : CY - 5}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={centerFill}
          className={
            !empty && !restrained && surface === "dark"
              ? "font-serif"
              : restrained
                ? "font-serif"
                : undefined
          }
          style={{
            fontSize: empty ? "7px" : restrained ? "10px" : "14px",
            letterSpacing: empty || restrained ? "0.06em" : undefined,
          }}
        >
          {centerText}
        </text>
        {subLabel ? (
          <text
            x={CX}
            y={empty ? CY + 12 : restrained ? CY + 12 : CY + 13}
            textAnchor="middle"
            fill={empty ? emptySubFill : subLabelFill}
            style={{ fontSize: "5.5px", letterSpacing: "0.12em" }}
          >
            {subLabel}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
