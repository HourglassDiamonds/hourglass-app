/**
 * Exact email-hash → Person candidate overlay.
 * NO Person creation. NO fuzzy names. NO Gmail-dot / plus-address rewrite.
 */

import type { ExternalIdentity } from "@/lib/continuum/contracts/types";
import { hashEmail, normalizeEmail } from "@/lib/continuum/client-memory/hashes";
import type { PersonCandidateMatch } from "./types";

export type IdentityLookup = {
  findActiveIdentities(input: {
    identityKind: "email_hash";
    identifier: string;
  }): Promise<readonly Pick<ExternalIdentity, "entityId" | "identityKind" | "identifier" | "revokedAt">[]>;
};

export function matchPersonByEmailHash(
  emailHash: string | null,
  identities: readonly Pick<
    ExternalIdentity,
    "entityId" | "identityKind" | "identifier" | "revokedAt"
  >[],
): PersonCandidateMatch {
  if (!emailHash) return { status: "unresolved" };
  const personIds = [
    ...new Set(
      identities
        .filter(
          (row) =>
            !row.revokedAt &&
            row.identityKind === "email_hash" &&
            row.identifier === emailHash &&
            row.entityId,
        )
        .map((row) => row.entityId as string),
    ),
  ].sort();
  if (personIds.length === 0) return { status: "unresolved" };
  if (personIds.length === 1) return { status: "candidate", personId: personIds[0] };
  return { status: "REVIEW_IDENTITY_COLLISION", personIds };
}

export function isConfiguredInternalAddress(
  email: string | null | undefined,
  internalAddresses: readonly string[],
): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const internals = new Set(
    internalAddresses
      .map((value) => normalizeEmail(value))
      .filter((value): value is string => Boolean(value)),
  );
  return internals.has(normalized);
}

export async function resolvePersonCandidate(input: {
  email?: string | null;
  lookup: IdentityLookup;
  internalAddresses?: readonly string[];
}): Promise<PersonCandidateMatch> {
  if (isConfiguredInternalAddress(input.email, input.internalAddresses ?? [])) {
    return { status: "internal" };
  }
  const emailHash = hashEmail(input.email);
  if (!emailHash) return { status: "unresolved" };
  const identities = await input.lookup.findActiveIdentities({
    identityKind: "email_hash",
    identifier: emailHash,
  });
  return matchPersonByEmailHash(emailHash, identities);
}
