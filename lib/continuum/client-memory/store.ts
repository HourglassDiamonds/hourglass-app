/**
 * Client Memory store contracts and in-memory adapter.
 * Not wired to production routes. Not a production mutation path.
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
import type {
  ClientMemoryEntity,
  EntityRelationship,
  IdentityReview,
  IdentityWriteResult,
  InsertResult,
  PersonFact,
  PersonProfile,
  ProjectProfile,
  SourceNote,
  Wish,
} from "./types";

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
  insertIdentityReview(
    row: IdentityReview,
  ): Promise<InsertResult<IdentityReview>>;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function identityKey(row: Pick<ExternalIdentity, "sourceSystem" | "identityKind" | "identifier">) {
  return `${row.sourceSystem}\0${row.identityKind}\0${row.identifier}`;
}

export class InMemoryClientMemoryStore implements ClientMemoryStore {
  private entities = new Map<string, ContinuumEntity>();
  private identitiesById = new Map<string, ExternalIdentity>();
  private activeIdentityKeys = new Map<string, string>();
  private profiles = new Map<string, PersonProfile>();
  private facts = new Map<string, PersonFact>();
  private relationships = new Map<string, EntityRelationship>();
  private notes = new Map<string, SourceNote>();
  private wishes = new Map<string, Wish>();
  private projects = new Map<string, ProjectProfile>();
  private reviews = new Map<string, IdentityReview>();

  reset(): void {
    this.entities.clear();
    this.identitiesById.clear();
    this.activeIdentityKeys.clear();
    this.profiles.clear();
    this.facts.clear();
    this.relationships.clear();
    this.notes.clear();
    this.wishes.clear();
    this.projects.clear();
    this.reviews.clear();
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
    const next: PersonProfile = { ...existing, ...patch, personId };
    this.profiles.set(personId, next);
    return clone(next);
  }

  async insertPersonFact(fact: PersonFact): Promise<InsertResult<PersonFact>> {
    const existing = this.facts.get(fact.id);
    if (existing) return { status: "already-present", record: clone(existing) };
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
    const existing = this.relationships.get(row.id);
    if (existing) return { status: "already-present", record: clone(existing) };
    this.relationships.set(row.id, clone(row));
    return { status: "inserted", record: clone(row) };
  }

  async insertSourceNote(row: SourceNote): Promise<InsertResult<SourceNote>> {
    const existing = this.notes.get(row.id);
    if (existing) return { status: "already-present", record: clone(existing) };
    this.notes.set(row.id, clone(row));
    return { status: "inserted", record: clone(row) };
  }

  async insertWish(row: Wish): Promise<InsertResult<Wish>> {
    const existing = this.wishes.get(row.id);
    if (existing) return { status: "already-present", record: clone(existing) };
    this.wishes.set(row.id, clone(row));
    return { status: "inserted", record: clone(row) };
  }

  async insertProjectProfile(
    profile: ProjectProfile,
  ): Promise<InsertResult<ProjectProfile>> {
    const existing = this.projects.get(profile.projectId);
    if (existing) return { status: "already-present", record: clone(existing) };
    this.projects.set(profile.projectId, clone(profile));
    return { status: "inserted", record: clone(profile) };
  }

  async getProjectProfile(projectId: string): Promise<ProjectProfile | null> {
    const existing = this.projects.get(projectId);
    return existing ? clone(existing) : null;
  }

  async insertIdentityReview(
    row: IdentityReview,
  ): Promise<InsertResult<IdentityReview>> {
    const existing = this.reviews.get(row.id);
    if (existing) return { status: "already-present", record: clone(existing) };
    this.reviews.set(row.id, clone(row));
    return { status: "inserted", record: clone(row) };
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
