"use client";

import type { DiamondPurchasePersonality } from "@/lib/diamond-intelligence/diamond-purchase-personality";

const TONE_BORDER: Record<DiamondPurchasePersonality["tone"], string> = {
  positive: "border-[#e4dbcf]/60 bg-[#fdfbf7]/50",
  neutral: "border-[#ebe4da]/70 bg-white/30",
  caution: "border-[#e4dbcf]/75 bg-[#faf8f4]/60",
  negative: "border-[#e4dbcf]/80 bg-[#f8f5f0]/70",
};

export default function DiamondPurchasePersonalitySection({
  personality,
}: {
  personality: DiamondPurchasePersonality | null;
}) {
  if (!personality) return null;

  return (
    <div
      className={`mt-4 rounded-md border px-3.5 py-3.5 md:px-4 ${TONE_BORDER[personality.tone]}`}
    >
      <p className="text-[11px] tracking-[0.14em] text-[#6b5048]">
        What Kind of Diamond Is This?
      </p>
      <p className="mt-1 text-[11px] leading-[1.55] text-[#948a80]">
        A plain-English read on the diamond&apos;s strongest argument and main tradeoff.
      </p>
      <p className="mt-2.5 font-medium text-[#3a352f]">{personality.label}</p>
      <p className="mt-1 font-serif text-[13px] leading-[1.55] text-[#948a80]">
        {personality.translation}
      </p>
      <p className="mt-2 text-[12.5px] leading-[1.65] text-[#5f5851]">
        {personality.summary}
      </p>
      {personality.why.length > 0 ? (
        <ul className="mt-2.5 space-y-1 text-[12px] leading-[1.6] text-[#5f5851]">
          {personality.why.slice(0, 3).map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-[#c4b08a]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {personality.bestFor ? (
        <p className="mt-2.5 text-[12px] leading-[1.6] text-[#5f5851]">
          <span className="text-[#6b5048]">Best for: </span>
          {personality.bestFor}
        </p>
      ) : null}
      {personality.watchOutFor ? (
        <p className="mt-1.5 text-[12px] leading-[1.6] text-[#6f665d]">
          <span className="text-[#6b5048]">Worth knowing: </span>
          {personality.watchOutFor}
        </p>
      ) : null}
    </div>
  );
}
