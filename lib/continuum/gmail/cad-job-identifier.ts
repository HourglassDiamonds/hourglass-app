/**
 * CAD / job identifier quality guard.
 * Words like "presentation" after "CAD" are not job identifiers.
 * Evidence only — does not write project specs. automaticApply: false.
 */

export const CAD_IDENTIFIER_STOPWORDS = [
  "presentation",
  "design",
  "render",
  "renders",
  "rendering",
  "revision",
  "revisions",
  "update",
  "updates",
  "approval",
  "approvals",
  "approved",
  "file",
  "files",
  "image",
  "images",
  "pdf",
  "attached",
  "attachment",
  "please",
  "new",
  "the",
  "for",
  "of",
  "to",
  "is",
  "a",
  "an",
] as const;

const STOPWORD_SET = new Set<string>(CAD_IDENTIFIER_STOPWORDS);

const CAD_CODE_PATTERN = /\b(CAD-\d+[A-Za-z0-9-]*)\b/gi;
const CAD_PREFIX_PATTERN =
  /\bCAD(?:\s*(?:#|number|no\.?))?\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9-]{1,62})\b/gi;
const JOB_PREFIX_PATTERN =
  /\bjob(?:\s*(?:#|number|no\.?))?\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9-]{1,62})\b/gi;

function compactToken(value: string): string {
  return value.replace(/^-+/, "").trim();
}

export function isPlausibleCadJobIdentifier(value: string): boolean {
  const token = compactToken(value);
  if (token.length < 1 || token.length > 32) return false;
  const lower = token.toLowerCase();
  if (STOPWORD_SET.has(lower)) return false;
  if (!/\d/.test(token)) return false;
  if (!/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(token)) return false;
  return true;
}

function pushUnique(into: string[], value: string): void {
  if (!isPlausibleCadJobIdentifier(value)) return;
  const token = compactToken(value);
  if (!into.some((existing) => existing.toLowerCase() === token.toLowerCase())) {
    into.push(token);
  }
}

export function extractCadJobIdentifiers(text: string): string[] {
  const found: string[] = [];
  if (!text.trim()) return found;

  CAD_CODE_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(CAD_CODE_PATTERN)) {
    pushUnique(found, match[1] ?? "");
  }

  CAD_PREFIX_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(CAD_PREFIX_PATTERN)) {
    pushUnique(found, match[1] ?? "");
  }

  JOB_PREFIX_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(JOB_PREFIX_PATTERN)) {
    pushUnique(found, match[1] ?? "");
  }

  return found;
}
