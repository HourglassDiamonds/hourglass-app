"use client";

import type { ReactNode } from "react";
import {
  DI_V3_CHAPTER,
  DI_V3_CHAPTER_BODY,
  DI_V3_CHAPTER_FEATURE,
} from "./di-v3-styles";

export type DiV3ChapterProps = {
  number: string;
  title: string;
  note: string;
  feature?: boolean;
  chapterId: string;
  children: ReactNode;
};

export default function DiV3Chapter({
  number,
  title,
  note,
  feature = false,
  chapterId,
  children,
}: DiV3ChapterProps) {
  return (
    <details
      className={`${DI_V3_CHAPTER} ${feature ? DI_V3_CHAPTER_FEATURE : ""}`}
      data-v3-chapter={chapterId}
    >
      <summary className="grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-3 px-[18px] py-[22px] text-[#1e1a16] transition-colors hover:bg-[rgba(255,255,255,0.18)] md:gap-[18px] md:px-[30px] md:py-7 [&::-webkit-details-marker]:hidden">
        <span className="font-serif text-lg leading-none text-[#b59662] opacity-90">
          {number}
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] uppercase tracking-[0.11em] text-[#1e1a16] md:text-xs md:tracking-[0.15em]">
            {title}
          </span>
          <span className="mt-1.5 block font-sans text-[12.5px] normal-case leading-snug tracking-normal text-[#9b8b78] md:text-[13px] md:leading-[1.4]">
            {note}
          </span>
        </span>
        <span
          className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border border-[rgba(181,150,98,0.32)] bg-[rgba(181,150,98,0.07)] text-[17px] font-light leading-none text-[#b59662] group-open:hidden"
          aria-hidden
        >
          ＋
        </span>
        <span
          className="hidden h-[34px] w-[34px] shrink-0 place-items-center rounded-full border border-[rgba(181,150,98,0.32)] bg-[rgba(181,150,98,0.07)] text-[17px] font-light leading-none text-[#b59662] group-open:grid"
          aria-hidden
        >
          —
        </span>
      </summary>
      <div className={DI_V3_CHAPTER_BODY}>{children}</div>
    </details>
  );
}
