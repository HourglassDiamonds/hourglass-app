"use client";

import type { VisualPersonality } from "@/lib/diamond-intelligence/visual-personality";
import { DashboardCard } from "./DashboardCard";

export default function VisualPersonalitySection({
  personality,
}: {
  personality: VisualPersonality | null;
}) {
  if (!personality) return null;

  return (
    <DashboardCard
      title="What You'll Likely Notice"
      tone="subdued"
      className="!shadow-none md:col-span-2 xl:col-span-1"
    >
      <p className="mb-1 text-[11px] tracking-[0.14em] text-[#6b5048]">
        {personality.displayTitle}
      </p>
      <p className="text-sm leading-[1.65] text-[#5f5851]">
        {personality.explanation}
      </p>
      <p className="mt-3 text-[11px] leading-[1.55] text-[#948a80]">
        What you may notice on the hand — from report proportions, not verified optical imaging.
      </p>
    </DashboardCard>
  );
}
