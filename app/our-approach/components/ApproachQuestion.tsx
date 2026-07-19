"use client";

import { renderInlineContent } from "@/app/diamond-guide/inline-content";
import type { ApproachQuestion as ApproachQuestionType } from "../content";

type ApproachQuestionProps = {
  item: ApproachQuestionType;
  chapterId: string;
};

export default function ApproachQuestion({
  item,
  chapterId,
}: ApproachQuestionProps) {
  const panelId = `approach-${chapterId}-${item.id}`;

  return (
    <details className="group/question border-b border-[rgba(181,150,98,0.14)] last:border-b-0">
      <summary
        className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-4 py-5 text-left transition-colors hover:bg-[rgba(255,255,255,0.12)] md:gap-6 md:py-7 [&::-webkit-details-marker]:hidden"
        aria-controls={panelId}
      >
        <span className="min-w-0 font-serif text-[1.02rem] font-normal leading-[1.44] tracking-[-0.015em] text-[#2a2622] md:text-[1.1rem] md:leading-[1.42]">
          {item.question}
        </span>
        <span
          className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[rgba(181,150,98,0.28)] bg-[rgba(181,150,98,0.06)] text-[15px] font-light leading-none text-[#b59662] group-open/question:hidden"
          aria-hidden
        >
          ＋
        </span>
        <span
          className="mt-0.5 hidden h-11 w-11 shrink-0 place-items-center rounded-full border border-[rgba(181,150,98,0.28)] bg-[rgba(181,150,98,0.06)] text-[15px] font-light leading-none text-[#b59662] group-open/question:grid"
          aria-hidden
        >
          —
        </span>
      </summary>
      <div
        id={panelId}
        className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-open/question:grid-rows-[1fr]"
      >
        <div className="overflow-hidden">
          <div className="space-y-4 pb-7 pr-1 text-[0.95rem] leading-[1.86] text-[#635d56] md:space-y-5 md:pb-8 md:pr-2 md:text-[1rem] md:leading-[1.88]">
            {item.paragraphs.map((paragraph, index) => (
              <p key={`${item.id}-p-${index}`}>{renderInlineContent(paragraph)}</p>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}
