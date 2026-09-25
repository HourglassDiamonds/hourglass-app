/**
 * SMS person resolution.
 * A unique phone hash may bind to an existing Person.
 * Unknown numbers stay evidence. Shared numbers are never guessed.
 * No Person is minted.
 */

import type { SmsIdentityRuleId } from "@/lib/continuum/source-events/types";
import type { SmsIdentityPerson, SmsIdentityWorld, SmsParticipant } from "./types";

const VENDOR_ROLES = new Set(["vendor-contact", "business-contact"]);
const WORK_CONTACT_ROLES = new Set(["client", "vendor-contact", "business-contact"]);

export type SmsIdentityDecision = {
  status: "matched" | "vendor-context" | "review" | "evidence";
  personId: string | null;
  person: SmsIdentityPerson | null;
  phoneHash: string | null;
  personIds: readonly string[];
  ruleId: SmsIdentityRuleId;
  mintPerson: false;
};

function peopleForHash(
  world: SmsIdentityWorld,
  phoneHash: string,
): SmsIdentityPerson[] {
  return world.people.filter((person) => person.phoneHash === phoneHash);
}

function decision(input: Omit<SmsIdentityDecision, "mintPerson">): SmsIdentityDecision {
  return { ...input, mintPerson: false };
}

export function isVendorRole(role: SmsIdentityPerson["role"]): boolean {
  return role != null && VENDOR_ROLES.has(role);
}

export function isWorkContactRole(role: SmsIdentityPerson["role"]): boolean {
  return role != null && WORK_CONTACT_ROLES.has(role);
}

export function isInternalPhoneHash(
  phoneHash: string | null,
  world: SmsIdentityWorld,
): boolean {
  return Boolean(phoneHash && world.internalPhoneHashes.includes(phoneHash));
}

export function resolveSmsPersonIdentity(
  participant: SmsParticipant,
  world: SmsIdentityWorld,
): SmsIdentityDecision {
  if (participant.classification !== "us-compatible" || !participant.phoneHash) {
    return decision({
      status: "evidence",
      personId: null,
      person: null,
      phoneHash: participant.phoneHash,
      personIds: [],
      ruleId: "unhashable_phone_evidence_first",
    });
  }

  const phoneHash = participant.phoneHash;
  if (isInternalPhoneHash(phoneHash, world)) {
    return decision({
      status: "evidence",
      personId: null,
      person: null,
      phoneHash,
      personIds: [],
      ruleId: "internal_number",
    });
  }

  const hits = peopleForHash(world, phoneHash);
  const personIds = [...new Set(hits.map((row) => row.personId))];
  const shared = world.sharedPhoneHashes.includes(phoneHash);

  if (shared) {
    if (personIds.length === 0) {
      return decision({
        status: "evidence",
        personId: null,
        person: null,
        phoneHash,
        personIds: [],
        ruleId: "unknown_number_evidence_first",
      });
    }
    return decision({
      status: "review",
      personId: null,
      person: null,
      phoneHash,
      personIds,
      ruleId: "family_or_shared_unresolved",
    });
  }

  if (personIds.length > 1) {
    return decision({
      status: "review",
      personId: null,
      person: null,
      phoneHash,
      personIds,
      ruleId: "ambiguous_shared_number",
    });
  }

  const person = hits[0] ?? null;
  if (person && isVendorRole(person.role)) {
    return decision({
      status: "vendor-context",
      personId: person.personId,
      person,
      phoneHash,
      personIds,
      ruleId: "vendor_or_business_number",
    });
  }

  if (person) {
    return decision({
      status: "matched",
      personId: person.personId,
      person,
      phoneHash,
      personIds,
      ruleId: "unique_phone_hash",
    });
  }

  return decision({
    status: "evidence",
    personId: null,
    person: null,
    phoneHash,
    personIds: [],
    ruleId: "unknown_number_evidence_first",
  });
}

export function existingPersonById(
  world: SmsIdentityWorld,
  personId: string | null,
): SmsIdentityPerson | null {
  if (!personId) return null;
  return world.people.find((person) => person.personId === personId) ?? null;
}
