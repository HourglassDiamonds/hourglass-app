/**
 * Internal Concierge Client Memory read contracts.
 * Protected PII may be returned to authenticated internal server/UI only.
 * Never send these shapes to Continuum kernel Events/Evidence/Observations.
 */

import type { ContinuumSourceSystem } from "../../contracts/types";
import type {
  ClientMemoryVisibility,
  EntityRelationship,
  IdentityReview,
  PersonFact,
  PersonRole,
  ProjectHistory,
  ProjectMatchJudgment,
  ProjectProfile,
  RelationshipKind,
  RelationshipStatus,
  SourceNote,
  Wish,
} from "../types";

export type { PersonFact };

export const CLIENT_MEMORY_SEARCH_LIMIT = 20;
export const CLIENT_MEMORY_NOTE_LIMIT = 25;
export const CLIENT_MEMORY_COCKPIT_NOTE_LIMIT = 5;
export const CLIENT_MEMORY_HISTORY_PAGE_SIZE = 20;
export const CLIENT_MEMORY_PROJECT_PREVIEW_LIMIT = 3;
export const COCKPIT_MANUAL_SOURCE_SYSTEM = "concierge-manual" as const;

export const ACTIVE_WISH_STATUSES = ["active", "considering"] as const;

export type ClientSearchResult = {
  personId: string;
  displayName: string;
  organizationName: string | null;
  email: string | null;
  phone: string | null;
  roles: PersonRole[];
  linkedProjectCount: number;
};

export type ClientRelationshipSummary = Pick<
  EntityRelationship,
  "id" | "fromEntityId" | "toEntityId" | "kind" | "status" | "createdAt"
>;

export type ProjectProfileSummary = Pick<
  ProjectProfile,
  "projectId" | "displayTitle" | "visibility"
>;

export type ProjectHistorySummary = {
  cadJobNumber: string | null;
  orderNumber: string | null;
  gmailThreadId: string | null;
  matchJudgment: Exclude<ProjectMatchJudgment, "malformed-source-value"> | null;
  fingerSize: string | null;
  metal: string | null;
  centerStone: string | null;
  diamondSupplyNotes: string | null;
};

export type LinkedProjectRead = {
  profile: ProjectProfileSummary;
  internalHistory: ProjectHistorySummary | null;
};

export type SourceNoteSummary = Pick<
  SourceNote,
  | "id"
  | "projectId"
  | "contextLayer"
  | "sourceSystem"
  | "sourceArtifact"
  | "sourceSheet"
  | "sourceField"
  | "gmailThreadId"
  | "noteText"
  | "createdAt"
>;

export type WishSummary = Pick<
  Wish,
  "id" | "description" | "category" | "status" | "visibility" | "createdAt"
>;

export type IdentityReviewSummary = Pick<
  IdentityReview,
  "id" | "status" | "reasonCode" | "importRowKey" | "createdAt"
>;

export type ConciergePersonProfile = {
  person: {
    id: string;
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
  };
  relationships: ClientRelationshipSummary[];
  facts: {
    current: PersonFact[];
    candidateCount: number;
    conflictingCount: number;
  };
  wishes: WishSummary[];
  projects: LinkedProjectRead[];
  sourceNotes: SourceNoteSummary[];
  reviews: {
    openCount: number;
    reasonHistogram: Record<string, number>;
  };
};

export type ConciergePersonProfileResult =
  | { ok: true; profile: ConciergePersonProfile }
  | { ok: false; reason: "not-found" };

export type PersonCockpitPerson = ConciergePersonProfile["person"];

export type PersonCockpitRelationship = {
  id: string;
  kind: Exclude<RelationshipKind, "client-project">;
  status: RelationshipStatus;
  counterpartPersonId: string;
  counterpartName: string;
};

export type PersonCockpitProject = LinkedProjectRead & {
  sourceSystem: ContinuumSourceSystem;
  imported: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PersonCockpit = {
  person: PersonCockpitPerson;
  birthday: PersonFact | null;
  personalFacts: PersonFact[];
  work: {
    organizationName: string | null;
    roles: PersonRole[];
  };
  relationships: PersonCockpitRelationship[];
  projects: PersonCockpitProject[];
  wishes: WishSummary[];
  recentManualNotes: SourceNoteSummary[];
  reviews: {
    openCount: number;
    candidateCount: number;
    conflictingCount: number;
  };
  history: {
    noteCount: number;
  };
};

export type PersonCockpitResult =
  | { ok: true; cockpit: PersonCockpit }
  | { ok: false; reason: "not-found" };

export type PersonSourceHistoryQuery = {
  page?: number;
  pageSize?: number;
  sourceSystem?: string | null;
};

export type PersonSourceHistory = {
  personId: string;
  displayName: string;
  notes: SourceNoteSummary[];
  projectTitles: Record<string, string>;
  total: number;
  page: number;
  pageSize: number;
  sourceSystem: string | null;
};

export type PersonSourceHistoryResult =
  | { ok: true; history: PersonSourceHistory }
  | { ok: false; reason: "not-found" };

export type ClientMemoryReadSnapshot = {
  profiles: Array<{
    personId: string;
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
  }>;
  identities: Array<{
    entityId: string | null;
    identityKind: string;
    identifier: string;
    revokedAt: string | null;
  }>;
  relationships: EntityRelationship[];
  facts: PersonFact[];
  wishes: Wish[];
  sourceNotes: SourceNote[];
  reviews: IdentityReview[];
  projectProfiles: ProjectProfile[];
  projectHistories: ProjectHistory[];
};

export const CLIENT_MEMORY_FINANCIAL_FIELD_NAMES = [
  "cost",
  "margin",
  "price",
  "amount",
  "invoice",
  "revenue",
  "profit",
  "total",
  "subtotal",
  "tax",
  "payment",
] as const;

export function isActiveWishStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return (ACTIVE_WISH_STATUSES as readonly string[]).includes(normalized);
}

export type { ClientMemoryVisibility };
