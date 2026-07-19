"use client";

import { useState, type ReactNode, type SyntheticEvent } from "react";
import {
  DI_V3_CHAPTER,
  DI_V3_CHAPTER_BODY_STUDIO,
  DI_V3_CHAPTER_STUDIO,
  DI_V3_STUDIO_ACCORDION_GROUP,
} from "@/app/diamond-intelligence/components/di-v3-styles";

const bodyCopy =
  "space-y-4 text-[0.94rem] leading-[1.82] text-[var(--ink-soft)] md:text-[1rem] md:leading-[1.85]";

const introCopy =
  "text-[0.94rem] leading-[1.82] text-[var(--ink-soft)] md:text-[1rem] md:leading-[1.85]";

const summaryClass =
  "grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-3 px-[18px] py-[22px] text-[#1e1a16] transition-colors duration-200 ease-out hover:bg-[rgba(255,255,255,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hg-focus md:gap-[18px] md:px-[30px] md:py-7 [&::-webkit-details-marker]:hidden";

const titleClass =
  "block text-[11px] uppercase tracking-[0.11em] text-[#1e1a16] md:text-xs md:tracking-[0.15em]";

/**
 * Local studio accordion — open state stays inside Shape Studio so
 * Diamond Intelligence's DiV3Chapter remains untouched.
 */
function ShapeStudioExplainerChapter({
  number,
  title,
  chapterId,
  defaultOpen = false,
  children,
}: {
  number: string;
  title: string;
  chapterId: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    setOpen(event.currentTarget.open);
  };

  return (
    <details
      open={open}
      onToggle={handleToggle}
      className={`${DI_V3_CHAPTER} ${DI_V3_CHAPTER_STUDIO} group`}
      data-v3-chapter={chapterId}
    >
      <summary className={summaryClass}>
        <span className="font-serif text-lg leading-none text-[#b59662] opacity-90">
          {number}
        </span>
        <span className="min-w-0">
          <span className={titleClass}>{title}</span>
        </span>
        <span
          className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border border-[rgba(181,150,98,0.32)] bg-[rgba(181,150,98,0.07)] text-[17px] font-light leading-none text-[#b59662] transition-transform duration-200 ease-out group-open:hidden"
          aria-hidden
        >
          ＋
        </span>
        <span
          className="hidden h-[34px] w-[34px] shrink-0 place-items-center rounded-full border border-[rgba(181,150,98,0.32)] bg-[rgba(181,150,98,0.07)] text-[17px] font-light leading-none text-[#b59662] transition-transform duration-200 ease-out group-open:grid"
          aria-hidden
        >
          —
        </span>
      </summary>
      <div className={DI_V3_CHAPTER_BODY_STUDIO}>{children}</div>
    </details>
  );
}

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
          <ShapeStudioExplainerChapter
            number="01"
            title="How the card sets scale"
            chapterId="shape-card-sets-scale"
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
          </ShapeStudioExplainerChapter>

          <ShapeStudioExplainerChapter
            number="02"
            title="Why it may look different from Size Studio"
            chapterId="shape-vs-size-studio"
          >
            <div className={bodyCopy}>
              <p>
                Diamond Size Studio uses a standardized finger model associated
                with ring size. Scaled Preview uses the visible proportions of
                your photographed hand. Two people with the same ring size can
                have different top-down finger widths, so the same diamond may
                appear different while still using the same millimeter
                dimensions.
              </p>
            </div>
          </ShapeStudioExplainerChapter>

          <ShapeStudioExplainerChapter
            number="03"
            title="What the preview can and cannot show"
            chapterId="shape-preview-limits"
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
          </ShapeStudioExplainerChapter>
        </div>
      </div>
    </section>
  );
}
