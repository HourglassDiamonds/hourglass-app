/**
 * Read-only Today Person identity index.
 * Exact email-hash matches only. Does not mint, merge, or link Projects.
 */

import "server-only";

import type { TodayKnownPerson } from "@/lib/continuum/candidates/founder-attention";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { getSupabaseAdmin } from "@/lib/supabase/client";

const EMAIL_HASH_RE = /^[a-f0-9]{64}$/;

function normalizedHash(value: string | null | undefined): string | null {
  const hash = value?.trim().toLowerCase() ?? "";
  return EMAIL_HASH_RE.test(hash) ? hash : null;
}

export async function loadTodayKnownEmailPeople(): Promise<TodayKnownPerson[]> {
  const client = getSupabaseAdmin();
  if (!client) return [];
  try {
    const [profiles, identities] = await Promise.all([
      client
        .from("continuum_person_profiles")
        .select("person_id, display_name, roles, organization_name, email"),
      client
        .from("continuum_external_identities")
        .select("entity_id, identity_kind, identifier, revoked_at")
        .eq("identity_kind", "email_hash")
        .is("revoked_at", null),
    ]);
    if (profiles.error || identities.error) return [];
    const people = new Map<
      string,
      Omit<TodayKnownPerson, "emailHash"> & { hashes: Set<string> }
    >();
    for (const row of profiles.data ?? []) {
      const personId = String(row.person_id ?? "").trim();
      const displayName = String(row.display_name ?? "").trim();
      if (!personId || !displayName) continue;
      const hashes = new Set<string>();
      const fromEmail = hashEmail(row.email == null ? null : String(row.email));
      if (fromEmail) hashes.add(fromEmail);
      people.set(personId, {
        personId,
        displayName,
        roles: Array.isArray(row.roles) ? row.roles.map((role) => String(role)) : [],
        organizationName:
          row.organization_name == null ? null : String(row.organization_name),
        hashes,
      });
    }
    for (const row of identities.data ?? []) {
      const personId = String(row.entity_id ?? "").trim();
      const hash = normalizedHash(row.identifier == null ? null : String(row.identifier));
      if (!personId || !hash) continue;
      const person = people.get(personId);
      if (!person) continue;
      person.hashes.add(hash);
    }
    const out: TodayKnownPerson[] = [];
    for (const person of people.values()) {
      for (const emailHash of person.hashes) {
        out.push({
          personId: person.personId,
          displayName: person.displayName,
          roles: person.roles,
          organizationName: person.organizationName,
          emailHash,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}
