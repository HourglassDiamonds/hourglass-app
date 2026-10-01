import { CERTIFICATE_READER_FAQS } from "./certificate-reader-educational";
import { CHARLOTTE_ADVISOR_FAQS } from "./charlotte-advisor-educational";
import { CLARITY_FAQS } from "./clarity-educational";
import { COLOR_FAQS } from "./color-educational";
import { CUT_FAQS } from "./cut-educational";
import { FLUORESCENCE_FAQS } from "./fluorescence-educational";
import { LAB_NATURAL_FAQS } from "./lab-natural-educational";

export type ArticleFaq = {
  question: string;
  answer: string;
};

const ARTICLE_FAQS: Readonly<Record<string, readonly ArticleFaq[]>> = {
  "charlotte-diamond-advisor-guide": CHARLOTTE_ADVISOR_FAQS,
  "how-to-read-a-diamond-certificate": CERTIFICATE_READER_FAQS,
  "natural-vs-lab-diamonds": LAB_NATURAL_FAQS,
  "what-is-diamond-fluorescence": FLUORESCENCE_FAQS,
  "what-is-diamond-clarity": CLARITY_FAQS,
  "what-is-diamond-color": COLOR_FAQS,
  "what-is-diamond-cut": CUT_FAQS,
};

export function articleFaqsForSlug(slug: string): readonly ArticleFaq[] {
  return ARTICLE_FAQS[slug] ?? [];
}
