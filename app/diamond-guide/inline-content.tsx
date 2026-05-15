import Link from "next/link";
import type { ReactNode } from "react";

const INLINE_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

export function renderInlineContent(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  INLINE_LINK_RE.lastIndex = 0;
  while ((match = INLINE_LINK_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <Link
        key={key++}
        href={match[2]!}
        className="text-[#6a635c] underline underline-offset-4 transition hover:text-[#1f1d1a]"
      >
        {match[1]}
      </Link>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
