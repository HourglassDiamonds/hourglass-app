"use client";

import DiV3Chapter from "@/app/diamond-intelligence/components/DiV3Chapter";
import type { ApproachChapter as ApproachChapterType } from "../content";
import ApproachQuestion from "./ApproachQuestion";

type ApproachChapterProps = {
  chapter: ApproachChapterType;
};

export default function ApproachChapter({ chapter }: ApproachChapterProps) {
  return (
    <DiV3Chapter
      number={chapter.number}
      title={chapter.title}
      note={chapter.intro}
      chapterId={chapter.id}
    >
      <div className="-mx-1 pt-1 pb-2 md:-mx-2 md:pt-2 md:pb-3">
        {chapter.questions.map((question) => (
          <ApproachQuestion
            key={question.id}
            item={question}
            chapterId={chapter.id}
          />
        ))}
      </div>
    </DiV3Chapter>
  );
}
