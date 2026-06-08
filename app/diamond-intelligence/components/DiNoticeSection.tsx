"use client";

import type { VisualPersonality } from "@/lib/diamond-intelligence/visual-personality";
import DiEditorialImage from "./DiEditorialImage";
import { resolveNoticeImageSlot } from "./di-editorial-imagery";
import {
  DI_BODY,
  DI_BODY_MUTED,
  DI_EYEBROW,
  DI_HEADLINE_SERIF,
  DI_SECTION,
} from "./di-editorial-classes";

export default function DiNoticeSection({
  personality,
}: {
  personality: VisualPersonality | null;
}) {
  if (!personality) return null;

  const imageSlot = resolveNoticeImageSlot(personality.archetype);

  return (
    <section className={DI_SECTION}>
      <div className="overflow-hidden rounded-[28px] bg-[#f3ede5]/40 ring-1 ring-[#e4dbcf]/30">
        <div className="grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="flex flex-col justify-center px-7 py-10 md:px-11 md:py-12 lg:px-14">
            <p className={DI_EYEBROW}>What You&apos;ll Likely Notice</p>
            <h2
              className={`${DI_HEADLINE_SERIF} mt-5 max-w-[16ch] text-[1.75rem] leading-[1.12] md:text-[2.1rem]`}
              style={{ textWrap: "balance" }}
            >
              {personality.displayTitle}
            </h2>
            <p className={`${DI_BODY} mt-6 max-w-lg`}>{personality.explanation}</p>
            <p className={`${DI_BODY_MUTED} mt-5 max-w-md text-[0.86rem]`}>
              What you may notice on the hand — from report proportions, not
              verified optical imaging.
            </p>
          </div>

          <DiEditorialImage
            slot={imageSlot}
            variant="notice"
            className="min-h-[240px] md:min-h-full"
          />
        </div>
      </div>
    </section>
  );
}
