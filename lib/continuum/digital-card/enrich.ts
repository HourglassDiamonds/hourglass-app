/**
 * Fill-blank-only Person enrichment for a confident digital-card match.
 * Never overwrites populated fields. Name differences are skipped, not merged.
 */

import {
  normalizeProfileValue,
  type ProtectedProfileField,
} from "@/lib/continuum/client-memory/merge";
import type { PersonProfile } from "@/lib/continuum/client-memory/types";
import type { SubmittedContact } from "./types";

const ENRICH_FIELDS = [
  "givenName",
  "familyName",
  "organizationName",
  "email",
  "phone",
] as const satisfies readonly ProtectedProfileField[];

export function planContactEnrichment(
  existing: PersonProfile,
  incoming: SubmittedContact,
): Partial<Pick<PersonProfile, ProtectedProfileField>> {
  const incomingProfile: Partial<Pick<PersonProfile, ProtectedProfileField>> = {
    givenName: incoming.givenName,
    familyName: incoming.familyName,
    organizationName: incoming.company,
    email: incoming.email,
    phone: incoming.phone,
  };
  const patch: Partial<Pick<PersonProfile, ProtectedProfileField>> = {};
  for (const field of ENRICH_FIELDS) {
    const next = normalizeProfileValue(field, incomingProfile[field]);
    if (next == null) continue;
    const dest = normalizeProfileValue(field, existing[field]);
    if (dest == null) {
      patch[field] = incomingProfile[field]?.trim() ?? next;
    }
  }
  if (!normalizeProfileValue("displayName", existing.displayName) && incoming.displayName.trim()) {
    patch.displayName = incoming.displayName.trim();
  }
  return patch;
}
