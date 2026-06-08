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
    <DashboardCard title="What You'll Likely Notice" tone="default">
      <h4 className="font-serif text-[1.35rem] leading-[1.15] tracking-[-0.02em] text-[#1f1d1a] md:text-[1.5rem]">
        {personality.displayTitle}
      </h4>
      <p className="mt-4 max-w-2xl text-[1rem] leading-[1.78] text-[#5f5851]">
        {personality.explanation}
      </p>
      <p className="mt-4 text-[11px] leading-[1.6] tracking-[0.02em] text-[#948a80]">
        What you may notice on the hand — from report proportions, not verified
        optical imaging.
      </p>
    </DashboardCard>
  );
}
