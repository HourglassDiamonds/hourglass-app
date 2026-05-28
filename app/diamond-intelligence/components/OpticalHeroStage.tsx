"use client";

const LEGEND = [
  { color: "rgba(232,224,212,0.85)", label: "Return" },
  { color: "rgba(196,176,138,0.7)", label: "Fire" },
  { color: "rgba(168,160,148,0.55)", label: "Contrast" },
  { color: "rgba(140,132,124,0.45)", label: "Depth" },
] as const;

const DISCLAIMER =
  "Illustrative optical visualization — not a laboratory scan.";

export type OpticalMapTone =
  | "empty"
  | "strong"
  | "balanced"
  | "conservative"
  | "preliminary";

const TONE_STYLES: Record<
  OpticalMapTone,
  { centerGlow: number; ringOpacity: number; sectorOpacity: number }
> = {
  empty: { centerGlow: 0.12, ringOpacity: 0.06, sectorOpacity: 0.04 },
  preliminary: { centerGlow: 0.14, ringOpacity: 0.07, sectorOpacity: 0.05 },
  conservative: { centerGlow: 0.18, ringOpacity: 0.09, sectorOpacity: 0.06 },
  balanced: { centerGlow: 0.22, ringOpacity: 0.11, sectorOpacity: 0.07 },
  strong: { centerGlow: 0.28, ringOpacity: 0.14, sectorOpacity: 0.08 },
};

