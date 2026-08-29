/**
 * Order identifier quality guard.
 * Words such as "order", "invoice", "confirmation" are never identifiers.
 * Does not broaden generic number extraction. Does not add PO unless contracted.
 * Numeric captures such as 555 remain extractable but are weak discovery keys.
 * Evidence only — does not write project specs. automaticApply: false.
 */

import {
  classifyIdentifierSpecificity,
  identifierTokensMatch,
  type IdentifierSpecificity,
} from "./identifier-specificity";

export const ORDER_IDENTIFIER_STOPWORDS = [
  "order",
  "orders",
  "invoice",
  "invoices",
  "confirmation",
  "confirm",
  "update",
  "updates",
  "presentation",
  "number",
  "no",
  "po",
  "the",
  "for",
  "of",
  "to",
  "is",
  "a",
  "an",
  "and",
  "or",
  "this",
  "that",
  "your",
  "our",
] as const;

const STOPWORD_SET = new Set<string>(ORDER_IDENTIFIER_STOPWORDS);

/**
 * Requires a digit in the captured token so "order\\nOrder #555" cannot
 * consume the word "Order" and miss "555". Allows structured values
 * such as AB-555 and ORD-1001.
 */
const ORDER_NUMBER_PATTERN =
  /\border(?:\s*(?:#|number|no\.?))?\s*[:#]?\s*((?:[A-Za-z]+-)*\d[A-Za-z0-9]*(?:-[A-Za-z0-9]+)*)\b/gi;

function compactToken(value: string): string {
  return value.replace(/^[#:-]+/, "").replace(/[#:-]+$/, "").trim();
}

export function isPlausibleOrderIdentifier(value: string): boolean {
  const token = compactToken(value);
  if (token.length < 1 || token.length > 32) return false;
  const lower = token.toLowerCase();
  if (STOPWORD_SET.has(lower)) return false;
  if (!/\d/.test(token)) return false;
  if (!/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(token)) return false;
  return true;
}

function pushUnique(into: string[], value: string): void {
  if (!isPlausibleOrderIdentifier(value)) return;
  const token = compactToken(value);
  if (!into.some((existing) => existing.toLowerCase() === token.toLowerCase())) {
    into.push(token);
  }
}

export type OrderIdentifierStrength = IdentifierSpecificity;

export function classifyOrderIdentifierStrength(
  value: string,
): OrderIdentifierStrength | null {
  if (!isPlausibleOrderIdentifier(value)) return null;
  return classifyIdentifierSpecificity(compactToken(value));
}

export function isStrongStructuredOrderIdentifier(value: string): boolean {
  return classifyOrderIdentifierStrength(value) === "strong_structured";
}

export function extractOrderIdentifiers(text: string): string[] {
  const found: string[] = [];
  if (!text.trim()) return found;

  ORDER_NUMBER_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(ORDER_NUMBER_PATTERN)) {
    pushUnique(found, match[1] ?? "");
  }

  return found;
}

export function candidateHasTypedOrderIdentifier(
  text: string,
  value: string,
): boolean {
  return extractOrderIdentifiers(text).some((order) =>
    identifierTokensMatch(order, value),
  );
}
