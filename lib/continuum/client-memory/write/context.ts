/**
 * Deterministic Add Note default from Person roles.
 * Convenience only. Justin can always change the layer.
 * Does not infer or persist roles from the chosen layer.
 *
 * Mixed-role priority:
 * 1. client or prospect → client
 * 2. else business-contact or vendor-contact → networking
 * 3. else personal, family, or friend → personal
 * 4. otherwise no suggestion (UI requires explicit selection)
 */

import type { PersonRole } from "../types";
import type { RelationshipContextLayer } from "../types";

export function suggestRelationshipContextLayer(
  roles: readonly string[],
): RelationshipContextLayer | null {
  const set = new Set(roles);
  if (set.has("client") || set.has("prospect")) return "client";
  if (set.has("business-contact") || set.has("vendor-contact")) {
    return "networking";
  }
  if (set.has("personal") || set.has("family") || set.has("friend")) {
    return "personal";
  }
  return null;
}

export function hasSuggestedClientDefault(roles: readonly PersonRole[]): boolean {
  return suggestRelationshipContextLayer(roles) === "client";
}
