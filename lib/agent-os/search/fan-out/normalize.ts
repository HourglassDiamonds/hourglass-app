/**
 * Deterministic text normalization for fan-out matching.
 */

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "and",
  "or",
  "but",
  "if",
  "than",
  "then",
  "that",
  "this",
  "these",
  "those",
  "it",
  "its",
  "as",
  "at",
  "by",
  "from",
  "into",
  "about",
  "can",
  "could",
  "should",
  "would",
  "do",
  "does",
  "did",
  "how",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "i",
  "you",
  "we",
  "they",
  "my",
  "your",
  "our",
  "me",
  "more",
  "most",
  "vs",
  "versus",
]);

export function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(raw: string): string[] {
  const normalized = normalizeText(raw);
  if (!normalized) return [];
  return normalized
    .split(/[\s-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

export function uniqueTokens(raw: string): Set<string> {
  return new Set(tokenize(raw));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function termOverlapRatio(
  requiredTerms: string[],
  haystack: string,
): { ratio: number; matched: string[] } {
  const hay = uniqueTokens(haystack);
  const matched: string[] = [];
  for (const term of requiredTerms) {
    const parts = tokenize(term);
    if (parts.length === 0) continue;
    const allPresent = parts.every((p) => hay.has(p) || haystack.includes(normalizeText(term)));
    if (allPresent || hay.has(normalizeText(term).replace(/\s+/g, ""))) {
      matched.push(term);
      continue;
    }
    // Multi-word phrase containment
    if (normalizeText(haystack).includes(normalizeText(term))) {
      matched.push(term);
    }
  }
  const ratio = requiredTerms.length === 0 ? 0 : matched.length / requiredTerms.length;
  return { ratio, matched };
}

export function slugifyFanOutId(raw: string): string {
  return (
    normalizeText(raw)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "unknown"
  );
}
