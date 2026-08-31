/**
 * Supabase Client Memory reader.
 * App Router / server entry: import from `./server` (enforces `server-only`).
 * Do not import from client components or public routes.
 * Service-role SELECT only. Never INSERT/UPDATE/DELETE.
 */

import { CONTINUUM_SOURCE_SYSTEMS } from "../../contracts/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { composePersonProfile, listOpenReviewsForPerson } from "./profile";
import { composePersonCockpit } from "./cockpit";
import { searchPeopleFromSnapshot } from "./search";
import { isCalendarMonth, listCurrentBirthdaysByMonthFromRows } from "./birthdays";
import type { ClientMemoryReader } from "./reader";
import { SOURCE_NOTE_COLUMNS, rowToSourceNote } from "../source-note-row";
import { loadActiveOperatingDetails } from "../project-operating/load-details";
import {
  CLIENT_MEMORY_COCKPIT_NOTE_LIMIT,
  CLIENT_MEMORY_HISTORY_PAGE_SIZE,
  CLIENT_MEMORY_NOTE_LIMIT,
  CLIENT_MEMORY_SEARCH_LIMIT,
  COCKPIT_MANUAL_SOURCE_SYSTEM,
  type ClientMemoryReadSnapshot,
  type ClientSearchResult,
  type ConciergePersonProfileResult,
  type IdentityReviewSummary,
  type PersonCockpitResult,
  type PersonSourceHistoryQuery,
  type PersonSourceHistoryResult,
} from "./types";
import {
  CLIENT_MEMORY_PROJECT_BOOK_NOTE_LIMIT,
  CLIENT_MEMORY_PROJECT_BOOK_NOTE_QUERY_CAP,
} from "../project-books/types";
import type {
  EntityRelationship,
  IdentityReview,
  PersonFact,
  PersonProfile,
  ProjectHistory,
  ProjectProfile,
  SourceNote,
  Wish,
} from "../types";
import type { BirthdayRead } from "../facts/types";
import { PERSON_FACT_TYPE_BIRTHDAY } from "../facts/types";
import { projectKindFromUnknown } from "../project-kind";

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

function throwQuery(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message ?? fallback);
}

async function rows<T>(
  query: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
  fallback: string,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) throwQuery(error, fallback);
  return data ?? [];
}

const PROFILE_COLUMNS =
  "person_id, display_name, given_name, family_name, organization_name, email, phone, street_address, city, state, country, postal_code, roles";
const RELATIONSHIP_COLUMNS =
  "id, from_entity_id, to_entity_id, kind, status, source_system, created_at, created_by";
const FACT_COLUMNS =
  "id, person_id, fact_type, value, confidence, verification, approval_status, status, visibility, usage_permission, valid_from, valid_until, supersedes_id, source_system, created_at, created_by";
const WISH_COLUMNS =
  "id, person_id, household_id, project_id, related_fact_id, description, category, status, visibility, usage_permission, source_system, created_at, created_by";
const NOTE_COLUMNS = SOURCE_NOTE_COLUMNS;
const REVIEW_COLUMNS =
  "id, status, reason_code, left_person_id, right_person_id, import_row_key, source_system, created_at";
const PROJECT_PROFILE_COLUMNS =
  "project_id, display_title, visibility, import_row_key, source_system, created_at, updated_at, project_kind";
const PROJECT_HISTORY_COLUMNS =
  "project_id, cad_job_number, order_number, gmail_thread_id, match_judgment, match_judgment_raw, finger_size, metal, center_stone, diamond_supply_notes, source_system, created_at, updated_at";
const IDENTITY_COLUMNS = "entity_id, identity_kind, identifier, revoked_at";

function rowToSearchProfile(
  row: Record<string, unknown>,
): ClientMemoryReadSnapshot["profiles"][number] {
  return {
    personId: String(row.person_id),
    displayName: String(row.display_name),
    givenName: row.given_name == null ? null : String(row.given_name),
    familyName: row.family_name == null ? null : String(row.family_name),
    organizationName:
      row.organization_name == null ? null : String(row.organization_name),
    email: row.email == null ? null : String(row.email),
    phone: row.phone == null ? null : String(row.phone),
    streetAddress: row.street_address == null ? null : String(row.street_address),
    city: row.city == null ? null : String(row.city),
    state: row.state == null ? null : String(row.state),
    country: row.country == null ? null : String(row.country),
    postalCode: row.postal_code == null ? null : String(row.postal_code),
    roles: Array.isArray(row.roles) ? (row.roles as PersonProfile["roles"]) : [],
  };
}

