"use client";

import type { ReactNode } from "react";
import {
  DI_V3_CHAPTER,
  DI_V3_CHAPTER_ADVISOR,
  DI_V3_CHAPTER_BODY,
  DI_V3_CHAPTER_BODY_ADVISOR,
  DI_V3_CHAPTER_BODY_FEATURE,
  DI_V3_CHAPTER_BODY_LANDING,
  DI_V3_CHAPTER_DEMOTED,
  DI_V3_CHAPTER_FEATURE,
  DI_V3_CHAPTER_LANDING,
} from "./di-v3-styles";

export type DiV3ChapterProps = {
  number: string;
  title: string;
  note: string;
  feature?: boolean;
  advisor?: boolean;
  demoted?: boolean;
  landing?: boolean;
  chapterId: string;
  children: ReactNode;
};

export default function DiV3Chapter({
  number,
  title,
  note,
  feature = false,
  advisor = false,
  demoted = false,
  landing = false,
  chapterId,
  children,
}: DiV3ChapterProps) {
  const bodyClass = advisor
    ? DI_V3_CHAPTER_BODY_ADVISOR
    : landing
      ? DI_V3_CHAPTER_BODY_LANDING
      : feature
        ? DI_V3_CHAPTER_BODY_FEATURE
        : DI_V3_CHAPTER_BODY;

  return (
    <details
      className={`${DI_V3_CHAPTER} ${feature ? DI_V3_CHAPTER_FEATURE : ""} ${advisor ? DI_V3_CHAPTER_ADVISOR : ""} ${demoted ? DI_V3_CHAPTER_DEMOTED : ""} ${landing ? DI_V3_CHAPTER_LANDING : ""}`}
      data-v3-chapter={chapterId}
    >
      <summary className="grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-3 px-[18px] py-[22px] text-[#1e1a16] transition-colors duration-200 ease-out hover:bg-[rgba(255,255,255,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b59662]/50 md:gap-[18px] md:px-[30px] md:py-7 [&::-webkit-details-marker]:hidden">
        <span className="font-serif text-lg leading-none text-[#b59662] opacity-90">
          {number}
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] uppercase tracking-[0.11em] text-[#1e1a16] md:text-xs md:tracking-[0.15em]">
            {title}
          </span>
          <span
            className={`mt-1.5 block font-sans text-[12.5px] normal-case leading-snug tracking-normal text-[#9b8b78] md:text-[13px] md:leading-[1.4] ${landing ? "group-open:hidden" : ""}`}
          >
            {note}
          </span>
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
      <div className={bodyClass}>{children}</div>
    </details>
  );
}
