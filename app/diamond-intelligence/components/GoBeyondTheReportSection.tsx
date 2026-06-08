"use client";

import Link from "next/link";
import {
  buildConciergeHrefFromDiamondIntelligence,
  type DiamondIntelligenceConciergeContext,
} from "@/lib/concierge/diamond-intelligence-context";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";

export default function GoBeyondTheReportSection({
  visible,
  reportContext,
}: {
  visible: boolean;
  reportContext?: DiamondIntelligenceConciergeContext;
}) {
  if (!visible) return null;

  const conciergeHref = buildConciergeHrefFromDiamondIntelligence(
    reportContext ?? {},
  );

  return (
    <section className="rounded-xl border border-[#e4dbcf]/45 bg-[#faf8f5]/85 py-7 pl-5 pr-5 shadow-[0_2px_16px_rgba(48,36,28,0.03)] md:py-9 md:pl-6 md:pr-7 lg:pl-7">
      <div className="border-l-2 border-[#c4b08a]/55 pl-5 md:pl-6">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,220px)] lg:items-start lg:gap-10 xl:gap-14">
          <div>
            <h2 className="font-serif text-[1.15rem] font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.22rem]">
              Go Beyond the Report
            </h2>
            <div className="mt-5 max-w-2xl space-y-3.5 text-[13px] leading-[1.75] text-[#5f5851]">
              <p>A grading report is one piece of the story.</p>
              <p>
                This analysis interprets what the report suggests, but it cannot
                verify eye-clean appearance, transparency, video performance, or
                optical imaging.
              </p>
              <p>
                Many diamonds appear similar on paper. The differences that
                matter most often emerge when reviewing video, optical imaging,
                transparency, and side-by-side comparisons.
              </p>
              <p>
                After evaluating thousands of diamonds throughout his career as
                a Graduate Gemologist, Justin&apos;s role is rarely to interpret
                the report itself.
              </p>
              <p>
                The more valuable work is identifying what the report does not
                reveal and helping clients compare strong candidates before
                making a final decision.
              </p>
            </div>
          </div>

          <div className="mt-7 border-t border-[#ebe4da]/50 pt-6 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-1 xl:pl-10">
            <Link
              href={conciergeHref}
              className="inline-flex text-[11px] tracking-[0.12em] text-[#6b5048] underline underline-offset-4 transition-colors hover:text-[#1f1d1a]"
              onClick={() =>
                trackConsultationCtaClicked(
                  "diamond_intelligence:go_beyond_report",
                )
              }
            >
              Get Justin&apos;s Perspective
            </Link>
            <p className="mt-4 text-[10.5px] leading-[1.65] text-[#b0a698]">
              Additional review may include video, optical imaging, supplier
              verification, and side-by-side comparison when available.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
