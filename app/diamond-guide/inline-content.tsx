import Link from "next/link";
import type { ReactNode } from "react";
import ConsultationCtaLink from "@/app/shared-components/ConsultationCtaLink";
import { isBareConciergeHref } from "@/lib/consultation-cta";

const INLINE_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

const INLINE_LINK_CLASS =
  "text-[#6a635c] underline underline-offset-4 transition hover:text-[#1f1d1a]";

export type RenderInlineContentOptions = {
  /** Current article slug — used to attribute bare /concierge links only. */
  articleSlug?: string;
};

/**
 * Renders markdown-style inline links.
 * Bare `/concierge` destinations become attributed Concierge CTAs when
 * `articleSlug` is provided; all other hrefs are left unchanged.
 */
export function renderInlineContent(
  text: string,
  options?: RenderInlineContentOptions,
): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  const articleSlug = options?.articleSlug;

  INLINE_LINK_RE.lastIndex = 0;
  while ((match = INLINE_LINK_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const label = match[1]!;
    const href = match[2]!;

    if (articleSlug && isBareConciergeHref(href)) {
      parts.push(
        <ConsultationCtaLink
          key={key++}
          location="guide_article:inline"
          tool="diamond-guide"
          content={articleSlug}
          className={INLINE_LINK_CLASS}
        >
          {label}
        </ConsultationCtaLink>,
      );
    } else {
      parts.push(
        <Link key={key++} href={href} className={INLINE_LINK_CLASS}>
          {label}
        </Link>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
