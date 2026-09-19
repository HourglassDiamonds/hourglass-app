/**
 * Gmail harvest helpers for typed identifier roles.
 * Does not write Project specs.
 */

import { classifyIdentifierRole, type IdentifierRole } from "@/lib/continuum/candidates/identifier-role";
import { compactIdentifierToken, identifierTokensMatch } from "./identifier-specificity";
import {
  extractCadJobIdentifiers,
  hasBoundedIdentifierToken,
  isStrongStructuredCadIdentifier,
} from "./cad-job-identifier";

export {
  classifyIdentifierRole,
  identifierRolesAreSameField,
  IDENTIFIER_ROLES,
  type IdentifierRole,
} from "@/lib/continuum/candidates/identifier-role";

export type TypedIdentifierHit = {
  role: IdentifierRole;
  value: string;
};

export function extractTypedIdentifiers(text: string): TypedIdentifierHit[] {
  const hits: TypedIdentifierHit[] = [];
  const seen = new Set<string>();
  for (const raw of extractCadJobIdentifiers(text)) {
    const value = compactIdentifierToken(raw);
    if (!value) continue;
    const role = classifyIdentifierRole(value, text);
    if (!isStrongStructuredCadIdentifier(value)) continue;
    const key = `${role}:${value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ role, value });
  }
  return hits;
}

export function historicalQuotedIdentifiers(
  ownText: string,
  quotedText: string,
): TypedIdentifierHit[] {
  const own = new Set(
    extractTypedIdentifiers(ownText).map(
      (hit) => `${hit.role}:${hit.value.toLowerCase()}`,
    ),
  );
  return extractTypedIdentifiers(quotedText).filter(
    (hit) => !own.has(`${hit.role}:${hit.value.toLowerCase()}`),
  );
}

export function identifierBindsToCurrentProject(
  value: string,
  input: {
    subject?: string | null;
    ownText?: string | null;
    attachmentNames?: readonly string[];
    canonicalValues?: readonly string[];
  },
): boolean {
  const token = compactIdentifierToken(value);
  if (!token) return false;
  if (hasBoundedIdentifierToken(input.subject ?? "", token)) return true;
  for (const name of input.attachmentNames ?? []) {
    if (hasBoundedIdentifierToken(name, token)) return true;
  }
  for (const canonical of input.canonicalValues ?? []) {
    if (identifierTokensMatch(canonical, token)) return true;
  }
  const own = (input.ownText ?? "").trim();
  if (!hasBoundedIdentifierToken(own, token)) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const leftover = own
    .replace(new RegExp(escaped, "ig"), " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = leftover.split(/\s+/).filter((word) => word.length > 2);
  return words.length >= 3;
}
