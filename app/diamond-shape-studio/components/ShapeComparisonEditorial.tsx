"use client";

import DiV3Chapter from "@/app/diamond-intelligence/components/DiV3Chapter";
import { DI_V3_STUDIO_ACCORDION_GROUP } from "@/app/diamond-intelligence/components/di-v3-styles";
import ConsultationCtaLink from "@/app/shared-components/ConsultationCtaLink";

const bodyCopy =
  "space-y-4 text-[0.94rem] leading-[1.82] text-[var(--ink-soft)] md:text-[1rem] md:leading-[1.85]";

const introCopy =
  "text-[0.94rem] leading-[1.82] text-[var(--ink-soft)] md:text-[1rem] md:leading-[1.85]";

export default function ShapeComparisonEditorial() {
  return (
    <section
      className="dss-editorial border-t border-[#e4dbcf]/40 bg-[var(--bg)] px-6 pb-14 pt-8 md:px-10 md:pb-20 md:pt-10"
      aria-labelledby="dss-editorial-heading"
    >
      <div className="mx-auto w-full max-w-[50rem]">
        <h2
          id="dss-editorial-heading"
          className="font-serif text-[1.65rem] font-normal leading-[1.2] tracking-[-0.02em] text-[var(--ink)] md:text-[1.85rem]"
        >
          How the preview works
        </h2>

        <div className={`${introCopy} mt-5 max-w-[40rem] md:mt-6`}>
          <p>
            The card in your photograph gives the image a known physical
            reference. Once marked, it allows the studio to translate pixels
            into millimeters and place the diamond at representative face-up
            dimensions on your actual hand.
          </p>
        </div>

        <div className={DI_V3_STUDIO_ACCORDION_GROUP}>
          <DiV3Chapter
            number="01"
            title="How the card sets scale"
            chapterId="shape-card-sets-scale"
            studio
            defaultOpen
          >
            <div className={bodyCopy}>
              <p>
                A standard-size card has known dimensions. After you mark its
                long edge, the studio measures how many image pixels span that
                distance. That relationship creates a physical scale for the
                photograph. For the most reliable result, keep the card and hand
                on roughly the same plane and photograph them as directly
                overhead as practical.
              </p>
            </div>
          </DiV3Chapter>

          <DiV3Chapter
            number="02"
            title="Why it may look different from Size Studio"
            chapterId="shape-vs-size-studio"
            studio
          >
            <div className={bodyCopy}>
              <p>
                Size Studio uses a standardized finger model associated with
                ring size. See It On Your Hand uses the visible proportions of
                your photographed hand. Two people with the same ring size can
                have different top-down finger widths, so the same diamond may
                appear different while still using the same millimeter
                dimensions.
              </p>
            </div>
          </DiV3Chapter>

          <DiV3Chapter
            number="03"
            title="What the preview can and cannot show"
            chapterId="shape-preview-limits"
            studio
          >
            <div className={bodyCopy}>
              <p>
                This tool is designed to compare shape, face-up size, and overall
                presence. It does not estimate ring size or predict fit. Carat is
                weight, not a fixed physical size, so the preview uses
                representative dimensions for each shape and carat. Final ring
                size and the exact measurements of a selected diamond should be
                confirmed before purchase.
              </p>
            </div>
          </DiV3Chapter>
        </div>

        <aside
          className="mt-12 border-t border-[#e4dbcf]/60 pt-9 text-center md:mt-14 md:pt-11"
          aria-labelledby="dss-concierge-exit-heading"
          data-dss-concierge-exit
        >
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--hg-eyebrow,#6d655e)]">
            Concierge
          </p>
          <h3
            id="dss-concierge-exit-heading"
            className="mt-3 font-serif text-[1.35rem] font-normal leading-[1.25] tracking-[-0.015em] text-[var(--ink)] md:text-[1.5rem]"
          >
            Seeing it on the hand is a beginning
          </h3>
          <p className={`${introCopy} mx-auto mt-4 max-w-[36rem]`}>
            A calibrated preview shows how a shape may sit. Settling on the
            diamond, ratio, and setting that belong there still benefits from
            a closer look together.
          </p>
          <p className="mt-6">
            <ConsultationCtaLink
              location="shape_studio:result"
              tool="diamond-shape-studio"
              className="inline-flex min-h-11 items-center border-b border-[var(--hg-line-strong,#d9cdbd)] pb-1 text-sm tracking-[0.04em] text-[var(--ink)] transition-colors duration-300 hover:border-[var(--hg-gold-deep,#987648)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hg-focus"
            >
              Begin the Conversation →
            </ConsultationCtaLink>
          </p>
        </aside>
      </div>
    </section>
  );
}
