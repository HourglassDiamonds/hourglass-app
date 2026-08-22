/**
 * Client Memory store port and in-memory adapter.
 * Domain logic depends on this interface, not on Memory or Supabase clients.
 */

import { randomUUID } from "node:crypto";
import { validateIdentityKind } from "../contracts/validation";
import type {
  ContinuumEntity,
  ContinuumSourceSystem,
  EntityKind,
  ExternalIdentity,
  IdentityKind,
} from "../contracts/types";
import {
  assertFactValue,
  assertPersonRoles,
  isFactApprovalStatus,
  isFactStatus,
  isRelationshipKind,
  isRelationshipStatus,
  isUsagePermission,
  isVisibility,
} from "./contracts";
import { planProfileMerge, type ProtectedProfileField } from "./merge";
import type {
  ClientMemoryEntity,
  EntityRelationship,
  IdentityReview,
  IdentityWriteResult,
  InsertResult,
  PersonFact,
  PersonProfile,
  ProjectHistory,
  ProjectProfile,
  SourceNote,
  Wish,
} from "./types";

export type CreatePersonAtomicInput = {
  entityId?: string;
  createdAt: string;
  createdBy: string;
  profile: Omit<PersonProfile, "personId">;
  identities: Array<{
    id?: string;
    identityKind: IdentityKind;
    identifier: string;
    sourceSystem: ContinuumSourceSystem;
  }>;
};

export type CreatePersonAtomicResult =
  | { status: "inserted"; personId: string; profile: PersonProfile }
  | { status: "already-present"; personId: string; profile: PersonProfile };

export type ApplyExistingPersonInput = {
  personId: string;
  updatedAt: string;
  profile: Partial<Pick<PersonProfile, ProtectedProfileField>>;
  identities: Array<{
    id?: string;
    identityKind: IdentityKind;
    identifier: string;
    sourceSystem: ContinuumSourceSystem;
    createdAt: string;
  }>;
};

export type ApplyExistingPersonResult =
  | { status: "applied"; personId: string; populated: boolean }
  | { status: "conflict"; reason: "profile_conflict" | "identity_conflict"; field?: string };

export type ClientMemoryCounts = {
  persons: number;
  profiles: number;
  identities: number;
  notes: number;
  projects: number;
  histories: number;
  reviews: number;
  facts: number;
  relationships: number;
};

