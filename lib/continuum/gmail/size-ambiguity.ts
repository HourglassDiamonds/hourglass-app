/**
 * Narrow defensive guard for hedged finger-size language.
 * Does not apply Slice C. Does not infer 141/140 adjacency.
 */

const SIZE_TOKEN = "(?:[1-9]|[12]\\d|30)(?:\\.(?:0|00|25|5|50|75))?";

function escapeSize(value: string): string {
  return value.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function sizeLanguageIsAmbiguous(
  text: string,
  proposedValue: string,
): boolean {
  const hay = compact(text);
  const size = proposedValue.trim();
  if (!hay || !size) return false;
  const escaped = escapeSize(size);
  const patterns = [
    new RegExp(`(?:^|[^\\d.])${escaped}(?:[^\\d.]|$)\\s*or\\s*${SIZE_TOKEN}\\b`, "i"),
    new RegExp(`\\b${SIZE_TOKEN}\\s+or\\s+${escaped}(?![\\d.])`, "i"),
    new RegExp(`\\bbetween\\s+${SIZE_TOKEN}\\s+and\\s+${SIZE_TOKEN}\\b`, "i"),
    new RegExp(
      `\\b(?:maybe|perhaps|approximately|approx\\.?|around|about)\\s+(?:a\\s+|an\\s+)?(?:(?:ring|finger)\\s+size\\s+)?${escaped}(?![\\d.])`,
      "i",
    ),
    new RegExp(`(?:^|[^\\d.])${escaped}-ish\\b`, "i"),
    new RegExp(
      `\\bnot\\s+sure\\s+if\\s+(?:(?:ring|finger)\\s+size\\s+)?${escaped}(?![\\d.])`,
      "i",
    ),
  ];
  return patterns.some((pattern) => pattern.test(hay));
}

export function fingerSizeLanguageIsAmbiguous(
  text: string,
  proposedValue: string,
): boolean {
  return sizeLanguageIsAmbiguous(text, proposedValue);
}
