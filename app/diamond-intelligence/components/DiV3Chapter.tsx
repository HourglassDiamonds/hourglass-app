"use client";

import type { ReactNode } from "react";
import {
  DI_V3_CHAPTER,
  DI_V3_CHAPTER_ADVISOR,
  DI_V3_CHAPTER_BODY,
  DI_V3_CHAPTER_BODY_ADVISOR,
  DI_V3_CHAPTER_BODY_COMPACT,
  DI_V3_CHAPTER_BODY_FEATURE,
  DI_V3_CHAPTER_BODY_LANDING,
  DI_V3_CHAPTER_BODY_STUDIO,
  DI_V3_CHAPTER_COMPACT,
  DI_V3_CHAPTER_DEMOTED,
  DI_V3_CHAPTER_FEATURE,
  DI_V3_CHAPTER_LANDING,
  DI_V3_CHAPTER_STUDIO,
} from "./di-v3-styles";

export type DiV3ChapterProps = {
  number?: string;
  title: string;
  note?: string;
  feature?: boolean;
  advisor?: boolean;
  demoted?: boolean;
  landing?: boolean;
  studio?: boolean;
  compact?: boolean;
  defaultOpen?: boolean;
  chapterId: string;
  children: ReactNode;
};

export default function DiV3Chapter({
  number,
  title,
  note = "",
  feature = false,
  advisor = false,
  demoted = false,
  landing = false,
  studio = false,
  compact = false,
  defaultOpen = false,
  chapterId,
  children,
}: DiV3ChapterProps) {
  const bodyClass = advisor
    ? DI_V3_CHAPTER_BODY_ADVISOR
    : compact
      ? DI_V3_CHAPTER_BODY_COMPACT
      : studio
        ? DI_V3_CHAPTER_BODY_STUDIO
        : landing
          ? DI_V3_CHAPTER_BODY_LANDING
          : feature
            ? DI_V3_CHAPTER_BODY_FEATURE
            : DI_V3_CHAPTER_BODY;

  const hideNoteWhenOpen = landing || studio;
  const showNumber = Boolean(number) && !compact;
  const showCompactIndex = Boolean(number) && compact;
  const showNote = Boolean(note) && !compact;

  const summaryGridClass =
    showNumber || showCompactIndex
      ? "grid-cols-[auto_1fr_auto]"
      : "grid-cols-[1fr_auto]";

  const summaryClass = compact
    ? `grid cursor-pointer list-none ${summaryGridClass} items-start gap-3 px-4 py-4 text-[#1e1a16] transition-colors duration-200 ease-out hover:bg-[rgba(255,255,255,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b59662]/50 md:px-5 md:py-[18px] [&::-webkit-details-marker]:hidden`
    : `grid cursor-pointer list-none ${summaryGridClass} items-center gap-3 px-[18px] py-[22px] text-[#1e1a16] transition-colors duration-200 ease-out hover:bg-[rgba(255,255,255,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b59662]/50 md:gap-[18px] md:px-[30px] md:py-7 [&::-webkit-details-marker]:hidden`;

  const titleClass = compact
    ? "block font-serif text-[0.98rem] font-normal leading-[1.35] tracking-[-0.01em] text-[#1e1a16] md:text-[1.02rem]"
    : "block text-[11px] uppercase tracking-[0.11em] text-[#1e1a16] md:text-xs md:tracking-[0.15em]";

  /* 44×44 control affordance — summary remains the full-row hit target. */
  const controlSizeClass = compact
    ? "h-11 w-11 text-[15px]"
    : "h-11 w-11 text-[17px]";

  return (
    <details
      {...(defaultOpen ? { open: true } : {})}
      className={`${DI_V3_CHAPTER} ${feature ? DI_V3_CHAPTER_FEATURE : ""} ${advisor ? DI_V3_CHAPTER_ADVISOR : ""} ${demoted ? DI_V3_CHAPTER_DEMOTED : ""} ${landing ? DI_V3_CHAPTER_LANDING : ""} ${studio ? DI_V3_CHAPTER_STUDIO : ""} ${compact ? DI_V3_CHAPTER_COMPACT : ""}`}
      data-v3-chapter={chapterId}
    >
      <summary className={summaryClass}>
        {showNumber ? (
          <span className="font-serif text-lg leading-none text-[#b59662] opacity-90">
            {number}
          </span>
        ) : null}
        {showCompactIndex ? (
          <span className="pt-0.5 font-serif text-[10px] uppercase tracking-[0.14em] text-[#b59662] opacity-80">
            {number}
          </span>
        ) : null}
        <span className="min-w-0">
          <span className={titleClass}>{title}</span>
          {showNote ? (
            <span
              className={`mt-1.5 block font-sans text-[12.5px] normal-case leading-snug tracking-normal text-[#9b8b78] md:text-[13px] md:leading-[1.4] ${hideNoteWhenOpen ? "group-open:hidden" : ""}`}
            >
              {note}
            </span>
          ) : null}
        </span>
        <span
          className={`grid ${controlSizeClass} shrink-0 place-items-center rounded-full border border-[rgba(181,150,98,0.32)] bg-[rgba(181,150,98,0.07)] font-light leading-none text-[#b59662] transition-transform duration-200 ease-out group-open:hidden ${compact ? "mt-0.5" : ""}`}
          aria-hidden
        >
          ＋
        </span>
        <span
          className={`hidden ${controlSizeClass} shrink-0 place-items-center rounded-full border border-[rgba(181,150,98,0.32)] bg-[rgba(181,150,98,0.07)] font-light leading-none text-[#b59662] transition-transform duration-200 ease-out group-open:grid ${compact ? "mt-0.5" : ""}`}
          aria-hidden
        >
          —
        </span>
      </summary>
      <div className={bodyClass}>{children}</div>
    </details>
  );
}
