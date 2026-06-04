"use client";

import type { ClarityReviewGuidance } from "@/lib/diamond-intelligence/clarity-review-guidance";

export default function ClarityReviewFlag({
  guidance,
}: {
  guidance: ClarityReviewGuidance | null;
}) {
  if (!guidance?.show) return null;

  const strong = guidance.tone === "strong";

  return (
    <div
      className={`rounded-lg border px-4 py-3.5 md:px-5 ${
        strong
          ? "border-[#e4dbcf]/80 bg-[#faf8f4]"
          : "border-[#ebe4da]/70 bg-white/40"
      }`}
    >
      <p className="text-[11px] tracking-[0.14em] text-[#6b5048]">
        {guidance.title}
      </p>
      <p className="mt-2 text-[13px] leading-[1.65] text-[#5f5851]">
        {guidance.body}
      </p>
    </div>
  );
}
