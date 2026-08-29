/**
 * Conservative identifier specificity for discovery and routing.
 * Punctuation or a short prefix does not imply strong mailbox identity.
 * Evidence classification only — does not write project specs.
 */

export const IDENTIFIER_SPECIFICITY_CLASSES = [
  "strong_structured",
  "weak_numeric",
  "weak_short_structured",
] as const;

export type IdentifierSpecificity =
  (typeof IDENTIFIER_SPECIFICITY_CLASSES)[number];

/**
 * Structured tokens need at least this many digits before they may act
 * as independent project identity. AB-555 (3) is strong; J-12 (2) is not.
 */
export const MIN_STRONG_STRUCTURED_DIGIT_COUNT = 3;

/** Supporting/review points for a typed weak identifier. Not identity. */
export const WEAK_IDENTIFIER_SUPPORT_SCORE = 20;

export function compactIdentifierToken(value: string): string {
  return value.replace(/^[#:-]+/, "").replace(/[#:-]+$/, "").trim();
}

export function countIdentifierDigits(value: string): number {
  return compactIdentifierToken(value).replace(/\D/g, "").length;
}

export function classifyIdentifierSpecificity(
  value: string,
): IdentifierSpecificity {
  const token = compactIdentifierToken(value);
  if (!token || /^\d+$/.test(token)) return "weak_numeric";
  if (countIdentifierDigits(token) < MIN_STRONG_STRUCTURED_DIGIT_COUNT) {
    return "weak_short_structured";
  }
  return "strong_structured";
}

export function isStrongStructuredIdentifier(value: string): boolean {
  return classifyIdentifierSpecificity(value) === "strong_structured";
}

export function isWeakIdentifierSpecificity(
  strength: IdentifierSpecificity | string | null | undefined,
): boolean {
  return strength === "weak_numeric" || strength === "weak_short_structured";
}

export function identifierRequiresTypedContext(value: string): boolean {
  return isWeakIdentifierSpecificity(classifyIdentifierSpecificity(value));
}

export function identifierTokensMatch(left: string, right: string): boolean {
  return (
    compactIdentifierToken(left).toLowerCase() ===
    compactIdentifierToken(right).toLowerCase()
  );
}
