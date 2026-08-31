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
import type { ProjectKind } from "./project-kind";

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

/**
 * Context of a memory/source note. Not a Person identity and not a role.
 * One Person. One memory. Multiple relationship contexts.
 */
export const RELATIONSHIP_CONTEXT_LAYERS = [
  "client",
  "networking",
  "personal",
] as const;

export type RelationshipContextLayer =
  (typeof RELATIONSHIP_CONTEXT_LAYERS)[number];

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

export const SOURCE_NOTE_LIFECYCLE_STATUSES = [
  "inbox",
  "kept",
  "absorbed",
  "trashed",
] as const;

export type SourceNoteLifecycleStatus =
  (typeof SOURCE_NOTE_LIFECYCLE_STATUSES)[number];

export const SOURCE_NOTE_CHANGE_KINDS = [
  "edit",
  "move",
  "trash",
  "restore",
  "absorb",
  "keep",
] as const;

export type SourceNoteChangeKind = (typeof SOURCE_NOTE_CHANGE_KINDS)[number];

export const HISTORY_VISIBLE_NOTE_LIFECYCLES = [
  "kept",
  "absorbed",
] as const satisfies readonly SourceNoteLifecycleStatus[];

export const COCKPIT_VISIBLE_NOTE_LIFECYCLE = "kept" as const;

/**
 * Deterministic backfill / insert default.
 * concierge-manual → kept (founder-authored).
 * All other source systems, including continuum-reconciliation-v3 and
 * any unexpected value → absorbed (evidence, not cockpit).
 */
export function classifySourceNoteLifecycle(
  sourceSystem: string,
): Extract<SourceNoteLifecycleStatus, "kept" | "absorbed"> {
  return sourceSystem === "concierge-manual" ? "kept" : "absorbed";
}

export function isKnownSourceNoteBackfillSystem(sourceSystem: string): boolean {
  return (
    sourceSystem === "concierge-manual" ||
    sourceSystem === "continuum-reconciliation-v3"
  );
}

export type SourceNote = {
  id: ContinuumId;
  personId: ContinuumId | null;
  projectId: ContinuumId | null;
  contextLayer: RelationshipContextLayer;
  sourceSystem: ContinuumSourceSystem;
  sourceArtifact: string;
  sourceSheet: string;
  sourceField: string;
  importRowKey: string;
  gmailThreadId: string | null;
  noteText: string;
  createdAt: string;
  lifecycleStatus: SourceNoteLifecycleStatus;
  updatedAt: string;
  updatedBy: string | null;
  deletedAt: string | null;
  previousLifecycle: SourceNoteLifecycleStatus | null;
};

export type SourceNoteRevision = {
  id: ContinuumId;
  noteId: ContinuumId;
  mutationId: ContinuumId;
  noteText: string;
  personId: ContinuumId | null;
  projectId: ContinuumId | null;
  contextLayer: RelationshipContextLayer;
  lifecycleStatus: SourceNoteLifecycleStatus;
  changeKind: SourceNoteChangeKind;
  editedAt: string;
  editedBy: string;
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
  projectKind?: ProjectKind | null;
};

export const EDITABLE_PROJECT_SPEC_FIELDS = [
  "cad_job_number",
  "order_number",
  "finger_size",
  "metal",
  "center_stone",
  "diamond_supply_notes",
] as const;

export type EditableProjectSpecField =
  (typeof EDITABLE_PROJECT_SPEC_FIELDS)[number];

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
  founderCorrectedFields?: EditableProjectSpecField[];
};

export const CUSTOM_OPERATING_DETAIL_FIELDS = [
  "custom_design_brief",
  "custom_design_requirements",
  "custom_manufacturing_notes",
] as const;

export const REPAIR_OPERATING_DETAIL_FIELDS = [
  "repair_item_description",
  "repair_requested_service",
  "repair_condition_notes",
  "repair_technical_notes",
] as const;

export const OPERATING_DETAIL_FIELDS = [
  ...CUSTOM_OPERATING_DETAIL_FIELDS,
  ...REPAIR_OPERATING_DETAIL_FIELDS,
] as const;

export type CustomOperatingDetailField =
  (typeof CUSTOM_OPERATING_DETAIL_FIELDS)[number];
export type RepairOperatingDetailField =
  (typeof REPAIR_OPERATING_DETAIL_FIELDS)[number];
export type OperatingDetailField = (typeof OPERATING_DETAIL_FIELDS)[number];

export type ProjectCustomDetails = {
  projectId: ContinuumId;
  designBrief: string | null;
  designRequirements: string | null;
  manufacturingNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRepairDetails = {
  projectId: ContinuumId;
  itemDescription: string | null;
  requestedService: string | null;
  conditionNotes: string | null;
  technicalNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectHistoryRevisionField =
  | EditableProjectSpecField
  | "project_kind"
  | OperatingDetailField;

export type ProjectHistoryRevision = {
  id: ContinuumId;
  projectId: ContinuumId;
  mutationId: ContinuumId;
  fieldName: ProjectHistoryRevisionField;
  priorValue: string | null;
  newValue: string | null;
  sourceSystem: ContinuumSourceSystem;
  changedAt: string;
  changedBy: string;
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
