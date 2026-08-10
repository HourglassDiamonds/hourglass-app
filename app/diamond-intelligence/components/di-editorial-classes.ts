/** Shared editorial layout tokens — presentation only, matches Hourglass marketing pages. */

export const DI_PAGE = "mx-auto max-w-[1200px] px-6 md:px-10";

/** Primary narrative column — magazine article measure. */
export const DI_ARTICLE =
  "mx-auto w-full max-w-[42rem] lg:max-w-[44rem]";

/** Borderless editorial section — hierarchy via whitespace, not containers. */
export const DI_SECTION_EDITORIAL =
  "border-t border-[#e4dbcf]/30 py-14 first:border-t-0 first:pt-0 md:py-20 lg:py-[5rem]";

/** Appendix sections — technical transparency, demoted. */
export const DI_SECTION_APPENDIX =
  "border-t border-[#ebe4da]/20 py-8 md:py-10 opacity-[0.92]";

export const DI_SECTION_SUBDUED =
  "border-t border-[#ebe4da]/25 py-8 md:py-10";

export const DI_SECTION =
  "border-b border-[#e4dbcf]/45 py-14 md:py-[5.5rem] last:border-b-0";

export const DI_EYEBROW =
  "text-[10px] uppercase tracking-[0.32em] text-hg-eyebrow";

export const DI_EYEBROW_ACCENT =
  "text-[10px] uppercase tracking-[0.32em] text-[#a8926a]";

export const DI_EYEBROW_MUTED =
  "text-[10px] uppercase tracking-[0.28em] text-[#756a5f]";

export const DI_HEADLINE_SERIF =
  "font-serif font-normal tracking-[-0.025em] text-[#1f1d1a]";

/** Hero verdict — magazine headline scale. */
export const DI_HERO_VERDICT =
  "font-serif text-[2.5rem] font-normal leading-[1.04] tracking-[-0.035em] text-[#1f1d1a] sm:text-[3rem] md:text-[3.5rem] lg:text-[3.75rem]";

/** Emotional centerpiece — What You'll Likely Notice. */
export const DI_NOTICE_HEADLINE =
  "font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.035em] text-[#1f1d1a] sm:text-[2.6rem] md:text-[3.15rem] lg:text-[3.4rem]";

export const DI_SUBHEAD_SERIF =
  "font-serif text-[1.35rem] font-normal leading-[1.22] tracking-[-0.02em] text-[#1f1d1a] md:text-[1.5rem]";

export const DI_BODY =
  "text-[1rem] leading-[1.85] text-[#5f5851] md:text-[1.05rem] md:leading-[1.88]";

export const DI_BODY_LARGE =
  "text-[1.08rem] leading-[1.82] text-[#5f5851] md:text-[1.15rem] md:leading-[1.86]";

export const DI_BODY_MUTED =
  "text-[0.94rem] leading-[1.75] text-[#6d655e]";

export const DI_CAPTION =
  "text-[11px] leading-[1.65] tracking-[0.02em] text-[#6d655e]";

export const DI_LINK =
  "text-[#6b5048] underline underline-offset-4 transition-colors hover:text-[#1f1d1a]";

/** Subtle editorial rule between hero blocks. */
export const DI_RULE =
  "h-px w-full max-w-[4.5rem] bg-[#d8cebf]/70";

/** Reserved column for future hero / optical imagery integration. */
export const DI_HERO_GRID =
  "grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,36%)] lg:items-start lg:gap-14 xl:gap-20";

export const DI_HERO_VISUAL_SLOT =
  "relative hidden min-h-[320px] lg:block lg:min-h-[480px]";

export const DI_NOTICE_GRID =
  "grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,34%)] lg:items-start lg:gap-14";

export const DI_NOTICE_VISUAL_SLOT =
  "relative hidden min-h-[280px] lg:block";
