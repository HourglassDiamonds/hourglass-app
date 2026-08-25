/**
 * Domain Edit Person writer.
 * Overwrites the current contact card on an existing Person UUID.
 * Never creates a Person, merges people, or edits roles/address/facts.
 */

import { randomUUID } from "node:crypto";
import { hashEmail, hashPhone } from "../hashes";
import { resolvePersonIdentity, type IdentityLookup } from "../identity";
import type {
  UpdatePersonContactInput,
  UpdatePersonContactResult,
} from "../store";
import type { PersonProfile } from "../types";
import {
  isManualPersonUuid,
  parseManualPersonFields,
  resolveEditedDisplayName,
} from "./parse";
import {
  MANUAL_PERSON_SOURCE_SYSTEM,
  type EditPersonProfileInput,
  type EditPersonProfileResult,
  type EditPersonProfileValidationCode,
} from "./types";

export type EditPersonProfileDeps = {
  nowIso: () => string;
  findActiveIdentities: IdentityLookup["findActiveIdentities"];
  getPersonProfile: (personId: string) => Promise<PersonProfile | null>;
  updatePersonContactAtomic: (
    input: UpdatePersonContactInput,
  ) => Promise<UpdatePersonContactResult>;
};

function validationError(
  code: EditPersonProfileValidationCode,
  message: string,
): EditPersonProfileResult {
  return { status: "validation-error", code, message };
}

function isIdentityRace(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("identity_conflict") ||
    message.includes("duplicate key") ||
    message.includes("23505") ||
    message.includes("continuum_external_identities_active_uq")
  );
}

export async function editPersonProfile(
  deps: EditPersonProfileDeps,
  input: EditPersonProfileInput,
): Promise<EditPersonProfileResult> {
  const personId = input.personId.trim();
  const submissionId = input.submissionId.trim();
  if (!isManualPersonUuid(personId) || !isManualPersonUuid(submissionId)) {
    return validationError("invalid-id", "Unable to save the profile.");
  }

  try {
    const existing = await deps.getPersonProfile(personId);
    if (!existing) return { status: "person-not-found" };

    const parsed = parseManualPersonFields(input, {
      requireEmail: Boolean(existing.email),
      requirePhone: Boolean(existing.phone),
    });
    if (!parsed.ok) {
      return validationError(parsed.code, parsed.message);
    }

    const displayName = resolveEditedDisplayName(
      existing,
      parsed.value.givenName,
      parsed.value.familyName,
    );
    if (!displayName) {
      return validationError("missing-name", "Enter a first or last name.");
    }

    const identities: UpdatePersonContactInput["identities"] = [];
    if (parsed.value.email) {
      const identifier = hashEmail(parsed.value.email);
      if (!identifier) {
        return validationError("invalid-email", "Enter a valid email.");
      }
      identities.push({
        id: randomUUID(),
        identityKind: "email_hash",
        identifier,
        sourceSystem: MANUAL_PERSON_SOURCE_SYSTEM,
        createdAt: deps.nowIso(),
      });
    }
    if (parsed.value.phone) {
      const identifier = hashPhone(parsed.value.phone);
      if (!identifier) {
        return validationError("invalid-phone", "Enter a valid U.S. phone number.");
      }
      identities.push({
        id: randomUUID(),
        identityKind: "phone_hash",
        identifier,
        sourceSystem: MANUAL_PERSON_SOURCE_SYSTEM,
        createdAt: deps.nowIso(),
      });
    }

    if (identities.length > 0) {
      const resolution = await resolvePersonIdentity(deps, {
        email: parsed.value.email,
        phone: parsed.value.phone,
      });
      if (resolution.status === "matched" && resolution.personId !== personId) {
        return {
          status: "identity-conflict",
          conflictingPersonIds: resolution.personId
            ? [resolution.personId]
            : resolution.conflictingPersonIds,
        };
      }
      if (resolution.status === "review") {
        return {
          status: "identity-conflict",
          conflictingPersonIds: resolution.conflictingPersonIds.filter(
            (id) => id !== personId,
          ),
        };
      }
      if (resolution.status === "invalid") {
        return validationError("invalid-email", "Unable to save the profile.");
      }
    }

    const now = deps.nowIso();
    const applied = await deps.updatePersonContactAtomic({
      personId,
      updatedAt: now,
      profile: {
        displayName,
        givenName: parsed.value.givenName,
        familyName: parsed.value.familyName,
        organizationName: parsed.value.organizationName,
        email: parsed.value.email,
        phone: parsed.value.phone,
      },
      identities: identities.map((identity) => ({
        ...identity,
        createdAt: now,
      })),
    });
    if (applied.status === "conflict") {
      return { status: "identity-conflict", conflictingPersonIds: [] };
    }
    return { status: "updated", personId };
  } catch (error) {
    if (isIdentityRace(error)) {
      return { status: "identity-conflict", conflictingPersonIds: [] };
    }
    return { status: "error" };
  }
}
