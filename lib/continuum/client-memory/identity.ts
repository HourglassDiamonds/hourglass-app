/**
 * Domain-neutral Client Memory identity resolver.
 * Deterministic keys only. No fuzzy name/address merge.
 */

import { validateIdentityKind } from "../contracts/validation";
import type { ExternalIdentity, IdentityKind } from "../contracts/types";
import { hashEmail, hashPhone, normalizeEmail, normalizePhone } from "./hashes";
import type {
  IdentityClaims,
  IdentityReasonCode,
  IdentityResolution,
} from "./types";

export const IDENTITY_PRIORITY = [
  "hubspot_contact_id",
  "email_hash",
  "phone_hash",
  "import_row_key",
] as const satisfies readonly IdentityKind[];

const MATCHED_REASON: Record<(typeof IDENTITY_PRIORITY)[number], IdentityReasonCode> = {
  hubspot_contact_id: "MATCHED_HUBSPOT_CONTACT_ID",
  email_hash: "MATCHED_EMAIL_HASH",
  phone_hash: "MATCHED_PHONE_HASH",
  import_row_key: "MATCHED_IMPORT_ROW_KEY",
};

export type IdentityLookup = {
  findActiveIdentities(input: {
    identityKind: IdentityKind;
    identifier: string;
  }): Promise<ExternalIdentity[]>;
};

export type PreparedIdentityClaim = {
  identityKind: IdentityKind;
  identifier: string;
};

export type PreparedClaims = {
  claims: PreparedIdentityClaim[];
  malformed: Array<"email" | "phone">;
  nameOnly: boolean;
  likelyMatch: boolean;
};

export function prepareIdentityClaims(input: IdentityClaims): PreparedClaims {
  const claims: PreparedIdentityClaim[] = [];
  const malformed: Array<"email" | "phone"> = [];
  const hubspot = trimToNull(input.hubspotContactId);
  if (hubspot) {
    claims.push({ identityKind: "hubspot_contact_id", identifier: hubspot });
  }
  const google = trimToNull(input.googleContactId);
  if (google) {
    claims.push({ identityKind: "google_contact_id", identifier: google });
  }

  const emailRaw = trimToNull(input.email);
  if (emailRaw) {
    const hashed = input.emailHash ?? hashEmail(emailRaw);
    if (hashed && normalizeEmail(emailRaw)) {
      claims.push({ identityKind: "email_hash", identifier: hashed });
    } else if (input.emailHash) {
      claims.push({ identityKind: "email_hash", identifier: input.emailHash });
    } else {
      malformed.push("email");
    }
  } else if (trimToNull(input.emailHash)) {
    claims.push({
      identityKind: "email_hash",
      identifier: String(input.emailHash),
    });
  }

  const phoneRaw = trimToNull(input.phone);
  if (phoneRaw) {
    const hashed = input.phoneHash ?? hashPhone(phoneRaw);
    if (hashed && normalizePhone(phoneRaw)) {
      claims.push({ identityKind: "phone_hash", identifier: hashed });
    } else if (input.phoneHash) {
      claims.push({ identityKind: "phone_hash", identifier: input.phoneHash });
    } else {
      malformed.push("phone");
    }
  } else if (trimToNull(input.phoneHash)) {
    claims.push({
      identityKind: "phone_hash",
      identifier: String(input.phoneHash),
    });
  }

  const importRowKey = trimToNull(input.importRowKey);
  if (importRowKey) {
    claims.push({ identityKind: "import_row_key", identifier: importRowKey });
  }

  const nameOnly =
    Boolean(trimToNull(input.displayName)) &&
    claims.length === 0 &&
    malformed.length === 0;

  return {
    claims,
    malformed,
    nameOnly,
    likelyMatch: Boolean(input.likelyMatch),
  };
}

export async function resolvePersonIdentity(
  lookup: IdentityLookup,
  input: IdentityClaims,
): Promise<IdentityResolution> {
  if (input.likelyMatch) {
    return {
      status: "review",
      reasonCode: "REVIEW_LIKELY_NOT_IDENTITY_PROOF",
      personId: null,
      matchedBy: null,
      conflictingPersonIds: [],
    };
  }

  const prepared = prepareIdentityClaims(input);
  if (prepared.nameOnly) {
    return {
      status: "review",
      reasonCode: "REVIEW_NAME_ONLY_NEVER_MERGE",
      personId: null,
      matchedBy: null,
      conflictingPersonIds: [],
    };
  }

  const exactKinds: IdentityKind[] = [
    ...IDENTITY_PRIORITY,
    "google_contact_id",
  ];
  const prioritized = exactKinds.flatMap((kind) =>
    prepared.claims.filter((claim) => claim.identityKind === kind),
  );

  if (prioritized.length === 0) {
    if (prepared.malformed.length > 0) {
      return {
        status: "invalid",
        reasonCode: "INVALID_MALFORMED_IDENTITY",
        personId: null,
        matchedBy: null,
        conflictingPersonIds: [],
      };
    }
    return {
      status: "invalid",
      reasonCode: "INVALID_NO_DETERMINISTIC_IDENTITY",
      personId: null,
      matchedBy: null,
      conflictingPersonIds: [],
    };
  }

  const entityIdsByKind = new Map<IdentityKind, string[]>();
  const allEntityIds = new Set<string>();

  for (const claim of prioritized) {
    const kindCheck = validateIdentityKind(claim.identityKind);
    if (!kindCheck.ok) {
      return {
        status: "invalid",
        reasonCode: "INVALID_MALFORMED_IDENTITY",
        personId: null,
        matchedBy: null,
        conflictingPersonIds: [],
      };
    }
    const hits = await lookup.findActiveIdentities({
      identityKind: claim.identityKind,
      identifier: claim.identifier,
    });
    const entityIds = unique(
      hits
        .filter((row) => row.revokedAt == null && row.entityId)
        .map((row) => String(row.entityId)),
    );
    if (entityIds.length > 1) {
      return {
        status: "review",
        reasonCode: "REVIEW_IDENTITY_COLLISION",
        personId: null,
        matchedBy: claim.identityKind,
        conflictingPersonIds: entityIds,
      };
    }
    entityIdsByKind.set(claim.identityKind, entityIds);
    for (const id of entityIds) allEntityIds.add(id);
  }

  if (allEntityIds.size > 1) {
    return {
      status: "review",
      reasonCode: "REVIEW_CROSS_KEY_CONFLICT",
      personId: null,
      matchedBy: null,
      conflictingPersonIds: [...allEntityIds],
    };
  }

  if (allEntityIds.size === 1) {
    const personId = [...allEntityIds][0];
    const matchedBy =
      exactKinds.find((kind) => {
        const ids = entityIdsByKind.get(kind) ?? [];
        return ids.includes(personId);
      }) ?? null;
    return {
      status: "matched",
      reasonCode: reasonForMatch(matchedBy),
      personId,
      matchedBy,
      conflictingPersonIds: [],
    };
  }

  return {
    status: "new",
    reasonCode: "NEW_PERSON",
    personId: null,
    matchedBy: null,
    conflictingPersonIds: [],
  };
}

function trimToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function reasonForMatch(kind: IdentityKind | null): IdentityReasonCode {
  if (kind === "google_contact_id") return "MATCHED_GOOGLE_CONTACT_ID";
  if (kind && kind in MATCHED_REASON) {
    return MATCHED_REASON[kind as keyof typeof MATCHED_REASON];
  }
  return "MATCHED_IMPORT_ROW_KEY";
}
