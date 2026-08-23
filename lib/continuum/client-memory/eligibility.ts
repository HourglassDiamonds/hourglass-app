/**
 * Shared Person eligibility for dry-run and apply.
 * Secondary email/phone quality never decides whether a valid person-candidate exists.
 */

import { rolesFromRelationship } from "./contracts";
import {
  prepareIdentityClaims,
  resolvePersonIdentity,
  type IdentityLookup,
  type PreparedIdentityClaim,
} from "./identity";
import type {
  IdentityClaims,
  IdentityReasonCode,
  PersonRole,
} from "./types";
import type { ParsedPersonRow } from "./workbook";

export type PersonEligibility =
  | "eligible"
  | "needs-review"
  | "invalid"
  | "identity-conflict"
  | "organization";

export type IdentityWarningCode =
  | "REVIEW_MALFORMED_EMAIL"
  | "REVIEW_MALFORMED_PHONE"
  | "REVIEW_UNSUPPORTED_PHONE";

export type PersonRowEvaluation = {
  eligibility: PersonEligibility;
  mutation: "create" | "match" | "none";
  personId: string | null;
  validIdentityClaims: PreparedIdentityClaim[];
  identityWarnings: IdentityWarningCode[];
  reviewReasons: string[];
  roles: PersonRole[];
  reasonCode: string;
};

export function identityClaimsFromPrepared(
  claims: PreparedIdentityClaim[],
): IdentityClaims {
  const input: IdentityClaims = {};
  for (const claim of claims) {
    if (claim.identityKind === "import_row_key") {
      input.importRowKey = claim.identifier;
    } else if (claim.identityKind === "email_hash") {
      input.emailHash = claim.identifier;
    } else if (claim.identityKind === "phone_hash") {
      input.phoneHash = claim.identifier;
    } else if (claim.identityKind === "hubspot_contact_id") {
      input.hubspotContactId = claim.identifier;
    } else if (claim.identityKind === "google_contact_id") {
      input.googleContactId = claim.identifier;
    }
  }
  return input;
}

export function warningsFromPrepared(input: {
  malformed: Array<"email" | "phone">;
  unsupportedPhone: boolean;
}): IdentityWarningCode[] {
  const warnings: IdentityWarningCode[] = [];
  if (input.malformed.includes("email")) warnings.push("REVIEW_MALFORMED_EMAIL");
  if (input.malformed.includes("phone")) warnings.push("REVIEW_MALFORMED_PHONE");
  if (input.unsupportedPhone) warnings.push("REVIEW_UNSUPPORTED_PHONE");
  return warnings;
}

export async function evaluatePersonRow(
  lookup: IdentityLookup,
  row: ParsedPersonRow,
): Promise<PersonRowEvaluation> {
  const roles = rolesFromRelationship(row.relationship);
  const prepared = prepareIdentityClaims({
    email: row.email || null,
    phone: row.phone || null,
    importRowKey: row.importRowKey,
  });
  const identityWarnings = warningsFromPrepared(prepared);
  const validIdentityClaims = prepared.claims;

  if (row.classification === "organization-candidate") {
    return {
      eligibility: "organization",
      mutation: "none",
      personId: null,
      validIdentityClaims: [],
      identityWarnings,
      reviewReasons: [],
      roles,
      reasonCode: "ORGANIZATION_SKIP",
    };
  }
  if (row.classification === "needs-review") {
    return {
      eligibility: "needs-review",
      mutation: "none",
      personId: null,
      validIdentityClaims: [],
      identityWarnings: [],
      reviewReasons: ["PEOPLE_NEEDS_REVIEW"],
      roles,
      reasonCode: "PEOPLE_NEEDS_REVIEW",
    };
  }
  if (row.classification !== "person-candidate") {
    return {
      eligibility: "invalid",
      mutation: "none",
      personId: null,
      validIdentityClaims: [],
      identityWarnings: [],
      reviewReasons: ["INVALID_PERSON_ROW"],
      roles,
      reasonCode: "INVALID_PERSON_ROW",
    };
  }

  if (validIdentityClaims.length === 0) {
    const reasonCode: IdentityReasonCode =
      identityWarnings.length > 0
        ? "INVALID_MALFORMED_IDENTITY"
        : "INVALID_NO_DETERMINISTIC_IDENTITY";
    return {
      eligibility: "invalid",
      mutation: "none",
      personId: null,
      validIdentityClaims: [],
      identityWarnings,
      reviewReasons: [reasonCode],
      roles,
      reasonCode,
    };
  }

  const resolution = await resolvePersonIdentity(
    lookup,
    identityClaimsFromPrepared(validIdentityClaims),
  );

  if (resolution.status === "review") {
    return {
      eligibility: "identity-conflict",
      mutation: "none",
      personId: null,
      validIdentityClaims,
      identityWarnings,
      reviewReasons: [resolution.reasonCode],
      roles,
      reasonCode: resolution.reasonCode,
    };
  }
  if (resolution.status === "invalid") {
    return {
      eligibility: "invalid",
      mutation: "none",
      personId: null,
      validIdentityClaims,
      identityWarnings,
      reviewReasons: [resolution.reasonCode],
      roles,
      reasonCode: resolution.reasonCode,
    };
  }
  if (resolution.status === "matched") {
    return {
      eligibility: "eligible",
      mutation: "match",
      personId: resolution.personId,
      validIdentityClaims,
      identityWarnings,
      reviewReasons: [],
      roles,
      reasonCode: resolution.reasonCode,
    };
  }
  return {
    eligibility: "eligible",
    mutation: "create",
    personId: null,
    validIdentityClaims,
    identityWarnings,
    reviewReasons: [],
    roles,
    reasonCode: "NEW_PERSON",
  };
}
