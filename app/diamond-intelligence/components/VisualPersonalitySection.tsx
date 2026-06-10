"use client";

import type { VisualPersonality } from "@/lib/diamond-intelligence/visual-personality";
import DiEditorialFacetMotif from "./DiEditorialFacetMotif";
import { DI_EYEBROW_STUDIO, DI_SERIF_HEADLINE } from "./di-studio-styles";

export default function VisualPersonalitySection({
  personality,
}: {
  personality: VisualPersonality | null;
}) {
  if (!personality) return null;

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-[#efe4d7] px-8 py-16 md:px-14 md:py-24 lg:py-28">
      <DiEditorialFacetMotif variant="notice" />

      <div className="relative">
        <p className={DI_EYEBROW_STUDIO}>What You&apos;ll Likely Notice</p>

        <p
          className={`${DI_SERIF_HEADLINE} mt-8 max-w-5xl text-4xl leading-[1.08] tracking-[-0.03em] md:mt-10 md:text-6xl md:leading-[1.06] xl:text-7xl xl:leading-[1.04]`}
          style={{ textWrap: "balance" }}
        >
          {personality.displayTitle}
        </p>

        <p
          className="mt-10 max-w-3xl text-lg leading-8 text-[#5f5148] md:mt-12 md:text-xl md:leading-9"
          style={{ textWrap: "balance" }}
        >
          {personality.explanation}
        </p>
      </div>
    </section>
  );
}