function InterpretationMap({
  tone,
  muted,
}: {
  tone: OpticalMapTone;
  muted?: boolean;
}) {
  const s = TONE_STYLES[tone];
  const scale = muted ? 0.45 : 1;
  const sectors = 8;
  const sectorPaths: string[] = [];
  for (let i = 0; i < sectors; i++) {
    const a0 = (i / sectors) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / sectors) * Math.PI * 2 - Math.PI / 2;
    const r0 = 28;
    const r1 = 88;
    const x0 = 100 + Math.cos(a0) * r0;
    const y0 = 100 + Math.sin(a0) * r0;
    const x1 = 100 + Math.cos(a1) * r0;
    const y1 = 100 + Math.sin(a1) * r0;
    const x2 = 100 + Math.cos(a1) * r1;
    const y2 = 100 + Math.sin(a1) * r1;
    const x3 = 100 + Math.cos(a0) * r1;
    const y3 = 100 + Math.sin(a0) * r1;
    sectorPaths.push(`M${x0},${y0} L${x1},${y1} L${x2},${y2} L${x3},${y3} Z`);
  }

  const fadeSector = tone === "conservative" ? 2 : -1;

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[min(420px,78vw)]"
      style={{ opacity: scale }}
    >
      <div
        className="pointer-events-none absolute inset-[10%] rounded-full"
        style={{
          background: `radial-gradient(circle at 50% 46%, rgba(255,248,238,${s.centerGlow * scale}) 0%, rgba(196,176,138,${s.centerGlow * 0.35 * scale}) 22%, transparent 62%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-full opacity-40"
        style={{
          background:
            "linear-gradient(125deg, rgba(255,255,255,0.04) 0%, transparent 42%, transparent 58%, rgba(196,176,138,0.03) 100%)",
        }}
      />
      <svg viewBox="0 0 200 200" className="relative h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="map-vignette" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="#0c0b0a" stopOpacity="0" />
            <stop offset="100%" stopColor="#0c0b0a" stopOpacity="0.85" />
          </radialGradient>
          <radialGradient id="map-core" cx="50%" cy="48%" r="18%">
            <stop offset="0%" stopColor="#f5f0e8" stopOpacity={s.centerGlow * 1.2} />
            <stop offset="100%" stopColor="#f5f0e8" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="200" height="200" fill="#0a0908" />

        {sectorPaths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill={
              i === fadeSector
                ? `rgba(168,160,148,${s.sectorOpacity * 0.45})`
                : `rgba(232,224,212,${s.sectorOpacity})`
            }
          />
        ))}

        {[92, 74, 56, 38].map((r) => (
          <circle
            key={r}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke={`rgba(255,255,255,${s.ringOpacity})`}
            strokeWidth="0.35"
          />
        ))}

        {[0, 45, 90, 135].map((deg) => (
          <line
            key={deg}
            x1="100"
            y1="100"
            x2="100"
            y2="14"
            stroke={`rgba(255,255,255,${s.ringOpacity * 0.6})`}
            strokeWidth="0.25"
            transform={`rotate(${deg} 100 100)`}
          />
        ))}

        <circle cx="100" cy="100" r="14" fill="url(#map-core)" />
        <circle cx="100" cy="100" r="92" fill="url(#map-vignette)" />

        {tone === "preliminary" ? (
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="rgba(196,176,138,0.12)"
            strokeWidth="0.5"
            strokeDasharray="3 5"
          />
        ) : null}
      </svg>
    </div>
  );
}

type Props = {
  empty?: boolean;
  tone?: OpticalMapTone;
};

export default function OpticalHeroStage({
  empty = false,
  tone = "balanced",
}: Props) {
  const mapTone: OpticalMapTone = empty ? "empty" : tone;

  if (empty) {
    return (
      <section className="overflow-hidden rounded-lg border border-[#2a2826]/10 bg-[#0a0908] shadow-[0_12px_40px_rgba(28,24,20,0.06)]">
        <div className="relative flex min-h-[260px] flex-col items-center justify-center px-6 py-14 md:min-h-[300px]">
          <div className="absolute inset-0 flex items-center justify-center">
            <InterpretationMap tone="empty" muted />
          </div>
          <p className="relative z-10 max-w-sm text-center font-serif text-lg text-[#e8e2d8] md:text-xl">
            Upload a report to begin your interpretation
          </p>
          <p className="relative z-10 mt-2 max-w-xs text-center text-xs leading-relaxed text-[#8a847c]">
            An interpretation map appears here once your report is read.
          </p>
        </div>
        <p className="border-t border-white/[0.06] px-6 py-2.5 text-center text-[9px] tracking-[0.06em] text-[#6f6a62]">
          {DISCLAIMER}
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[#2a2826]/15 bg-[#0a0908] shadow-[0_16px_48px_rgba(28,24,20,0.1)]">
      <div className="border-b border-white/[0.06] px-5 py-3 md:px-6">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#9a948c]">
          Optical interpretation map
        </p>
        <p className="mt-1 text-[10px] leading-snug text-[#6f6a62]">
          A restrained read of light return and contrast — not a laboratory scan.
        </p>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-[1fr_auto] md:p-7">
        <div className="flex items-center justify-center py-2">
          <InterpretationMap tone={mapTone} />
        </div>
        <ul className="flex flex-row flex-wrap gap-x-5 gap-y-2 md:flex-col md:gap-2.5 md:pt-6">
          {LEGEND.map((item) => (
            <li key={item.label} className="flex items-center gap-2.5">
              <span
                className="h-1.5 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[9px] uppercase tracking-[0.2em] text-[#b8b0a6]">
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="border-t border-white/[0.06] px-5 py-2.5 text-[9px] leading-snug tracking-[0.04em] text-[#6f6a62]">
        {DISCLAIMER}
      </p>
    </section>
  );
}

export function resolveOpticalMapTone(input: {
  hasReport: boolean;
  overallScore: number | null;
  needsExpertDiagramReview: boolean;
  interpretationLevel: string;
}): OpticalMapTone {
  if (!input.hasReport) return "empty";
  if (input.interpretationLevel === "basic") return "preliminary";
  if (input.needsExpertDiagramReview) return "conservative";
  if (input.overallScore !== null && input.overallScore >= 94) return "strong";
  if (input.overallScore !== null && input.overallScore >= 82) return "balanced";
  return "conservative";
}
