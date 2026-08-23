import { randomUUID } from "node:crypto";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import type {
  EntityRelationship,
  IdentityReview,
  PersonFact,
  ProjectHistory,
  ProjectProfile,
  SourceNote,
  Wish,
} from "../types";
import type { ClientMemoryReadSnapshot } from "./types";

const NOW = "2026-08-22T12:00:00.000Z";

export function emptyReadSnapshot(): ClientMemoryReadSnapshot {
  return {
    profiles: [],
    identities: [],
    relationships: [],
    facts: [],
    wishes: [],
    sourceNotes: [],
    reviews: [],
    projectProfiles: [],
    projectHistories: [],
  };
}

export function personProfile(input: {
  personId?: string;
  displayName: string;
  givenName?: string | null;
  familyName?: string | null;
  organizationName?: string | null;
  email?: string | null;
  phone?: string | null;
  streetAddress?: string | null;
  roles?: ClientMemoryReadSnapshot["profiles"][number]["roles"];
}): ClientMemoryReadSnapshot["profiles"][number] {
  return {
    personId: input.personId ?? randomUUID(),
    displayName: input.displayName,
    givenName: input.givenName ?? null,
    familyName: input.familyName ?? null,
    organizationName: input.organizationName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    streetAddress: input.streetAddress ?? null,
    city: null,
    state: null,
    country: null,
    postalCode: null,
    roles: input.roles ?? ["client"],
  };
}

export function relationship(input: {
  fromEntityId: string;
  toEntityId: string;
  kind?: EntityRelationship["kind"];
  status?: EntityRelationship["status"];
}): EntityRelationship {
  return {
    id: randomUUID(),
    fromEntityId: input.fromEntityId,
    toEntityId: input.toEntityId,
    kind: input.kind ?? "client-project",
    status: input.status ?? "active",
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    createdBy: "test",
  };
}

export function projectProfile(input: {
  projectId?: string;
  displayTitle: string;
  importRowKey?: string | null;
}): ProjectProfile {
  return {
    projectId: input.projectId ?? randomUUID(),
    displayTitle: input.displayTitle,
    visibility: "internal-only",
    importRowKey: input.importRowKey ?? null,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

export function projectHistory(input: {
  projectId: string;
  cadJobNumber?: string | null;
  metal?: string | null;
}): ProjectHistory {
  return {
    projectId: input.projectId,
    cadJobNumber: input.cadJobNumber ?? "CAD-1",
    orderNumber: "ORD-1",
    gmailThreadId: "thread-1",
    matchJudgment: "exact",
    matchJudgmentRaw: "Exact",
    fingerSize: "6.5",
    metal: input.metal ?? "platinum",
    centerStone: "oval",
    diamondSupplyNotes: "client stone",
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

export function fact(input: {
  personId: string;
  factType: string;
  status: PersonFact["status"];
  value?: string;
}): PersonFact {
  return {
    id: randomUUID(),
    personId: input.personId,
    factType: input.factType,
    value: input.value ?? input.factType,
    confidence: 1,
    verification: null,
    approvalStatus: "pending-review",
    status: input.status,
    visibility: "internal-only",
    usagePermission: "unset",
    validFrom: null,
    validUntil: null,
    supersedesId: null,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    createdBy: "test",
  };
}

export function wish(input: {
  personId: string;
  description: string;
  status: string;
}): Wish {
  return {
    id: randomUUID(),
    personId: input.personId,
    householdId: null,
    projectId: null,
    relatedFactId: null,
    description: input.description,
    category: "jewelry",
    status: input.status,
    visibility: "internal-only",
    usagePermission: "unset",
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    createdBy: "test",
  };
}

export function note(input: {
  personId?: string | null;
  projectId?: string | null;
  createdAt: string;
  text?: string;
  sourceField?: string;
}): SourceNote {
  return {
    id: randomUUID(),
    personId: input.personId ?? null,
    projectId: input.projectId ?? null,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    sourceArtifact: "continuum-reconciliation-v3",
    sourceSheet: "Reconciled Projects",
    sourceField: input.sourceField ?? "Notes",
    importRowKey: "continuum-reconciliation-v3:ReconciledProjects:2",
    gmailThreadId: null,
    noteText: input.text ?? "note",
    createdAt: input.createdAt,
  };
}

export function review(input: {
  reasonCode: string;
  importRowKey?: string | null;
  leftPersonId?: string | null;
  status?: IdentityReview["status"];
}): IdentityReview {
  return {
    id: randomUUID(),
    status: input.status ?? "open",
    reasonCode: input.reasonCode,
    leftPersonId: input.leftPersonId ?? null,
    rightPersonId: null,
    importRowKey: input.importRowKey ?? null,
    issueText: null,
    resolutionText: null,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
  };
}
