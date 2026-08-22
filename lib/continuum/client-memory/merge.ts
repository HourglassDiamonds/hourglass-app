/**
 * Import profile merge policy.
 * blank dest + populated import → populate
 * same normalized value → idempotent
 * different nonblank dest → review/conflict (never overwrite)
 */

import type { PersonProfile } from "./types";

export const PROTECTED_PROFILE_FIELDS = [
  "displayName",
  "givenName",
  "familyName",
  "organizationName",
  "email",
  "phone",
  "streetAddress",
  "city",
  "state",
  "country",
  "postalCode",
] as const;

export type ProtectedProfileField = (typeof PROTECTED_PROFILE_FIELDS)[number];

export type ProfileMergePlan =
  | { status: "unchanged" }
  | { status: "populate"; patch: Partial<PersonProfile> }
  | { status: "conflict"; field: ProtectedProfileField };

export function normalizeProfileValue(
  field: ProtectedProfileField,
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (field === "email") return trimmed.toLowerCase();
  return trimmed;
}

export function planProfileMerge(
  existing: PersonProfile,
  incoming: Partial<Pick<PersonProfile, ProtectedProfileField>>,
): ProfileMergePlan {
  const patch: Partial<PersonProfile> = {};
  let changed = false;
  for (const field of PROTECTED_PROFILE_FIELDS) {
    const next = normalizeProfileValue(field, incoming[field]);
    if (next == null) continue;
    const dest = normalizeProfileValue(field, existing[field]);
    if (dest == null) {
      patch[field] = incoming[field]?.trim() ?? next;
      changed = true;
      continue;
    }
    if (dest !== next) {
      return { status: "conflict", field };
    }
  }
  return changed ? { status: "populate", patch } : { status: "unchanged" };
}
