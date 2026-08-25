/**
 * Domain Add Client writer.
 * Creates a canonical Person or recognizes an existing one by exact email/phone.
 * Never merges on name. Never overwrites an existing profile from the form.
 */

import { unionPersonRoles } from "../contracts";
import {
  classifyPhone,
  hashEmail,
  hashPhone,
  normalizeEmail,
} from "../hashes";
import { resolvePersonIdentity, type IdentityLookup } from "../identity";
import type {
  CreatePersonAtomicInput,
  CreatePersonAtomicResult,
} from "../store";
import type { PersonProfile, PersonRole } from "../types";
import {
  MANUAL_PERSON_CREATED_BY,
  MANUAL_PERSON_EMAIL_MAX_LENGTH,
  MANUAL_PERSON_NAME_MAX_LENGTH,
  MANUAL_PERSON_ORGANIZATION_MAX_LENGTH,
  MANUAL_PERSON_SOURCE_SYSTEM,
  type AddManualClientInput,
  type AddManualClientResult,
  type AddManualClientValidationCode,
} from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CLIENT_ROLE: PersonRole = "client";

export type AddManualClientDeps = {
  nowIso: () => string;
  findActiveIdentities: IdentityLookup["findActiveIdentities"];
  createPersonAtomic: (
    input: CreatePersonAtomicInput,
  ) => Promise<CreatePersonAtomicResult>;
  getPersonProfile: (personId: string) => Promise<PersonProfile | null>;
  updatePersonProfile: (
    personId: string,
    patch: { roles: PersonRole[]; updatedAt: string },
  ) => Promise<PersonProfile | null>;
};

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function trimToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function validationError(
  code: AddManualClientValidationCode,
  message: string,
): AddManualClientResult {
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

function displayNameFromParts(
  givenName: string | null,
  familyName: string | null,
): string {
  return [givenName, familyName].filter(Boolean).join(" ");
}

async function ensureClientRole(
  deps: AddManualClientDeps,
  personId: string,
  now: string,
): Promise<"ok" | "error"> {
  const existing = await deps.getPersonProfile(personId);
  if (!existing) return "error";
  if (existing.roles.includes(CLIENT_ROLE)) return "ok";
  const updated = await deps.updatePersonProfile(personId, {
    roles: unionPersonRoles(existing.roles, [CLIENT_ROLE]),
    updatedAt: now,
  });
  return updated ? "ok" : "error";
}

function parseInput(input: AddManualClientInput): AddManualClientResult | {
  submissionId: string;
  givenName: string | null;
  familyName: string | null;
  displayName: string;
  organizationName: string | null;
  email: string | null;
  phone: string | null;
} {
  const submissionId = input.submissionId.trim();
  if (!isUuid(submissionId)) {
    return validationError("invalid-id", "Unable to save the client.");
  }

  const givenName = trimToNull(input.givenName);
  const familyName = trimToNull(input.familyName);
  if (!givenName && !familyName) {
    return validationError("missing-name", "Enter a first or last name.");
  }
  if (
    (givenName && givenName.length > MANUAL_PERSON_NAME_MAX_LENGTH) ||
    (familyName && familyName.length > MANUAL_PERSON_NAME_MAX_LENGTH)
  ) {
    return validationError("oversized-name", "That name is too long.");
  }

  const organizationName = trimToNull(input.organization);
  if (
    organizationName &&
    organizationName.length > MANUAL_PERSON_ORGANIZATION_MAX_LENGTH
  ) {
    return validationError(
      "oversized-organization",
      "That organization name is too long.",
    );
  }

  const emailRaw = trimToNull(input.email);
  if (emailRaw && emailRaw.length > MANUAL_PERSON_EMAIL_MAX_LENGTH) {
    return validationError("invalid-email", "Enter a valid email, or leave it blank.");
  }
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  if (emailRaw && !email) {
    return validationError("invalid-email", "Enter a valid email, or leave it blank.");
  }

  const phoneRaw = trimToNull(input.phone);
  let phone: string | null = null;
  if (phoneRaw) {
    const classified = classifyPhone(phoneRaw);
    if (classified.status !== "us-compatible") {
      return validationError(
        "invalid-phone",
        "Enter a valid U.S. phone number, or leave it blank.",
      );
    }
    phone = classified.normalized;
  }

  return {
    submissionId,
    givenName,
    familyName,
    displayName: displayNameFromParts(givenName, familyName),
    organizationName,
    email,
    phone,
  };
}

export async function addManualClient(
  deps: AddManualClientDeps,
  input: AddManualClientInput,
): Promise<AddManualClientResult> {
  const parsed = parseInput(input);
  if ("status" in parsed) return parsed;

  const now = deps.nowIso();
  const hasIdentity = Boolean(parsed.email || parsed.phone);

  try {
    if (hasIdentity) {
      const resolved = await resolveExisting(deps, parsed.email, parsed.phone);
      if (resolved.status !== "new") return resolved;
    }

    return await createNewPerson(deps, parsed, now);
  } catch {
    return { status: "error" };
  }
}

async function resolveExisting(
  deps: AddManualClientDeps,
  email: string | null,
  phone: string | null,
): Promise<
  | { status: "new" }
  | Extract<
      AddManualClientResult,
      | { status: "existing-person" }
      | { status: "identity-conflict" }
      | { status: "validation-error" }
      | { status: "error" }
    >
> {
  const resolution = await resolvePersonIdentity(deps, { email, phone });
  if (resolution.status === "new") return { status: "new" };
  if (resolution.status === "matched" && resolution.personId) {
    const now = deps.nowIso();
    const role = await ensureClientRole(deps, resolution.personId, now);
    if (role === "error") return { status: "error" };
    return { status: "existing-person", personId: resolution.personId };
  }
  if (resolution.status === "review") {
    return {
      status: "identity-conflict",
      conflictingPersonIds: resolution.conflictingPersonIds,
    };
  }
  return { status: "error" };
}

async function createNewPerson(
  deps: AddManualClientDeps,
  parsed: {
    submissionId: string;
    givenName: string | null;
    familyName: string | null;
    displayName: string;
    organizationName: string | null;
    email: string | null;
    phone: string | null;
  },
  now: string,
): Promise<AddManualClientResult> {
  const identities: CreatePersonAtomicInput["identities"] = [];
  if (parsed.email) {
    const identifier = hashEmail(parsed.email);
    if (!identifier) {
      return validationError("invalid-email", "Enter a valid email, or leave it blank.");
    }
    identities.push({
      identityKind: "email_hash",
      identifier,
      sourceSystem: MANUAL_PERSON_SOURCE_SYSTEM,
    });
  }
  if (parsed.phone) {
    const hashed = hashPhone(parsed.phone);
    if (!hashed) {
      return validationError(
        "invalid-phone",
        "Enter a valid U.S. phone number, or leave it blank.",
      );
    }
    identities.push({
      identityKind: "phone_hash",
      identifier: hashed,
      sourceSystem: MANUAL_PERSON_SOURCE_SYSTEM,
    });
  }

  try {
    const created = await deps.createPersonAtomic({
      entityId: parsed.submissionId,
      createdAt: now,
      createdBy: MANUAL_PERSON_CREATED_BY,
      profile: {
        displayName: parsed.displayName,
        givenName: parsed.givenName,
        familyName: parsed.familyName,
        organizationName: parsed.organizationName,
        email: parsed.email,
        phone: parsed.phone,
        streetAddress: null,
        city: null,
        state: null,
        country: null,
        postalCode: null,
        roles: [CLIENT_ROLE],
        sourceSystem: MANUAL_PERSON_SOURCE_SYSTEM,
        createdAt: now,
        updatedAt: now,
      },
      identities,
    });
    const role = await ensureClientRole(deps, created.personId, now);
    if (role === "error") return { status: "error" };
    return { status: "created", personId: created.personId };
  } catch (error) {
    if (!isIdentityRace(error) || !(parsed.email || parsed.phone)) {
      throw error;
    }
    const recovered = await resolveExisting(deps, parsed.email, parsed.phone);
    if (recovered.status === "new") return { status: "error" };
    return recovered;
  }
}
