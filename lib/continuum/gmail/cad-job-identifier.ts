/**
 * CAD / job identifier quality guard.
 * Words like "presentation" after "CAD" are not job identifiers.
 * URL / cid / query / hash fragments are never CAD identifiers.
 * Generic hexadecimal tokens are not CAD evidence without typed CAD/job
 * context. Short numeric and short structured tokens remain extractable
 * but are weak discovery keys. Prefix stripping (CAD A-1 → A-1) does not
 * create a bare global needle.
 * Evidence only — does not write project specs. automaticApply: false.
 */

import {
  classifyIdentifierSpecificity,
  identifierTokensMatch,
  type IdentifierSpecificity,
} from "./identifier-specificity";

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
const J_CODE_PATTERN = /\b(J-\d+[A-Za-z0-9-]*)\b/gi;
const STRUCTURED_ALNUM_JOB_PATTERN = /\b([A-Z]{2,}\d{3,}[A-Za-z0-9]*)\b/g;
const LINK_CONTEXT_PATTERN =
  /(?:https?:\/\/|www\.|cid:)[^\s<>"')\]]+/gi;
const UUID_FRAGMENT_PATTERN =
  /\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi;
const QUERY_OR_HASH_PATTERN = /[?#][^\s<>"']+/g;
const MIN_HEX_FRAGMENT_LENGTH = 6;

export type CadIdentifierStrength = IdentifierSpecificity;

function compactToken(value: string): string {
  return value.replace(/^-+/, "").trim();
}

export function maskNonCadLinkContexts(text: string): string {
  return text
    .replace(LINK_CONTEXT_PATTERN, " ")
    .replace(UUID_FRAGMENT_PATTERN, " ")
    .replace(QUERY_OR_HASH_PATTERN, " ");
}

/**
 * Untyped hex / content-id style fragments (DB865C70, 8-char hashes).
 * Typed CAD/job context may still capture these via CAD-/job prefixes.
 */
export function isGenericHexadecimalCadFragment(value: string): boolean {
  const token = compactToken(value).replace(/-/g, "");
  if (token.length < MIN_HEX_FRAGMENT_LENGTH) return false;
  return /^[0-9A-Fa-f]+$/.test(token);
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

export function classifyCadIdentifierStrength(
  value: string,
): CadIdentifierStrength | null {
  if (!isPlausibleCadJobIdentifier(value)) return null;
  return classifyIdentifierSpecificity(compactToken(value));
}

export function isStrongStructuredCadIdentifier(value: string): boolean {
  return classifyCadIdentifierStrength(value) === "strong_structured";
}

export function hasBoundedIdentifierToken(haystack: string, token: string): boolean {
  const needle = compactToken(token);
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?:$|[^A-Za-z0-9])`, "i").test(
    haystack,
  );
}

export function candidateHasTypedCadIdentifier(
  text: string,
  value: string,
): boolean {
  return extractCadJobIdentifiers(text).some((cad) =>
    identifierTokensMatch(cad, value),
  );
}

function pushUnique(into: string[], value: string): void {
  if (!isPlausibleCadJobIdentifier(value)) return;
  const token = compactToken(value);
  if (!into.some((existing) => existing.toLowerCase() === token.toLowerCase())) {
    into.push(token);
  }
}

function pushTyped(into: string[], value: string): void {
  pushUnique(into, value);
}

function pushUntypedStructured(into: string[], value: string): void {
  if (isGenericHexadecimalCadFragment(value)) return;
  pushUnique(into, value);
}

export function extractCadJobIdentifiers(text: string): string[] {
  const found: string[] = [];
  if (!text.trim()) return found;
  const hay = maskNonCadLinkContexts(text);

  CAD_CODE_PATTERN.lastIndex = 0;
  for (const match of hay.matchAll(CAD_CODE_PATTERN)) {
    pushTyped(found, match[1] ?? "");
  }

  CAD_PREFIX_PATTERN.lastIndex = 0;
  for (const match of hay.matchAll(CAD_PREFIX_PATTERN)) {
    pushTyped(found, match[1] ?? "");
  }

  JOB_PREFIX_PATTERN.lastIndex = 0;
  for (const match of hay.matchAll(JOB_PREFIX_PATTERN)) {
    pushTyped(found, match[1] ?? "");
  }

  J_CODE_PATTERN.lastIndex = 0;
  for (const match of hay.matchAll(J_CODE_PATTERN)) {
    pushTyped(found, match[1] ?? "");
  }

  STRUCTURED_ALNUM_JOB_PATTERN.lastIndex = 0;
  for (const match of hay.matchAll(STRUCTURED_ALNUM_JOB_PATTERN)) {
    pushUntypedStructured(found, match[1] ?? "");
  }

  return found;
}

export function supportingKnownCadIdentifiers(
  text: string,
  knownIdentifiers: readonly string[],
): string[] {
  const found: string[] = [];
  for (const known of knownIdentifiers) {
    if (!isStrongStructuredCadIdentifier(known)) continue;
    if (!hasBoundedIdentifierToken(text, known)) continue;
    pushUnique(found, known);
  }
  return found;
}
