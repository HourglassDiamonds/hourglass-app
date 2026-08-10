"use client";

type Props = {
  tablePercent?: string;
  depthPercent?: string;
  crownAngle?: string;
  pavilionAngle?: string;
};

export default function ProportionDiagram({
  tablePercent,
  depthPercent,
  crownAngle,
  pavilionAngle,
}: Props) {
  const t = tablePercent?.trim() || "—";
  const d = depthPercent?.trim() || "—";
  const ca = crownAngle?.trim() ? `${crownAngle}°` : "—";
  const pa = pavilionAngle?.trim() ? `${pavilionAngle}°` : "—";

  return (
    <svg
      viewBox="0 0 120 160"
      className="h-auto w-full max-w-[140px] text-[#6d655e]"
      aria-hidden
    >
      <path
        d="M60 8 L95 45 L95 115 L60 152 L25 115 L25 45 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.5"
      />
      <line x1="25" y1="80" x2="95" y2="80" stroke="currentColor" strokeWidth="0.5" opacity="0.35" strokeDasharray="2 2" />
      <text x="60" y="28" textAnchor="middle" fontSize="7" fill="#5f5851">
        Table {t}%
      </text>
      <text x="102" y="82" textAnchor="start" fontSize="6" fill="#5f5851">
        {ca}
      </text>
      <text x="8" y="82" textAnchor="end" fontSize="6" fill="#5f5851">
        {pa}
      </text>
      <text x="60" y="148" textAnchor="middle" fontSize="7" fill="#5f5851">
        Depth {d}%
      </text>
    </svg>
  );
}
