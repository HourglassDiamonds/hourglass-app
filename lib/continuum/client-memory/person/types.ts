/**
 * Concierge manual Person / client write contracts.
 * Client is a Person role, not a separate entity.
 */

import { CONCIERGE_MANUAL_SOURCE_SYSTEM } from "../write/types";

export const MANUAL_PERSON_SOURCE_SYSTEM = CONCIERGE_MANUAL_SOURCE_SYSTEM;
export const MANUAL_PERSON_CREATED_BY = CONCIERGE_MANUAL_SOURCE_SYSTEM;

export const MANUAL_PERSON_NAME_MAX_LENGTH = 80;
export const MANUAL_PERSON_ORGANIZATION_MAX_LENGTH = 120;
export const MANUAL_PERSON_EMAIL_MAX_LENGTH = 254;

export type AddManualClientInput = {
  submissionId: string;
  givenName?: string | null;
  familyName?: string | null;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
};

export type AddManualClientValidationCode =
  | "invalid-id"
  | "missing-name"
  | "oversized-name"
  | "oversized-organization"
  | "invalid-email"
  | "invalid-phone";

export type AddManualClientResult =
  | { status: "created"; personId: string }
  | { status: "existing-person"; personId: string }
  | {
      status: "identity-conflict";
      conflictingPersonIds: string[];
    }
  | {
      status: "validation-error";
      message: string;
      code: AddManualClientValidationCode;
    }
  | { status: "error" };

export type EditPersonProfileInput = {
  personId: string;
  submissionId: string;
  givenName?: string | null;
  familyName?: string | null;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
};

export type EditPersonProfileValidationCode =
  | AddManualClientValidationCode
  | "email-required"
  | "phone-required";

export type EditPersonProfileResult =
  | { status: "updated"; personId: string }
  | {
      status: "identity-conflict";
      conflictingPersonIds: string[];
    }
  | {
      status: "validation-error";
      message: string;
      code: EditPersonProfileValidationCode;
    }
  | { status: "person-not-found" }
  | { status: "error" };
