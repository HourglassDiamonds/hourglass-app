import type { GuideSearchRecord } from "./guide-nav";

export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function searchGuideArticles(
  query: string,
  index: GuideSearchRecord[],
): GuideSearchRecord[] {
  const tokens = normalizeSearch(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return [];

  return index.filter((record) =>
    tokens.every((token) => record.haystack.includes(token)),
  );
}
