/**
 * Gmail harvest helpers for typed identifier roles.
 * Does not write Project specs.
 */

import { classifyIdentifierRole, type IdentifierRole } from "@/lib/continuum/candidates/identifier-role";
import { compactIdentifierToken } from "./identifier-specificity";
import { extractCadJobIdentifiers, isStrongStructuredCadIdentifier } from "./cad-job-identifier";

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
