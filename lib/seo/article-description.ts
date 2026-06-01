import type { ArticleBlock } from "@/app/diamond-guide/articles";

const MAX_DESCRIPTION_LENGTH = 160;
const MIN_SENTENCE_CUT = 80;

const FALLBACK_DESCRIPTION =
  "Practical diamond guidance from Hourglass Diamonds.";

function trimToMetaLength(text: string): string {
  if (text.length <= MAX_DESCRIPTION_LENGTH) return text;

  const window = text.slice(0, MAX_DESCRIPTION_LENGTH);
  const sentenceEnd = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("? "),
    window.lastIndexOf("! "),
  );
  if (sentenceEnd >= MIN_SENTENCE_CUT) {
    return text.slice(0, sentenceEnd + 1).trim();
  }

  const wordEnd = window.lastIndexOf(" ");
  if (wordEnd >= MIN_SENTENCE_CUT) {
    return `${text.slice(0, wordEnd).trim()}…`;
  }

  return text.slice(0, MAX_DESCRIPTION_LENGTH).trim();
}

/** First paragraph excerpt for meta description — no mid-sentence cuts when possible. */
export function articleMetaDescription(body: ArticleBlock[]): string {
  for (const block of body) {
    if (block.type !== "paragraph") continue;
    const normalized = block.text.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    return trimToMetaLength(normalized);
  }
  return FALLBACK_DESCRIPTION;
}
