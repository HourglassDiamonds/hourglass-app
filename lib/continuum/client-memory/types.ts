/**
 * Client Memory V1 contracts (schema version 2).
 * Protected PII plane — not for generic Continuum Event/Evidence/Observation.
 */

import type { ContinuumJsonValue } from "../contracts/types";
import type {
  ContinuumEntity,
  ContinuumId,
  ContinuumSourceSystem,
  EntityKind,
  ExternalIdentity,
  IdentityKind,
} from "../contracts/types";

export const CLIENT_MEMORY_SCHEMA_VERSION = 2 as const;
export const CLIENT_MEMORY_ARTIFACT_ID = "continuum-reconciliation-v3" as const;

export const CLIENT_MEMORY_SOURCE_SYSTEM: ContinuumSourceSystem =
  "continuum-reconciliation-v3";

export type ClientMemoryVisibility =
  | "internal-only"
  | "client-visible"
  | "household-visible";

export const CLIENT_MEMORY_VISIBILITIES = [
  "internal-only",
  "client-visible",
  "household-visible",
] as const satisfies readonly ClientMemoryVisibility[];

export const DEFAULT_VISIBILITY: ClientMemoryVisibility = "internal-only";

export type UsagePermission =
  | "unset"
  | "remember-only"
  | "gift-planning-allowed"
  | "partner-share-allowed";

export const USAGE_PERMISSIONS = [
  "unset",
  "remember-only",
  "gift-planning-allowed",
  "partner-share-allowed",
] as const satisfies readonly UsagePermission[];

export const DEFAULT_USAGE_PERMISSION: UsagePermission = "unset";

export type PersonRole =
  | "client"
  | "prospect"
  | "vendor-contact"
  | "personal"
  | "family"
  | "friend"
  | "business-contact";

export const PERSON_ROLES = [
  "client",
  "prospect",
  "vendor-contact",
  "personal",
  "family",
  "friend",
  "business-contact",
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
  | "household-member"
  | "client-project";

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
  "client-project",
] as const satisfies readonly RelationshipKind[];

export type RelationshipStatus = "active" | "ended" | "disputed";

export const RELATIONSHIP_STATUSES = [
  "active",
  "ended",
  "disputed",
] as const satisfies readonly RelationshipStatus[];

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
  | "REVIEW_UNSUPPORTED_PHONE"
  | "REVIEW_MALFORMED_EMAIL"
  | "REVIEW_MALFORMED_PHONE"
  | "INVALID_NO_DETERMINISTIC_IDENTITY"
  | "INVALID_MALFORMED_IDENTITY";

export type PersonRowClass =
  | "person-candidate"
  | "organization-candidate"
  | "needs-review"
  | "invalid";

export type ProjectMatchJudgment =
  | "exact"
  | "likely"
  | "ambiguous"
  | "no-exact"
  | "malformed-source-value";

export const PROJECT_MATCH_JUDGMENTS = [
  "exact",
  "likely",
  "ambiguous",
  "no-exact",
] as const;

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
  value: ContinuumJsonValue;
  confidence: number;
  verification: string | null;
  approvalStatus: FactApprovalStatus;
  status: FactStatus;
  visibility: ClientMemoryVisibility;
  usagePermission: UsagePermission;
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
  status: RelationshipStatus;
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
  sourceField: string;
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
  visibility: ClientMemoryVisibility;
  usagePermission: UsagePermission;
  sourceSystem: ContinuumSourceSystem;
  createdAt: string;
  createdBy: string;
};

export type ProjectProfile = {
  projectId: ContinuumId;
  displayTitle: string;
  visibility: ClientMemoryVisibility;
  importRowKey: string | null;
  sourceSystem: ContinuumSourceSystem;
  createdAt: string;
  updatedAt: string;
};

export type ProjectHistory = {
  projectId: ContinuumId;
  cadJobNumber: string | null;
  orderNumber: string | null;
  gmailThreadId: string | null;
  matchJudgment: Exclude<ProjectMatchJudgment, "malformed-source-value"> | null;
  matchJudgmentRaw: string | null;
  fingerSize: string | null;
  metal: string | null;
  centerStone: string | null;
  diamondSupplyNotes: string | null;
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
  displayName?: string | null;
  likelyMatch?: boolean;
};

export type IdentityResolution = {
  status: IdentityResolutionStatus;
  reasonCode: IdentityReasonCode;
  personId: ContinuumId | null;
  matchedBy: IdentityKind | null;
  conflictingPersonIds: ContinuumId[];
  unsupportedPhone?: boolean;
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

export type ProfileMergeResult =
  | { status: "unchanged" | "populated"; profile: PersonProfile }
  | { status: "conflict"; field: string };

export type ClientMemoryEntity = ContinuumEntity;
export type ClientMemoryExternalIdentity = ExternalIdentity;
export type { EntityKind, IdentityKind, ContinuumSourceSystem, ContinuumJsonValue };