function rowToRelationship(row: Record<string, unknown>): EntityRelationship {
  return {
    id: String(row.id),
    fromEntityId: String(row.from_entity_id),
    toEntityId: String(row.to_entity_id),
    kind: row.kind as EntityRelationship["kind"],
    status: row.status as EntityRelationship["status"],
    sourceSystem: row.source_system as EntityRelationship["sourceSystem"],
    createdAt: String(row.created_at),
    createdBy: String(row.created_by),
  };
}

function rowToFact(row: Record<string, unknown>): PersonFact {
  return {
    id: String(row.id),
    personId: String(row.person_id),
    factType: String(row.fact_type),
    value: row.value as PersonFact["value"],
    confidence: Number(row.confidence),
    verification: row.verification == null ? null : String(row.verification),
    approvalStatus: row.approval_status as PersonFact["approvalStatus"],
    status: row.status as PersonFact["status"],
    visibility: row.visibility as PersonFact["visibility"],
    usagePermission: row.usage_permission as PersonFact["usagePermission"],
    validFrom: row.valid_from == null ? null : String(row.valid_from),
    validUntil: row.valid_until == null ? null : String(row.valid_until),
    supersedesId: row.supersedes_id == null ? null : String(row.supersedes_id),
    sourceSystem: row.source_system as PersonFact["sourceSystem"],
    createdAt: String(row.created_at),
    createdBy: String(row.created_by),
  };
}

