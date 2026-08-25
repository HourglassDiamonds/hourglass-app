/**
 * Shared manual Person contact parsing.
 * Used by Add Client and Edit Person. Does not write.
 */

import { classifyPhone, normalizeEmail } from "../hashes";
import { splitDisplayName } from "../classify";
import type { PersonProfile } from "../types";
import {
  MANUAL_PERSON_EMAIL_MAX_LENGTH,
  MANUAL_PERSON_NAME_MAX_LENGTH,
  MANUAL_PERSON_ORGANIZATION_MAX_LENGTH,
} from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ManualPersonFieldCode =
  | "missing-name"
  | "oversized-name"
  | "oversized-organization"
  | "invalid-email"
  | "invalid-phone"
  | "email-required"
  | "phone-required";

export type ParsedManualPersonFields = {
  givenName: string | null;
  familyName: string | null;
  organizationName: string | null;
  email: string | null;
  phone: string | null;
};

export type ParseManualPersonFieldsResult =
  | { ok: true; value: ParsedManualPersonFields }
  | { ok: false; code: ManualPersonFieldCode; message: string };

export function isManualPersonUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function trimToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function displayNameFromParts(
  givenName: string | null,
  familyName: string | null,
): string {
  return [givenName, familyName].filter(Boolean).join(" ");
}

export function parseManualPersonFields(
  input: {
    givenName?: string | null;
    familyName?: string | null;
    email?: string | null;
    phone?: string | null;
    organization?: string | null;
  },
  options?: {
    requireEmail?: boolean;
    requirePhone?: boolean;
  },
): ParseManualPersonFieldsResult {
  const givenName = trimToNull(input.givenName);
  const familyName = trimToNull(input.familyName);
  if (!givenName && !familyName) {
    return {
      ok: false,
      code: "missing-name",
      message: "Enter a first or last name.",
    };
  }
  if (
    (givenName && givenName.length > MANUAL_PERSON_NAME_MAX_LENGTH) ||
    (familyName && familyName.length > MANUAL_PERSON_NAME_MAX_LENGTH)
  ) {
    return {
      ok: false,
      code: "oversized-name",
      message: "That name is too long.",
    };
  }

  const organizationName = trimToNull(input.organization);
  if (
    organizationName &&
    organizationName.length > MANUAL_PERSON_ORGANIZATION_MAX_LENGTH
  ) {
    return {
      ok: false,
      code: "oversized-organization",
      message: "That organization name is too long.",
    };
  }

  const emailRaw = trimToNull(input.email);
  if (options?.requireEmail && !emailRaw) {
    return {
      ok: false,
      code: "email-required",
      message: "Enter an email.",
    };
  }
  if (emailRaw && emailRaw.length > MANUAL_PERSON_EMAIL_MAX_LENGTH) {
    return {
      ok: false,
      code: "invalid-email",
      message: options?.requireEmail
        ? "Enter a valid email."
        : "Enter a valid email, or leave it blank.",
    };
  }
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  if (emailRaw && !email) {
    return {
      ok: false,
      code: "invalid-email",
      message: options?.requireEmail
        ? "Enter a valid email."
        : "Enter a valid email, or leave it blank.",
    };
  }

  const phoneRaw = trimToNull(input.phone);
  if (options?.requirePhone && !phoneRaw) {
    return {
      ok: false,
      code: "phone-required",
      message: "Enter a phone number.",
    };
  }
  let phone: string | null = null;
  if (phoneRaw) {
    const classified = classifyPhone(phoneRaw);
    if (classified.status !== "us-compatible") {
      return {
        ok: false,
        code: "invalid-phone",
        message: options?.requirePhone
          ? "Enter a valid U.S. phone number."
          : "Enter a valid U.S. phone number, or leave it blank.",
      };
    }
    phone = classified.normalized;
  }

  return {
    ok: true,
    value: {
      givenName,
      familyName,
      organizationName,
      email,
      phone,
    },
  };
}

export function resolveEditedDisplayName(
  existing: Pick<PersonProfile, "displayName" | "givenName" | "familyName">,
  givenName: string | null,
  familyName: string | null,
): string {
  const storedGiven = trimToNull(existing.givenName);
  const storedFamily = trimToNull(existing.familyName);
  if (givenName === storedGiven && familyName === storedFamily) {
    return existing.displayName;
  }
  if (storedGiven == null && storedFamily == null) {
    const seeded = splitDisplayName(existing.displayName);
    if (
      givenName === trimToNull(seeded.givenName) &&
      familyName === trimToNull(seeded.familyName)
    ) {
      return existing.displayName;
    }
  }
  const next = displayNameFromParts(givenName, familyName);
  return next || existing.displayName;
}

export function seedEditedNameFields(
  existing: Pick<PersonProfile, "displayName" | "givenName" | "familyName">,
): { givenName: string; familyName: string } {
  const given = trimToNull(existing.givenName);
  const family = trimToNull(existing.familyName);
  if (given || family) {
    return { givenName: given ?? "", familyName: family ?? "" };
  }
  const seeded = splitDisplayName(existing.displayName);
  return {
    givenName: trimToNull(seeded.givenName) ?? "",
    familyName: trimToNull(seeded.familyName) ?? "",
  };
}
