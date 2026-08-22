/**
 * Client Memory V1 contracts.
 * Protected PII plane — not for generic Continuum Event/Evidence/Observation.
 */

import type {
  ContinuumEntity,
  ContinuumId,
  ContinuumSourceSystem,
  EntityKind,
  ExternalIdentity,
  IdentityKind,
} from "../contracts/types";

export const CLIENT_MEMORY_SCHEMA_VERSION = 1 as const;
export const CLIENT_MEMORY_ARTIFACT_ID = "continuum-reconciliation-v3" as const;

export const CLIENT_MEMORY_SOURCE_SYSTEM =
  "continuum-reconciliation-v3" satisfies ContinuumSourceSystem;

export type PersonRole = "client" | "prospect" | "vendor-contact" | "other";

export const PERSON_ROLES = [
  "client",
  "prospect",
  "vendor-contact",
  "other",
] as const satisfies readonly PersonRole[];

export type RelationshipKind =
  | "spouse"
  | "partner"
  | "child"
  | "parent"
  | "family"
  | "friend"
  | "assistant"
  | "business-partner"
  | "referral"
  | "gift-planning"
  | "household-member";

export const RELATIONSHIP_KINDS = [
  "spouse",
  "partner",
  "child",
  "parent",
  "family",
  "friend",
  "assistant",
  "business-partner",
  "referral",
  "gift-planning",
  "household-member",
] as const satisfies readonly RelationshipKind[];

export type FactStatus = "current" | "conflicting" | "superseded" | "candidate";
export type FactApprovalStatus = "approved" | "pending-review" | "rejected";

export const FACT_STATUSES = [
  "current",
  "conflicting",
  "superseded",
  "candidate",
] as const satisfies readonly FactStatus[];

export const FACT_APPROVAL_STATUSES = [
  "approved",
  "pending-review",
  "rejected",
] as const satisfies readonly FactApprovalStatus[];

export type IdentityResolutionStatus = "matched" | "new" | "review" | "invalid";

export type IdentityReasonCode =
  | "MATCHED_HUBSPOT_CONTACT_ID"
  | "MATCHED_EMAIL_HASH"
  | "MATCHED_PHONE_HASH"
  | "MATCHED_IMPORT_ROW_KEY"
  | "MATCHED_GOOGLE_CONTACT_ID"
  | "NEW_PERSON"
  | "REVIEW_IDENTITY_COLLISION"
  | "REVIEW_CROSS_KEY_CONFLICT"
  | "REVIEW_NAME_ONLY_NEVER_MERGE"
  | "REVIEW_LIKELY_NOT_IDENTITY_PROOF"
  | "INVALID_NO_DETERMINISTIC_IDENTITY"
  | "INVALID_MALFORMED_IDENTITY";

export type PersonRowClass =
  | "person-candidate"
  | "organization-candidate"
  | "needs-review"
  | "invalid";

export type DryRunPersonAction =
  | "would-create-person"
  | "would-match-person"
  | "identity-review"
  | "invalid";

export type ProjectMatchJudgment =
  | "exact"
  | "likely"
  | "ambiguous"
  | "no-exact"
  | "malformed-source-value";

export type PersonProfile = {
  personId: ContinuumId;
  displayName: string;
  givenName: string | null;
  familyName: string | null;
  organizationName: string | null;
  email: string | null;
  phone: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  roles: PersonRole[];
  sourceSystem: ContinuumSourceSystem;
  createdAt: string;
  updatedAt: string;
};

export type PersonFact = {
  id: ContinuumId;
  personId: ContinuumId;
  factType: string;
  value: unknown;
  confidence: number;
  verification: string | null;
  approvalStatus: FactApprovalStatus;
  status: FactStatus;
  visibility: string;
  usagePermission: string;
  validFrom: string | null;
  validUntil: string | null;
  supersedesId: ContinuumId | null;
  sourceSystem: ContinuumSourceSystem;
  createdAt: string;
  createdBy: string;
};

export type EntityRelationship = {
  id: ContinuumId;
  fromEntityId: ContinuumId;
  toEntityId: ContinuumId;
  kind: RelationshipKind;
  sourceSystem: ContinuumSourceSystem;
  createdAt: string;
  createdBy: string;
};

export type SourceNote = {
  id: ContinuumId;
  personId: ContinuumId | null;
  projectId: ContinuumId | null;
  sourceSystem: ContinuumSourceSystem;
  sourceArtifact: string;
  sourceSheet: string;
  importRowKey: string;
  gmailThreadId: string | null;
  noteText: string;
  createdAt: string;
};

export type Wish = {
  id: ContinuumId;
  personId: ContinuumId;
  householdId: ContinuumId | null;
  projectId: ContinuumId | null;
  relatedFactId: ContinuumId | null;
  description: string;
  category: string | null;
  status: string;
  visibility: string;
  usagePermission: string;
  sourceSystem: ContinuumSourceSystem;
  createdAt: string;
  createdBy: string;
};

export type ProjectProfile = {
  projectId: ContinuumId;
  displayTitle: string;
  cadJobNumber: string | null;
  orderNumber: string | null;
  gmailThreadId: string | null;
  matchJudgment: ProjectMatchJudgment | null;
  attributes: Record<string, unknown>;
  sourceSystem: ContinuumSourceSystem;
  createdAt: string;
  updatedAt: string;
};

export type IdentityReview = {
  id: ContinuumId;
  status: "open" | "resolved" | "suppressed";
  reasonCode: string;
  leftPersonId: ContinuumId | null;
  rightPersonId: ContinuumId | null;
  importRowKey: string | null;
  issueText: string | null;
  resolutionText: string | null;
  sourceSystem: ContinuumSourceSystem;
  createdAt: string;
};

export type IdentityClaims = {
  hubspotContactId?: string | null;
  email?: string | null;
  phone?: string | null;
  emailHash?: string | null;
  phoneHash?: string | null;
  importRowKey?: string | null;
  googleContactId?: string | null;
  /** Ignored for matching. Name is never an identity key. */
  displayName?: string | null;
  /** Workbook "Likely" is never global identity proof. */
  likelyMatch?: boolean;
};

export type IdentityResolution = {
  status: IdentityResolutionStatus;
  reasonCode: IdentityReasonCode;
  personId: ContinuumId | null;
  matchedBy: IdentityKind | null;
  conflictingPersonIds: ContinuumId[];
};

export type InsertResult<T> =
  | { status: "inserted"; record: T }
  | { status: "already-present"; record: T };

export type IdentityWriteResult<T> =
  | InsertResult<T>
  | {
      status: "conflict";
      record: T;
      incomingEntityId: ContinuumId;
    };

export type ClientMemoryEntity = ContinuumEntity;
export type ClientMemoryExternalIdentity = ExternalIdentity;
export type { EntityKind, IdentityKind, ContinuumSourceSystem };