function rowToWish(row: Record<string, unknown>): Wish {
  return {
    id: String(row.id),
    personId: String(row.person_id),
    householdId: row.household_id == null ? null : String(row.household_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    relatedFactId: row.related_fact_id == null ? null : String(row.related_fact_id),
    description: String(row.description),
    category: row.category == null ? null : String(row.category),
    status: String(row.status),
    visibility: row.visibility as Wish["visibility"],
    usagePermission: row.usage_permission as Wish["usagePermission"],
    sourceSystem: row.source_system as Wish["sourceSystem"],
    createdAt: String(row.created_at),
    createdBy: String(row.created_by),
  };
}

function rowToNote(row: Record<string, unknown>): SourceNote {
  return rowToSourceNote(row);
}

function rowToReview(row: Record<string, unknown>): IdentityReview {
  return {
    id: String(row.id),
    status: row.status as IdentityReview["status"],
    reasonCode: String(row.reason_code),
    leftPersonId: row.left_person_id == null ? null : String(row.left_person_id),
    rightPersonId: row.right_person_id == null ? null : String(row.right_person_id),
    importRowKey: row.import_row_key == null ? null : String(row.import_row_key),
    issueText: null,
    resolutionText: null,
    sourceSystem: row.source_system as IdentityReview["sourceSystem"],
    createdAt: String(row.created_at),
  };
}

function rowToProjectProfile(row: Record<string, unknown>): ProjectProfile {
  return {
    projectId: String(row.project_id),
    displayTitle: String(row.display_title),
    visibility: row.visibility as ProjectProfile["visibility"],
    importRowKey: row.import_row_key == null ? null : String(row.import_row_key),
    sourceSystem: row.source_system as ProjectProfile["sourceSystem"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    projectKind: projectKindFromUnknown(row.project_kind),
  };
}

function rowToProjectHistory(row: Record<string, unknown>): ProjectHistory {
  return {
    projectId: String(row.project_id),
    cadJobNumber: row.cad_job_number == null ? null : String(row.cad_job_number),
    orderNumber: row.order_number == null ? null : String(row.order_number),
    gmailThreadId: row.gmail_thread_id == null ? null : String(row.gmail_thread_id),
    matchJudgment: (row.match_judgment ?? null) as ProjectHistory["matchJudgment"],
    matchJudgmentRaw:
      row.match_judgment_raw == null ? null : String(row.match_judgment_raw),
    fingerSize: row.finger_size == null ? null : String(row.finger_size),
    metal: row.metal == null ? null : String(row.metal),
    centerStone: row.center_stone == null ? null : String(row.center_stone),
    diamondSupplyNotes:
      row.diamond_supply_notes == null ? null : String(row.diamond_supply_notes),
    sourceSystem: row.source_system as ProjectHistory["sourceSystem"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class SupabaseClientMemoryReader implements ClientMemoryReader {
  constructor(private readonly client: SupabaseClient) {}

  async searchPeople(
    query: string,
    options?: { limit?: number },
  ): Promise<ClientSearchResult[]> {
    const [profileRows, relationshipRows] = await Promise.all([
      rows<Record<string, unknown>>(
        this.client.from("continuum_person_profiles").select(PROFILE_COLUMNS),
        "read-person-profiles-failed",
      ),
      rows<Record<string, unknown>>(
        this.client
          .from("continuum_relationships")
          .select(RELATIONSHIP_COLUMNS)
          .eq("kind", "client-project")
          .eq("status", "active"),
        "read-relationships-failed",
      ),
    ]);
    return searchPeopleFromSnapshot(
      {
        profiles: profileRows.map(rowToSearchProfile),
        relationships: relationshipRows.map(rowToRelationship),
      },
      query,
      options?.limit ?? CLIENT_MEMORY_SEARCH_LIMIT,
    );
  }

  async getPersonProfile(personId: string): Promise<ConciergePersonProfileResult> {
    const snapshot = await this.loadPersonSnapshot(personId);
    return composePersonProfile(snapshot, personId);
  }

  async getPersonCockpit(personId: string): Promise<PersonCockpitResult> {
    const loaded = await this.loadPersonCockpitSnapshot(personId);
    if (!loaded) return { ok: false, reason: "not-found" };
    return composePersonCockpit(loaded.snapshot, personId, {
      noteCount: loaded.noteCount,
    });
  }

  async listPersonSourceHistory(
    personId: string,
    query?: PersonSourceHistoryQuery,
  ): Promise<PersonSourceHistoryResult> {
    return this.loadPersonSourceHistory(personId, query);
  }

  async listOpenIdentityReviews(personId: string): Promise<IdentityReviewSummary[]> {
    const snapshot = await this.loadPersonSnapshot(personId);
    return listOpenReviewsForPerson(snapshot, personId);
  }

  async listCurrentBirthdaysByMonth(month: number): Promise<BirthdayRead[]> {
    if (!isCalendarMonth(month)) return [];
    const factRows = await rows<Record<string, unknown>>(
      this.client
        .from("continuum_person_facts")
        .select(FACT_COLUMNS)
        .eq("fact_type", PERSON_FACT_TYPE_BIRTHDAY)
        .eq("status", "current")
        .filter("value->>month", "eq", String(month)),
      "read-birthdays-failed",
    );
    const facts = factRows.map(rowToFact);
    const personIds = [...new Set(facts.map((row) => row.personId))];
    const profileRows =
      personIds.length > 0
        ? await rows<Record<string, unknown>>(
            this.client
              .from("continuum_person_profiles")
              .select("person_id, display_name")
              .in("person_id", personIds),
            "read-birthday-profiles-failed",
          )
        : [];
    const namesByPersonId = new Map(
      profileRows.map((row) => [String(row.person_id), String(row.display_name)]),
    );
    return listCurrentBirthdaysByMonthFromRows({ month, facts, namesByPersonId });
  }

  private async loadPersonSnapshot(personId: string): Promise<ClientMemoryReadSnapshot> {
    const trimmed = personId.trim();
    if (!trimmed) return emptySnapshot();

    const profileRows = await rows<Record<string, unknown>>(
      this.client
        .from("continuum_person_profiles")
        .select(PROFILE_COLUMNS)
        .eq("person_id", trimmed),
      "read-person-profile-failed",
    );
    const profiles = profileRows.map(rowToSearchProfile);
    if (profiles.length === 0) return emptySnapshot();

    const [relationshipRows, factRows, wishRows, identityRows] = await Promise.all([
      rows<Record<string, unknown>>(
        this.client
          .from("continuum_relationships")
          .select(RELATIONSHIP_COLUMNS)
          .or(`from_entity_id.eq.${trimmed},to_entity_id.eq.${trimmed}`),
        "read-person-relationships-failed",
      ),
      rows<Record<string, unknown>>(
        this.client
          .from("continuum_person_facts")
          .select(FACT_COLUMNS)
          .eq("person_id", trimmed),
        "read-person-facts-failed",
      ),
      rows<Record<string, unknown>>(
        this.client
          .from("continuum_wishes")
          .select(WISH_COLUMNS)
          .eq("person_id", trimmed),
        "read-person-wishes-failed",
      ),
      rows<Record<string, unknown>>(
        this.client
          .from("continuum_external_identities")
          .select(IDENTITY_COLUMNS)
          .eq("entity_id", trimmed)
          .is("revoked_at", null),
        "read-person-identities-failed",
      ),
    ]);

    const relationships = relationshipRows.map(rowToRelationship);
    const projectIds = [
      ...new Set(
        relationships
          .filter((row) => row.kind === "client-project" && row.status === "active")
          .map((row) =>
            row.fromEntityId === trimmed ? row.toEntityId : row.fromEntityId,
          ),
      ),
    ];

    const [projectProfileRows, projectHistoryRows, noteRows] = await Promise.all([
      projectIds.length > 0
        ? rows<Record<string, unknown>>(
            this.client
              .from("continuum_project_profiles")
              .select(PROJECT_PROFILE_COLUMNS)
              .in("project_id", projectIds),
            "read-project-profiles-failed",
          )
        : Promise.resolve([]),
      projectIds.length > 0
        ? rows<Record<string, unknown>>(
            this.client
              .from("continuum_project_history")
              .select(PROJECT_HISTORY_COLUMNS)
              .in("project_id", projectIds),
            "read-project-history-failed",
          )
        : Promise.resolve([]),
      loadNotes(this.client, trimmed, projectIds),
    ]);

    const importKeys = [
      ...identityRows
        .filter((row) => String(row.identity_kind) === "import_row_key")
        .map((row) => String(row.identifier)),
      ...projectProfileRows
        .map((row) => row.import_row_key)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ];

    const reviewRows = await loadReviews(this.client, trimmed, importKeys);
    const projectProfiles = projectProfileRows.map(rowToProjectProfile);
    const operating = await loadActiveOperatingDetails(
      this.client,
      projectProfiles,
    );

    return {
      profiles,
      identities: identityRows.map((row) => ({
        entityId: row.entity_id == null ? null : String(row.entity_id),
        identityKind: String(row.identity_kind),
        identifier: String(row.identifier),
        revokedAt: row.revoked_at == null ? null : String(row.revoked_at),
      })),
      relationships,
      facts: factRows.map(rowToFact),
      wishes: wishRows.map(rowToWish),
      sourceNotes: noteRows.map(rowToNote),
      reviews: reviewRows.map(rowToReview),
      projectProfiles,
      projectHistories: projectHistoryRows.map(rowToProjectHistory),
      customDetails: operating.customDetails,
      repairDetails: operating.repairDetails,
    };
  }

  private async loadPersonCockpitSnapshot(personId: string): Promise<{
    snapshot: ClientMemoryReadSnapshot;
    noteCount: number;
  } | null> {
    const trimmed = personId.trim();
    if (!trimmed) return null;

    const profileRows = await rows<Record<string, unknown>>(
      this.client
        .from("continuum_person_profiles")
        .select(PROFILE_COLUMNS)
        .eq("person_id", trimmed),
      "read-person-profile-failed",
    );
    const profiles = profileRows.map(rowToSearchProfile);
    if (profiles.length === 0) return null;

    const [relationshipRows, factRows, wishRows, identityRows, noteCount] =
      await Promise.all([
        rows<Record<string, unknown>>(
          this.client
            .from("continuum_relationships")
            .select(RELATIONSHIP_COLUMNS)
            .or(`from_entity_id.eq.${trimmed},to_entity_id.eq.${trimmed}`),
          "read-person-relationships-failed",
        ),
        rows<Record<string, unknown>>(
          this.client
            .from("continuum_person_facts")
            .select(FACT_COLUMNS)
            .eq("person_id", trimmed),
          "read-person-facts-failed",
        ),
        rows<Record<string, unknown>>(
          this.client
            .from("continuum_wishes")
            .select(WISH_COLUMNS)
            .eq("person_id", trimmed),
          "read-person-wishes-failed",
        ),
        rows<Record<string, unknown>>(
          this.client
            .from("continuum_external_identities")
            .select(IDENTITY_COLUMNS)
            .eq("entity_id", trimmed)
            .is("revoked_at", null),
          "read-person-identities-failed",
        ),
        countPersonNotes(this.client, trimmed, null, "default"),
      ]);

    const relationships = relationshipRows.map(rowToRelationship);
    const projectIds = linkedActiveProjectIds(trimmed, relationships);
    const counterpartIds = counterpartPersonIds(trimmed, relationships);

    const [
      projectProfileRows,
      projectHistoryRows,
      counterpartRows,
      noteRows,
      projectBookNoteRows,
    ] = await Promise.all([
      projectIds.length > 0
        ? rows<Record<string, unknown>>(
            this.client
              .from("continuum_project_profiles")
              .select(PROJECT_PROFILE_COLUMNS)
              .in("project_id", projectIds),
            "read-project-profiles-failed",
          )
        : Promise.resolve([]),
      projectIds.length > 0
        ? rows<Record<string, unknown>>(
            this.client
              .from("continuum_project_history")
              .select(PROJECT_HISTORY_COLUMNS)
              .in("project_id", projectIds),
            "read-project-history-failed",
          )
        : Promise.resolve([]),
      counterpartIds.length > 0
        ? rows<Record<string, unknown>>(
            this.client
              .from("continuum_person_profiles")
              .select("person_id, display_name")
              .in("person_id", counterpartIds),
            "read-counterpart-profiles-failed",
          )
        : Promise.resolve([]),
      rows<Record<string, unknown>>(
        this.client
          .from("continuum_source_notes")
          .select(NOTE_COLUMNS)
          .eq("person_id", trimmed)
          .eq("source_system", COCKPIT_MANUAL_SOURCE_SYSTEM)
          .eq("lifecycle_status", "kept")
          .order("created_at", { ascending: false })
          .limit(CLIENT_MEMORY_COCKPIT_NOTE_LIMIT),
        "read-cockpit-notes-failed",
      ),
      projectIds.length > 0
        ? rows<Record<string, unknown>>(
            this.client
              .from("continuum_source_notes")
              .select(NOTE_COLUMNS)
              .in("project_id", projectIds)
              .in("lifecycle_status", ["kept", "absorbed"])
              .order("created_at", { ascending: false })
              .limit(
                Math.min(
                  CLIENT_MEMORY_PROJECT_BOOK_NOTE_LIMIT * projectIds.length,
                  CLIENT_MEMORY_PROJECT_BOOK_NOTE_QUERY_CAP,
                ),
              ),
            "read-project-book-notes-failed",
          )
        : Promise.resolve([]),
    ]);

    const importKeys = [
      ...identityRows
        .filter((row) => String(row.identity_kind) === "import_row_key")
        .map((row) => String(row.identifier)),
      ...projectProfileRows
        .map((row) => row.import_row_key)
        .filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        ),
    ];
    const reviewRows = await loadReviews(this.client, trimmed, importKeys);
    const counterpartProfiles = counterpartRows.map((row) =>
      nameOnlyProfile(String(row.person_id), String(row.display_name)),
    );
    const sourceNotesById = new Map(
      [...noteRows, ...projectBookNoteRows].map((row) => {
        const mapped = rowToNote(row);
        return [mapped.id, mapped] as const;
      }),
    );
    const projectProfiles = projectProfileRows.map(rowToProjectProfile);
    const operating = await loadActiveOperatingDetails(
      this.client,
      projectProfiles,
    );

    return {
      noteCount,
      snapshot: {
        profiles: [...profiles, ...counterpartProfiles],
        identities: identityRows.map((row) => ({
          entityId: row.entity_id == null ? null : String(row.entity_id),
          identityKind: String(row.identity_kind),
          identifier: String(row.identifier),
          revokedAt: row.revoked_at == null ? null : String(row.revoked_at),
        })),
        relationships,
        facts: factRows.map(rowToFact),
        wishes: wishRows.map(rowToWish),
        sourceNotes: [...sourceNotesById.values()],
        reviews: reviewRows.map(rowToReview),
        projectProfiles,
        projectHistories: projectHistoryRows.map(rowToProjectHistory),
        customDetails: operating.customDetails,
        repairDetails: operating.repairDetails,
      },
    };
  }

  private async loadPersonSourceHistory(
    personId: string,
    query?: PersonSourceHistoryQuery,
  ): Promise<PersonSourceHistoryResult> {
    const trimmed = personId.trim();
    if (!trimmed) return { ok: false, reason: "not-found" };

    const profileRows = await rows<Record<string, unknown>>(
      this.client
        .from("continuum_person_profiles")
        .select("person_id, display_name")
        .eq("person_id", trimmed),
      "read-person-profile-failed",
    );
    const profile = profileRows[0];
    if (!profile) return { ok: false, reason: "not-found" };

    const pageSize =
      query?.pageSize && query.pageSize > 0
        ? Math.min(query.pageSize, CLIENT_MEMORY_HISTORY_PAGE_SIZE)
        : CLIENT_MEMORY_HISTORY_PAGE_SIZE;
    const page = query?.page && query.page > 0 ? query.page : 1;
    const sourceSystem = allowedHistorySource(query?.sourceSystem);
    const lifecycle = query?.lifecycle === "trashed" ? "trashed" : null;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const [noteRows, total] = await Promise.all([
      loadHistoryNotes(this.client, trimmed, {
        sourceSystem,
        lifecycle,
        from,
        to,
      }),
      countPersonNotes(this.client, trimmed, sourceSystem, lifecycle ?? "default"),
    ]);
    const notes = noteRows.map(rowToNote);
    const projectIds = [
      ...new Set(
        notes
          .map((note) => note.projectId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const projectRows =
      projectIds.length > 0
        ? await rows<Record<string, unknown>>(
            this.client
              .from("continuum_project_profiles")
              .select("project_id, display_title")
              .in("project_id", projectIds),
            "read-history-project-titles-failed",
          )
        : [];

    return {
      ok: true,
      history: {
        personId: trimmed,
        displayName: String(profile.display_name),
        notes: notes.map((note) => ({
          id: note.id,
          personId: note.personId,
          projectId: note.projectId,
          contextLayer: note.contextLayer,
          sourceSystem: note.sourceSystem,
          sourceArtifact: note.sourceArtifact,
          sourceSheet: note.sourceSheet,
          sourceField: note.sourceField,
          gmailThreadId: note.gmailThreadId,
          noteText: note.noteText,
          createdAt: note.createdAt,
          lifecycleStatus: note.lifecycleStatus,
        })),
        projectTitles: Object.fromEntries(
          projectRows.map((row) => [
            String(row.project_id),
            String(row.display_title),
          ]),
        ),
        total,
        page,
        pageSize,
        sourceSystem,
        lifecycle,
      },
    };
  }
}

function emptySnapshot(): ClientMemoryReadSnapshot {
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

function linkedActiveProjectIds(
  personId: string,
  relationships: EntityRelationship[],
): string[] {
  const ids: string[] = [];
  for (const row of relationships) {
    if (row.kind !== "client-project" || row.status !== "active") continue;
    if (row.fromEntityId === personId) ids.push(row.toEntityId);
    else if (row.toEntityId === personId) ids.push(row.fromEntityId);
  }
  return [...new Set(ids)];
}

function counterpartPersonIds(
  personId: string,
  relationships: EntityRelationship[],
): string[] {
  const ids: string[] = [];
  for (const row of relationships) {
    if (row.status !== "active" || row.kind === "client-project") continue;
    const counterpartId =
      row.fromEntityId === personId ? row.toEntityId : row.fromEntityId;
    if (counterpartId && counterpartId !== personId) ids.push(counterpartId);
  }
  return [...new Set(ids)];
}

function nameOnlyProfile(
  personId: string,
  displayName: string,
): ClientMemoryReadSnapshot["profiles"][number] {
  return {
    personId,
    displayName,
    givenName: null,
    familyName: null,
    organizationName: null,
    email: null,
    phone: null,
    streetAddress: null,
    city: null,
    state: null,
    country: null,
    postalCode: null,
    roles: [],
  };
}

function allowedHistorySource(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return (CONTINUUM_SOURCE_SYSTEMS as readonly string[]).includes(trimmed)
    ? trimmed
    : null;
}

async function countPersonNotes(
  client: SupabaseClient,
  personId: string,
  sourceSystem: string | null,
  lifecycle: "default" | "trashed" = "default",
): Promise<number> {
  let query = client
    .from("continuum_source_notes")
    .select("id", { count: "exact", head: true })
    .eq("person_id", personId);
  if (sourceSystem) query = query.eq("source_system", sourceSystem);
  query =
    lifecycle === "trashed"
      ? query.eq("lifecycle_status", "trashed")
      : query.in("lifecycle_status", ["kept", "absorbed"]);
  const { count, error } = await query;
  if (error) throwQuery(error, "count-source-notes-failed");
  return count ?? 0;
}

async function loadHistoryNotes(
  client: SupabaseClient,
  personId: string,
  input: {
    sourceSystem: string | null;
    lifecycle: "trashed" | null;
    from: number;
    to: number;
  },
): Promise<Record<string, unknown>[]> {
  let query = client
    .from("continuum_source_notes")
    .select(NOTE_COLUMNS)
    .eq("person_id", personId)
    .order("created_at", { ascending: false })
    .range(input.from, input.to);
  if (input.sourceSystem) {
    query = query.eq("source_system", input.sourceSystem);
  }
  query =
    input.lifecycle === "trashed"
      ? query.eq("lifecycle_status", "trashed")
      : query.in("lifecycle_status", ["kept", "absorbed"]);
  return rows<Record<string, unknown>>(query, "read-source-history-failed");
}

async function loadNotes(
  client: SupabaseClient,
  personId: string,
  projectIds: string[],
): Promise<Record<string, unknown>[]> {
  if (projectIds.length === 0) {
    return rows<Record<string, unknown>>(
      client
        .from("continuum_source_notes")
        .select(NOTE_COLUMNS)
        .eq("person_id", personId)
        .in("lifecycle_status", ["kept", "absorbed"])
        .order("created_at", { ascending: false })
        .limit(CLIENT_MEMORY_NOTE_LIMIT),
      "read-source-notes-failed",
    );
  }
  return rows<Record<string, unknown>>(
    client
      .from("continuum_source_notes")
      .select(NOTE_COLUMNS)
      .or(`person_id.eq.${personId},project_id.in.(${projectIds.join(",")})`)
      .in("lifecycle_status", ["kept", "absorbed"])
      .order("created_at", { ascending: false })
      .limit(CLIENT_MEMORY_NOTE_LIMIT),
    "read-source-notes-failed",
  );
}

async function loadReviews(
  client: SupabaseClient,
  personId: string,
  importKeys: string[],
): Promise<Record<string, unknown>[]> {
  const uniqueKeys = [...new Set(importKeys.filter(Boolean))];
  const [byPerson, byImportKey] = await Promise.all([
    rows<Record<string, unknown>>(
      client
        .from("continuum_identity_reviews")
        .select(REVIEW_COLUMNS)
        .or(`left_person_id.eq.${personId},right_person_id.eq.${personId}`),
      "read-identity-reviews-failed",
    ),
    uniqueKeys.length > 0
      ? rows<Record<string, unknown>>(
          client
            .from("continuum_identity_reviews")
            .select(REVIEW_COLUMNS)
            .in("import_row_key", uniqueKeys),
          "read-identity-reviews-by-key-failed",
        )
      : Promise.resolve([]),
  ]);
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of [...byPerson, ...byImportKey]) {
    byId.set(String(row.id), row);
  }
  return [...byId.values()];
}

export function createSupabaseClientMemoryReader(
  client?: SupabaseClient | null,
): ClientMemoryReader {
  return new SupabaseClientMemoryReader(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}
