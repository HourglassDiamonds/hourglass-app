"use client";

import type { DiamondPurchasePersonality } from "@/lib/diamond-intelligence/diamond-purchase-personality";

const TONE_SURFACE: Record<DiamondPurchasePersonality["tone"], string> = {
  positive: "bg-[#fdfbf7]/60 ring-[#e4dbcf]/40",
  neutral: "bg-white/25 ring-[#ebe4da]/45",
  caution: "bg-[#faf8f4]/70 ring-[#e4dbcf]/45",
  negative: "bg-[#f8f5f0]/80 ring-[#e4dbcf]/50",
};

export default function DiamondPurchasePersonalitySection({
  personality,
}: {
  personality: DiamondPurchasePersonality | null;
}) {
  if (!personality) return null;

  return (
    <div
      className={`rounded-lg px-4 py-4 ring-1 md:px-5 md:py-5 ${TONE_SURFACE[personality.tone]}`}
    >
      <p className="text-[10px] uppercase tracking-[0.28em] text-[#6b5048]">
        What This Diamond Is
      </p>
      <p className="mt-2.5 font-serif text-[1.15rem] leading-[1.2] tracking-[-0.02em] text-[#1f1d1a] md:text-[1.22rem]">
        {personality.label}
      </p>
      <p className="mt-2 font-serif text-[13px] leading-[1.58] text-[#6d655e]">
        {personality.translation}
      </p>
      <p className="mt-3 text-[13px] leading-[1.72] text-[#5f5851]">
        {personality.summary}
      </p>
      {personality.why.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-[12px] leading-[1.65] text-[#5f5851]">
          {personality.why.slice(0, 3).map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-[#c4b08a]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {personality.bestFor ? (
        <p className="mt-3 text-[12px] leading-[1.65] text-[#5f5851]">
          <span className="text-[#6b5048]">Best for: </span>
          {personality.bestFor}
        </p>
      ) : null}
      {personality.watchOutFor ? (
        <p className="mt-1.5 text-[12px] leading-[1.65] text-[#6f665d]">
          <span className="text-[#6b5048]">Worth knowing: </span>
          {personality.watchOutFor}
        </p>
      ) : null}
    </div>
  );
}
