"use client";

const LEGEND = [
  { color: "#f5efe4", label: "Bright return" },
  { color: "#d46450", label: "Fire potential" },
  { color: "#7ab896", label: "Scintillation" },
  { color: "#5a82a8", label: "Contrast" },
  { color: "#a06050", label: "Leakage control" },
] as const;

const DISCLAIMER =
  "Illustrative optical visualization — not a laboratory scan.";

function OpticalSilhouette({ muted }: { muted?: boolean }) {
  const opacity = muted ? 0.4 : 1;

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[min(400px,74vw)]"
      style={{ opacity }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, rgba(255,248,238,0.35) 0%, rgba(212,192,152,0.18) 32%, transparent 68%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-[8%] rounded-full blur-2xl"
        style={{
          background:
            "conic-gradient(from 200deg at 50% 45%, rgba(196,92,74,0.12), rgba(106,159,130,0.1), rgba(90,130,168,0.12), rgba(255,248,235,0.2), rgba(196,92,74,0.08))",
        }}
      />
      {!muted ? (
        <div
          className="pointer-events-none absolute left-[12%] top-[18%] h-[28%] w-[55%] rotate-[-18deg] animate-pulse rounded-full blur-xl opacity-50"
          style={{
            background:
              "linear-gradient(105deg, transparent, rgba(255,255,255,0.28), transparent)",
          }}
        />
      ) : null}
      <svg
        viewBox="0 0 200 200"
        className="relative h-full w-full drop-shadow-[0_24px_48px_rgba(0,0,0,0.35)]"
        aria-hidden
      >
        <defs>
          <radialGradient id="optical-field" cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor="#3d3832" stopOpacity="1" />
            <stop offset="45%" stopColor="#252220" stopOpacity="1" />
            <stop offset="100%" stopColor="#141210" stopOpacity="1" />
          </radialGradient>
          <radialGradient id="table-gleam" cx="50%" cy="40%" r="32%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={muted ? 0.08 : 0.38} />
            <stop offset="55%" stopColor="#fff8ee" stopOpacity={muted ? 0.03 : 0.12} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="rim-light" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5ebe0" stopOpacity="0.75" />
            <stop offset="45%" stopColor="#d4c4a8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#8aa8c8" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="facet-fill" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <circle cx="100" cy="100" r="94" fill="url(#optical-field)" />

        {[78, 64, 50].map((r, i) => (
          <circle
            key={r}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={0.5 - i * 0.1}
          />
        ))}

        <path
          d="M100 26 L130 52 L142 88 L130 126 L100 152 L70 126 L58 88 L70 52 Z"
          fill="url(#facet-fill)"
          stroke="url(#rim-light)"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        <path
          d="M100 46 L114 62 L118 88 L110 110 L100 120 L90 110 L82 88 L86 62 Z"
          fill="url(#table-gleam)"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="0.45"
        />

        {[0, 45, 90, 135, 22.5, 67.5, 112.5, 157.5].map((deg) => (
          <line
            key={deg}
            x1="100"
            y1="100"
            x2="100"
            y2="34"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="0.35"
            transform={`rotate(${deg} 100 100)`}
          />
        ))}

        <ellipse
          cx="100"
          cy="44"
          rx="26"
          ry="8"
          fill="#ffffff"
          opacity={muted ? 0.06 : 0.18}
        />

        <circle cx="120" cy="70" r="3.5" fill="#d46450" opacity={muted ? 0.12 : 0.35} />
        <circle cx="78" cy="106" r="3" fill="#7ab896" opacity={muted ? 0.1 : 0.28} />
        <circle cx="110" cy="120" r="2.5" fill="#5a82a8" opacity={muted ? 0.08 : 0.25} />
      </svg>
    </div>
  );
}

type Props = {
  empty?: boolean;
};

export default function OpticalHeroStage({ empty = false }: Props) {
  if (empty) {
    return (
      <section className="overflow-hidden rounded-lg border border-[#2a2826]/12 bg-gradient-to-b from-[#221f1c] to-[#161514] shadow-[0_16px_48px_rgba(28,24,20,0.08)]">
        <div className="relative flex min-h-[280px] flex-col items-center justify-center px-6 py-12 md:min-h-[320px]">
          <div className="absolute inset-0 flex items-center justify-center">
            <OpticalSilhouette muted />
          </div>
          <p className="relative z-10 max-w-sm text-center font-serif text-lg text-[#f0ebe3] md:text-xl">
            Upload a report to begin your interpretation
          </p>
          <p className="relative z-10 mt-2 max-w-xs text-center text-xs leading-relaxed text-[#a39d94]">
            An illustrative optical view will appear here after your report is
            read.
          </p>
        </div>
        <p className="border-t border-white/10 px-6 py-2.5 text-center text-[9px] tracking-[0.08em] text-[#7a756c]">
          {DISCLAIMER}
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[#3a3530]/25 bg-gradient-to-b from-[#2a2622] via-[#1f1d1a] to-[#181614] shadow-[0_20px_60px_rgba(28,24,20,0.14)]">
      <div className="border-b border-white/10 px-5 py-3 md:px-6">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#c4bcb2]">
          Optical visualization
        </p>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-[1fr_auto] md:p-6">
        <div className="flex items-center justify-center py-3">
          <OpticalSilhouette />
        </div>
        <ul className="flex flex-row flex-wrap gap-4 md:flex-col md:gap-2.5 md:pt-4">
          {LEGEND.map((item) => (
            <li key={item.label} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full border border-white/20"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[9px] uppercase tracking-[0.18em] text-[#e8e2d8]">
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="border-t border-white/10 px-5 py-2.5 text-[9px] leading-snug tracking-[0.06em] text-[#8a847c]">
        {DISCLAIMER}
      </p>
    </section>
  );
}