export type ClientMemoryStore = {
  insertEntity(input: {
    id?: string;
    kind: EntityKind;
    createdAt: string;
    createdBy: string;
  }): Promise<InsertResult<ClientMemoryEntity>>;
  getEntity(id: string): Promise<ClientMemoryEntity | null>;
  insertExternalIdentity(
    identity: ExternalIdentity,
  ): Promise<IdentityWriteResult<ExternalIdentity>>;
  upsertExternalIdentity(
    identity: ExternalIdentity,
  ): Promise<IdentityWriteResult<ExternalIdentity>>;
  getExternalIdentity(id: string): Promise<ExternalIdentity | null>;
  findActiveIdentities(input: {
    identityKind: IdentityKind;
    identifier: string;
  }): Promise<ExternalIdentity[]>;
  insertPersonProfile(
    profile: PersonProfile,
  ): Promise<InsertResult<PersonProfile>>;
  getPersonProfile(personId: string): Promise<PersonProfile | null>;
  updatePersonProfile(
    personId: string,
    patch: Partial<
      Omit<PersonProfile, "personId" | "createdAt" | "sourceSystem">
    > & { updatedAt: string },
  ): Promise<PersonProfile | null>;
  insertPersonFact(fact: PersonFact): Promise<InsertResult<PersonFact>>;
  getPersonFact(id: string): Promise<PersonFact | null>;
  insertRelationship(
    row: EntityRelationship,
  ): Promise<InsertResult<EntityRelationship>>;
  insertSourceNote(row: SourceNote): Promise<InsertResult<SourceNote>>;
  insertWish(row: Wish): Promise<InsertResult<Wish>>;
  insertProjectProfile(
    profile: ProjectProfile,
  ): Promise<InsertResult<ProjectProfile>>;
  getProjectProfile(projectId: string): Promise<ProjectProfile | null>;
  findProjectByImportRowKey(input: {
    sourceSystem: ContinuumSourceSystem;
    importRowKey: string;
  }): Promise<ProjectProfile | null>;
  insertProjectHistory(
    history: ProjectHistory,
  ): Promise<InsertResult<ProjectHistory>>;
  getProjectHistory(projectId: string): Promise<ProjectHistory | null>;
  insertIdentityReview(
    row: IdentityReview,
  ): Promise<InsertResult<IdentityReview>>;
  createPersonAtomic(
    input: CreatePersonAtomicInput,
  ): Promise<CreatePersonAtomicResult>;
  applyExistingPersonAtomic(
    input: ApplyExistingPersonInput,
  ): Promise<ApplyExistingPersonResult>;
  inspectCounts(): Promise<ClientMemoryCounts>;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function identityKey(
  row: Pick<ExternalIdentity, "sourceSystem" | "identityKind" | "identifier">,
) {
  return `${row.sourceSystem}\0${row.identityKind}\0${row.identifier}`;
}

function noteKey(row: Pick<SourceNote, "sourceSystem" | "importRowKey" | "sourceField">) {
  return `${row.sourceSystem}\0${row.importRowKey}\0${row.sourceField}`;
}

function reviewKey(
  row: Pick<IdentityReview, "sourceSystem" | "importRowKey" | "reasonCode">,
) {
  return `${row.sourceSystem}\0${row.importRowKey ?? ""}\0${row.reasonCode}`;
}

function relationshipActiveKey(
  row: Pick<EntityRelationship, "fromEntityId" | "toEntityId" | "kind">,
) {
  return `${row.fromEntityId}\0${row.toEntityId}\0${row.kind}`;
}

function currentFactKey(personId: string, factType: string) {
  return `${personId}\0${factType}`;
}

export class InMemoryClientMemoryStore implements ClientMemoryStore {
  private entities = new Map<string, ContinuumEntity>();
  private identitiesById = new Map<string, ExternalIdentity>();
  private activeIdentityKeys = new Map<string, string>();
  private profiles = new Map<string, PersonProfile>();
  private facts = new Map<string, PersonFact>();
  private currentFacts = new Map<string, string>();
  private relationships = new Map<string, EntityRelationship>();
  private activeRelationships = new Map<string, string>();
  private notes = new Map<string, SourceNote>();
  private noteKeys = new Map<string, string>();
  private wishes = new Map<string, Wish>();
  private projects = new Map<string, ProjectProfile>();
  private projectImportKeys = new Map<string, string>();
  private histories = new Map<string, ProjectHistory>();
  private reviews = new Map<string, IdentityReview>();
  private reviewKeys = new Map<string, string>();
  failNextCreateAfter: "entity" | "profile" | "identity" | null = null;

  reset(): void {
    this.entities.clear();
    this.identitiesById.clear();
    this.activeIdentityKeys.clear();
    this.profiles.clear();
    this.facts.clear();
    this.currentFacts.clear();
    this.relationships.clear();
    this.activeRelationships.clear();
    this.notes.clear();
    this.noteKeys.clear();
    this.wishes.clear();
    this.projects.clear();
    this.projectImportKeys.clear();
    this.histories.clear();
    this.reviews.clear();
    this.reviewKeys.clear();
    this.failNextCreateAfter = null;
  }

  async insertEntity(input: {
    id?: string;
    kind: EntityKind;
    createdAt: string;
    createdBy: string;
  }): Promise<InsertResult<ClientMemoryEntity>> {
    const id = input.id ?? randomUUID();
    const existing = this.entities.get(id);
    if (existing) return { status: "already-present", record: clone(existing) };
    const record: ContinuumEntity = {
      id,
      kind: input.kind,
      createdAt: input.createdAt,
      createdBy: input.createdBy,
    };
    this.entities.set(id, record);
    return { status: "inserted", record: clone(record) };
  }

  async getEntity(id: string): Promise<ClientMemoryEntity | null> {
    const existing = this.entities.get(id);
    return existing ? clone(existing) : null;
  }

  async insertExternalIdentity(
    identity: ExternalIdentity,
  ): Promise<IdentityWriteResult<ExternalIdentity>> {
    return this.writeIdentity(identity, false);
  }

  async upsertExternalIdentity(
    identity: ExternalIdentity,
  ): Promise<IdentityWriteResult<ExternalIdentity>> {
    return this.writeIdentity(identity, true);
  }

  async getExternalIdentity(id: string): Promise<ExternalIdentity | null> {
    const existing = this.identitiesById.get(id);
    return existing ? clone(existing) : null;
  }

  async findActiveIdentities(input: {
    identityKind: IdentityKind;
    identifier: string;
  }): Promise<ExternalIdentity[]> {
    const hits: ExternalIdentity[] = [];
    for (const row of this.identitiesById.values()) {
      if (row.revokedAt) continue;
      if (row.identityKind !== input.identityKind) continue;
      if (row.identifier !== input.identifier) continue;
      hits.push(clone(row));
    }
    return hits;
  }

  async insertPersonProfile(
    profile: PersonProfile,
  ): Promise<InsertResult<PersonProfile>> {
    this.assertPersonEntity(profile.personId);
    assertPersonRoles(profile.roles);
    const existing = this.profiles.get(profile.personId);
    if (existing) return { status: "already-present", record: clone(existing) };
    this.profiles.set(profile.personId, clone(profile));
    return { status: "inserted", record: clone(profile) };
  }

  async getPersonProfile(personId: string): Promise<PersonProfile | null> {
    const existing = this.profiles.get(personId);
    return existing ? clone(existing) : null;
  }

  async updatePersonProfile(
    personId: string,
    patch: Partial<
      Omit<PersonProfile, "personId" | "createdAt" | "sourceSystem">
    > & { updatedAt: string },
  ): Promise<PersonProfile | null> {
    const existing = this.profiles.get(personId);
    if (!existing) return null;
    if (patch.roles) assertPersonRoles(patch.roles);
    const next: PersonProfile = { ...existing, ...patch, personId };
    this.profiles.set(personId, next);
    return clone(next);
  }

  async insertPersonFact(fact: PersonFact): Promise<InsertResult<PersonFact>> {
    this.assertPersonEntity(fact.personId);
    assertFactValue(fact.value);
    if (!isVisibility(fact.visibility)) throw new Error("invalid visibility");
    if (!isUsagePermission(fact.usagePermission)) {
      throw new Error("invalid usage permission");
    }
    if (!isFactStatus(fact.status)) throw new Error("invalid fact status");
    if (!isFactApprovalStatus(fact.approvalStatus)) {
      throw new Error("invalid fact approval status");
    }
    const existing = this.facts.get(fact.id);
    if (existing) return { status: "already-present", record: clone(existing) };
    if (fact.status === "current") {
      const key = currentFactKey(fact.personId, fact.factType);
      if (this.currentFacts.has(key)) {
        throw new Error("current-fact-conflict");
      }
      this.currentFacts.set(key, fact.id);
    }
    this.facts.set(fact.id, clone(fact));
    return { status: "inserted", record: clone(fact) };
  }

  async getPersonFact(id: string): Promise<PersonFact | null> {
    const existing = this.facts.get(id);
    return existing ? clone(existing) : null;
  }

  async insertRelationship(
    row: EntityRelationship,
  ): Promise<InsertResult<EntityRelationship>> {
    if (row.fromEntityId === row.toEntityId) {
      throw new Error("relationship-self");
    }
    if (!isRelationshipKind(row.kind)) throw new Error("invalid relationship kind");
    if (!isRelationshipStatus(row.status)) {
      throw new Error("invalid relationship status");
    }
    if (!this.entities.has(row.fromEntityId) || !this.entities.has(row.toEntityId)) {
      throw new Error("relationship-entity-missing");
    }
    const existing = this.relationships.get(row.id);
    if (existing) return { status: "already-present", record: clone(existing) };
    if (row.status === "active") {
      const key = relationshipActiveKey(row);
      const existingId = this.activeRelationships.get(key);
      if (existingId) {
        const present = this.relationships.get(existingId);
        if (!present) throw new Error("relationship index corrupt");
        return { status: "already-present", record: clone(present) };
      }
      this.activeRelationships.set(key, row.id);
    }
    this.relationships.set(row.id, clone(row));
    return { status: "inserted", record: clone(row) };
  }

  async insertSourceNote(row: SourceNote): Promise<InsertResult<SourceNote>> {
    if (!row.sourceField.trim()) throw new Error("source-field-required");
    const existing = this.notes.get(row.id);
    if (existing) return { status: "already-present", record: clone(existing) };
    const key = noteKey(row);
    const existingId = this.noteKeys.get(key);
    if (existingId) {
      const present = this.notes.get(existingId);
      if (!present) throw new Error("note index corrupt");
      return { status: "already-present", record: clone(present) };
    }
    this.noteKeys.set(key, row.id);
    this.notes.set(row.id, clone(row));
    return { status: "inserted", record: clone(row) };
  }

  async insertWish(row: Wish): Promise<InsertResult<Wish>> {
    this.assertPersonEntity(row.personId);
    if (!isVisibility(row.visibility)) throw new Error("invalid visibility");
    if (!isUsagePermission(row.usagePermission)) {
      throw new Error("invalid usage permission");
    }
    const existing = this.wishes.get(row.id);
    if (existing) return { status: "already-present", record: clone(existing) };
    this.wishes.set(row.id, clone(row));
    return { status: "inserted", record: clone(row) };
  }

  async insertProjectProfile(
    profile: ProjectProfile,
  ): Promise<InsertResult<ProjectProfile>> {
    this.assertProjectEntity(profile.projectId);
    if (!isVisibility(profile.visibility)) throw new Error("invalid visibility");
    const existing = this.projects.get(profile.projectId);
    if (existing) return { status: "already-present", record: clone(existing) };
    if (profile.importRowKey) {
      const key = `${profile.sourceSystem}\0${profile.importRowKey}`;
      const existingId = this.projectImportKeys.get(key);
      if (existingId) {
        const present = this.projects.get(existingId);
        if (!present) throw new Error("project import index corrupt");
        return { status: "already-present", record: clone(present) };
      }
      this.projectImportKeys.set(key, profile.projectId);
    }
    this.projects.set(profile.projectId, clone(profile));
    return { status: "inserted", record: clone(profile) };
  }

  async getProjectProfile(projectId: string): Promise<ProjectProfile | null> {
    const existing = this.projects.get(projectId);
    return existing ? clone(existing) : null;
  }

  async findProjectByImportRowKey(input: {
    sourceSystem: ContinuumSourceSystem;
    importRowKey: string;
  }): Promise<ProjectProfile | null> {
    const id = this.projectImportKeys.get(
      `${input.sourceSystem}\0${input.importRowKey}`,
    );
    if (!id) return null;
    return this.getProjectProfile(id);
  }

  async insertProjectHistory(
    history: ProjectHistory,
  ): Promise<InsertResult<ProjectHistory>> {
    if (!this.projects.has(history.projectId)) {
      throw new Error("project-profile-missing");
    }
    const existing = this.histories.get(history.projectId);
    if (existing) return { status: "already-present", record: clone(existing) };
    this.histories.set(history.projectId, clone(history));
    return { status: "inserted", record: clone(history) };
  }

  async getProjectHistory(projectId: string): Promise<ProjectHistory | null> {
    const existing = this.histories.get(projectId);
    return existing ? clone(existing) : null;
  }

  async insertIdentityReview(
    row: IdentityReview,
  ): Promise<InsertResult<IdentityReview>> {
    const existing = this.reviews.get(row.id);
    if (existing) return { status: "already-present", record: clone(existing) };
    if (row.importRowKey) {
      const key = reviewKey(row);
      const existingId = this.reviewKeys.get(key);
      if (existingId) {
        const present = this.reviews.get(existingId);
        if (!present) throw new Error("review index corrupt");
        return { status: "already-present", record: clone(present) };
      }
      this.reviewKeys.set(key, row.id);
    }
    this.reviews.set(row.id, clone(row));
    return { status: "inserted", record: clone(row) };
  }

  async createPersonAtomic(
    input: CreatePersonAtomicInput,
  ): Promise<CreatePersonAtomicResult> {
    const snapshot = this.snapshot();
    const personId = input.entityId ?? randomUUID();
    try {
      const existing = this.entities.get(personId);
      if (existing && this.profiles.has(personId)) {
        return {
          status: "already-present",
          personId,
          profile: clone(this.profiles.get(personId)!),
        };
      }
      const entity = await this.insertEntity({
        id: personId,
        kind: "person",
        createdAt: input.createdAt,
        createdBy: input.createdBy,
      });
      if (this.failNextCreateAfter === "entity") {
        this.failNextCreateAfter = null;
        throw new Error("simulated-failure-after-entity");
      }
      const profile: PersonProfile = {
        ...input.profile,
        personId: entity.record.id,
      };
      const profileResult = await this.insertPersonProfile(profile);
      if (this.failNextCreateAfter === "profile") {
        this.failNextCreateAfter = null;
        throw new Error("simulated-failure-after-profile");
      }
      for (const identity of input.identities) {
        const written = await this.upsertExternalIdentity({
          id: identity.id ?? randomUUID(),
          entityId: entity.record.id,
          sourceSystem: identity.sourceSystem,
          identityKind: identity.identityKind,
          identifier: identity.identifier,
          createdAt: input.createdAt,
          revokedAt: null,
        });
        if (written.status === "conflict") {
          throw new Error("identity_conflict");
        }
        if (this.failNextCreateAfter === "identity") {
          this.failNextCreateAfter = null;
          throw new Error("simulated-failure-after-identity");
        }
      }
      return {
        status: profileResult.status === "already-present" ? "already-present" : "inserted",
        personId: entity.record.id,
        profile: profileResult.record,
      };
    } catch (error) {
      this.restore(snapshot);
      throw error;
    }
  }

  async applyExistingPersonAtomic(
    input: ApplyExistingPersonInput,
  ): Promise<ApplyExistingPersonResult> {
    const snapshot = this.snapshot();
    try {
      const entity = this.entities.get(input.personId);
      if (!entity || entity.kind !== "person") {
        throw new Error("person entity missing");
      }
      const existing = this.profiles.get(input.personId);
      if (!existing) throw new Error("person profile missing");
      const plan = planProfileMerge(existing, input.profile);
      if (plan.status === "conflict") {
        this.restore(snapshot);
        return { status: "conflict", reason: "profile_conflict", field: plan.field };
      }
      if (plan.status === "populate") {
        await this.updatePersonProfile(input.personId, {
          ...plan.patch,
          updatedAt: input.updatedAt,
        });
      }
      for (const identity of input.identities) {
        const written = await this.upsertExternalIdentity({
          id: identity.id ?? randomUUID(),
          entityId: input.personId,
          sourceSystem: identity.sourceSystem,
          identityKind: identity.identityKind,
          identifier: identity.identifier,
          createdAt: identity.createdAt,
          revokedAt: null,
        });
        if (written.status === "conflict") {
          this.restore(snapshot);
          return { status: "conflict", reason: "identity_conflict" };
        }
      }
      return {
        status: "applied",
        personId: input.personId,
        populated: plan.status === "populate",
      };
    } catch (error) {
      this.restore(snapshot);
      throw error;
    }
  }

  async inspectCounts(): Promise<ClientMemoryCounts> {
    let persons = 0;
    for (const entity of this.entities.values()) {
      if (entity.kind === "person") persons += 1;
    }
    return {
      persons,
      profiles: this.profiles.size,
      identities: this.identitiesById.size,
      notes: this.notes.size,
      projects: this.projects.size,
      histories: this.histories.size,
      reviews: this.reviews.size,
      facts: this.facts.size,
      relationships: this.relationships.size,
    };
  }

  private assertPersonEntity(personId: string): void {
    const entity = this.entities.get(personId);
    if (!entity || entity.kind !== "person") {
      throw new Error("person-profile-requires-person-entity");
    }
  }

  private assertProjectEntity(projectId: string): void {
    const entity = this.entities.get(projectId);
    if (!entity || entity.kind !== "project") {
      throw new Error("project-profile-requires-project-entity");
    }
  }

  private snapshot(): StoreSnapshot {
    return {
      entities: clone(this.entities),
      identitiesById: clone(this.identitiesById),
      activeIdentityKeys: clone(this.activeIdentityKeys),
      profiles: clone(this.profiles),
      facts: clone(this.facts),
      currentFacts: clone(this.currentFacts),
      relationships: clone(this.relationships),
      activeRelationships: clone(this.activeRelationships),
      notes: clone(this.notes),
      noteKeys: clone(this.noteKeys),
      wishes: clone(this.wishes),
      projects: clone(this.projects),
      projectImportKeys: clone(this.projectImportKeys),
      histories: clone(this.histories),
      reviews: clone(this.reviews),
      reviewKeys: clone(this.reviewKeys),
    };
  }

  private restore(snapshot: StoreSnapshot): void {
    this.entities = snapshot.entities;
    this.identitiesById = snapshot.identitiesById;
    this.activeIdentityKeys = snapshot.activeIdentityKeys;
    this.profiles = snapshot.profiles;
    this.facts = snapshot.facts;
    this.currentFacts = snapshot.currentFacts;
    this.relationships = snapshot.relationships;
    this.activeRelationships = snapshot.activeRelationships;
    this.notes = snapshot.notes;
    this.noteKeys = snapshot.noteKeys;
    this.wishes = snapshot.wishes;
    this.projects = snapshot.projects;
    this.projectImportKeys = snapshot.projectImportKeys;
    this.histories = snapshot.histories;
    this.reviews = snapshot.reviews;
    this.reviewKeys = snapshot.reviewKeys;
  }

  private writeIdentity(
    identity: ExternalIdentity,
    allowSameEntityReplay: boolean,
  ): IdentityWriteResult<ExternalIdentity> {
    const kind = validateIdentityKind(identity.identityKind);
    if (!kind.ok) throw new Error(kind.reason);
    if (identity.identityKind === ("hubspot_deal_id" as IdentityKind)) {
      throw new Error("hubspot_deal_id is not a person identity");
    }
    if (identity.entityId) {
      const entity = this.entities.get(identity.entityId);
      if (entity && entity.kind !== "person") {
        throw new Error("identity-requires-person-entity");
      }
    }

    const existingById = this.identitiesById.get(identity.id);
    if (existingById) {
      return { status: "already-present", record: clone(existingById) };
    }

    if (identity.revokedAt == null) {
      const key = identityKey(identity);
      const existingId = this.activeIdentityKeys.get(key);
      if (existingId) {
        const existing = this.identitiesById.get(existingId);
        if (!existing) throw new Error("identity index corrupt");
        if (existing.entityId === identity.entityId && allowSameEntityReplay) {
          return { status: "already-present", record: clone(existing) };
        }
        if (existing.entityId === identity.entityId) {
          return { status: "already-present", record: clone(existing) };
        }
        return {
          status: "conflict",
          record: clone(existing),
          incomingEntityId: identity.entityId ?? "",
        };
      }
      this.activeIdentityKeys.set(key, identity.id);
    }

    this.identitiesById.set(identity.id, clone(identity));
    return { status: "inserted", record: clone(identity) };
  }
}

type StoreSnapshot = {
  entities: Map<string, ContinuumEntity>;
  identitiesById: Map<string, ExternalIdentity>;
  activeIdentityKeys: Map<string, string>;
  profiles: Map<string, PersonProfile>;
  facts: Map<string, PersonFact>;
  currentFacts: Map<string, string>;
  relationships: Map<string, EntityRelationship>;
  activeRelationships: Map<string, string>;
  notes: Map<string, SourceNote>;
  noteKeys: Map<string, string>;
  wishes: Map<string, Wish>;
  projects: Map<string, ProjectProfile>;
  projectImportKeys: Map<string, string>;
  histories: Map<string, ProjectHistory>;
  reviews: Map<string, IdentityReview>;
  reviewKeys: Map<string, string>;
};

export function newExternalIdentity(input: {
  entityId: string | null;
  sourceSystem: ContinuumSourceSystem;
  identityKind: IdentityKind;
  identifier: string;
  createdAt: string;
  id?: string;
}): ExternalIdentity {
  return {
    id: input.id ?? randomUUID(),
    entityId: input.entityId,
    sourceSystem: input.sourceSystem,
    identityKind: input.identityKind,
    identifier: input.identifier,
    createdAt: input.createdAt,
    revokedAt: null,
  };
}
