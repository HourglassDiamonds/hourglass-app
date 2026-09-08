/**
 * Canonical Continuum world for Gmail candidate association.
 * Profile email hashes are supporting evidence only.
 * Confirmed identity comes from founder mappings / source links, never display names.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import {
  buildGmailCandidateWorld,
  type CandidateWorldInput,
} from "@/lib/continuum/gmail/candidates/world";
import type {
  GmailCandidateWorld,
  GmailConfirmedPersonMapping,
  GmailConfirmedSourceLink,
} from "@/lib/continuum/gmail/candidates/types";
import { projectKindFromUnknown } from "../project-kind";
import type {
  EntityRelationship,
  PersonProfile,
  PersonRole,
  ProjectHistory,
  ProjectProfile,
} from "../types";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";

function asRoles(value: unknown): PersonRole[] {
  if (!Array.isArray(value)) return ["client"];
  return value.filter((row): row is PersonRole => typeof row === "string") as PersonRole[];
}

export type GmailIntakePersonDirectoryRow = {
  personId: string;
  displayName: string;
  email: string | null;
};

function mappingRows(
  rows: readonly Record<string, unknown>[] | null | undefined,
): GmailConfirmedPersonMapping[] {
  const out: GmailConfirmedPersonMapping[] = [];
  for (const row of rows ?? []) {
    const emailHash = String(row.email_hash ?? row.emailHash ?? "").trim();
    const personId = String(row.person_id ?? row.personId ?? "").trim();
    if (!emailHash || !personId) continue;
    out.push({ emailHash, personId });
  }
  return out;
}

function identityMappingRows(
  rows: readonly Record<string, unknown>[] | null | undefined,
): GmailConfirmedPersonMapping[] {
  const out: GmailConfirmedPersonMapping[] = [];
  for (const row of rows ?? []) {
    if (String(row.revoked_at ?? row.revokedAt ?? "").trim()) continue;
    if (String(row.identity_kind ?? row.identityKind ?? "") !== "email_hash") continue;
    if (String(row.source_system ?? row.sourceSystem ?? "") !== "concierge-manual") continue;
    const emailHash = String(row.identifier ?? "").trim();
    const personId = String(row.entity_id ?? row.entityId ?? "").trim();
    if (!emailHash || !personId) continue;
    out.push({ emailHash, personId });
  }
  return out;
}

export function intakeDirectoryFromPersonRows(
  people: readonly Record<string, unknown>[],
): GmailIntakePersonDirectoryRow[] {
  return people.flatMap((row) => {
    const personId = String(row.person_id ?? row.personId ?? "").trim();
    const displayName = String(row.display_name ?? row.displayName ?? "").trim();
    if (!personId || !displayName) return [];
    const emailRaw = row.email == null ? null : String(row.email).trim();
    return [
      {
        personId,
        displayName,
        email: emailRaw || null,
      },
    ];
  });
}

export function candidateWorldFromRows(input: {
  people: readonly Record<string, unknown>[];
  projects: readonly Record<string, unknown>[];
  histories: readonly Record<string, unknown>[];
  relationships: readonly Record<string, unknown>[];
  internalEmailHashes?: readonly string[];
  confirmedParticipantMappings?: readonly Record<string, unknown>[];
  founderConfirmedEmailIdentities?: readonly Record<string, unknown>[];
  confirmedSourceLinks?: readonly GmailConfirmedSourceLink[];
}): GmailCandidateWorld {
  const people: PersonProfile[] = input.people.map((row) => ({
    personId: String(row.person_id ?? row.personId ?? ""),
    displayName: String(row.display_name ?? row.displayName ?? ""),
    givenName: row.given_name == null && row.givenName == null ? null : String(row.given_name ?? row.givenName),
    familyName: row.family_name == null && row.familyName == null ? null : String(row.family_name ?? row.familyName),
    organizationName:
      row.organization_name == null && row.organizationName == null
        ? null
        : String(row.organization_name ?? row.organizationName),
    email: row.email == null ? null : String(row.email),
    phone: row.phone == null ? null : String(row.phone),
    streetAddress: null,
    city: null,
    state: null,
    country: null,
    postalCode: null,
    roles: asRoles(row.roles),
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: String(row.created_at ?? row.createdAt ?? new Date(0).toISOString()),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? new Date(0).toISOString()),
  }));
  const projects: ProjectProfile[] = input.projects.map((row) => ({
    projectId: String(row.project_id ?? row.projectId ?? ""),
    displayTitle: String(row.display_title ?? row.displayTitle ?? ""),
    visibility: "internal-only",
    importRowKey: null,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: String(row.created_at ?? row.createdAt ?? new Date(0).toISOString()),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? new Date(0).toISOString()),
    projectKind: projectKindFromUnknown(row.project_kind ?? row.projectKind),
  }));
  const histories: ProjectHistory[] = input.histories.map((row) => ({
    projectId: String(row.project_id ?? row.projectId ?? ""),
    cadJobNumber: row.cad_job_number == null && row.cadJobNumber == null ? null : String(row.cad_job_number ?? row.cadJobNumber),
    orderNumber: row.order_number == null && row.orderNumber == null ? null : String(row.order_number ?? row.orderNumber),
    gmailThreadId:
      row.gmail_thread_id == null && row.gmailThreadId == null
        ? null
        : String(row.gmail_thread_id ?? row.gmailThreadId),
    matchJudgment: null,
    matchJudgmentRaw: null,
    fingerSize: row.finger_size == null && row.fingerSize == null ? null : String(row.finger_size ?? row.fingerSize),
    metal: row.metal == null ? null : String(row.metal),
    centerStone: row.center_stone == null && row.centerStone == null ? null : String(row.center_stone ?? row.centerStone),
    diamondSupplyNotes:
      row.diamond_supply_notes == null && row.diamondSupplyNotes == null
        ? null
        : String(row.diamond_supply_notes ?? row.diamondSupplyNotes),
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: String(row.created_at ?? row.createdAt ?? new Date(0).toISOString()),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? new Date(0).toISOString()),
  }));
  const relationships: EntityRelationship[] = input.relationships.map((row) => ({
    id: String(row.id ?? `${row.from_entity_id ?? row.fromEntityId}-${row.to_entity_id ?? row.toEntityId}`),
    fromEntityId: String(row.from_entity_id ?? row.fromEntityId ?? ""),
    toEntityId: String(row.to_entity_id ?? row.toEntityId ?? ""),
    kind: (row.kind as EntityRelationship["kind"]) ?? "client-project",
    status: (row.status as EntityRelationship["status"]) ?? "active",
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: String(row.created_at ?? row.createdAt ?? new Date(0).toISOString()),
    createdBy: String(row.created_by ?? row.createdBy ?? "system"),
  }));
  const worldInput: CandidateWorldInput = {
    people,
    projects,
    histories,
    relationships,
    internalEmails: [],
    confirmedParticipantMappings: mappingRows(input.confirmedParticipantMappings),
    founderConfirmedEmailIdentities: identityMappingRows(
      input.founderConfirmedEmailIdentities,
    ),
    confirmedSourceLinks: input.confirmedSourceLinks ?? [],
  };
  const world = buildGmailCandidateWorld(worldInput);
  return {
    ...world,
    internalEmailHashes: input.internalEmailHashes ?? [],
  };
}

export async function loadGmailCandidateWorld(
  client: SupabaseClient,
  internalEmailHashes: readonly string[] = [],
): Promise<GmailCandidateWorld> {
  const [people, projects, histories, relationships, mappings, identities] =
    await Promise.all([
      client.from("continuum_person_profiles").select("person_id, display_name, given_name, family_name, organization_name, email, roles, created_at, updated_at"),
      client.from("continuum_project_profiles").select("project_id, display_title, project_kind, created_at, updated_at"),
      client.from("continuum_project_histories").select("project_id, cad_job_number, order_number, gmail_thread_id, finger_size, metal, center_stone, diamond_supply_notes, created_at, updated_at"),
      client.from("continuum_relationships").select("id, from_entity_id, to_entity_id, kind, status, created_at, created_by").eq("kind", "client-project").eq("status", "active"),
      client.from("continuum_calendar_participant_mappings").select("email_hash, person_id"),
      client
        .from("continuum_external_identities")
        .select("entity_id, identity_kind, identifier, source_system, revoked_at")
        .eq("identity_kind", "email_hash")
        .eq("source_system", "concierge-manual")
        .is("revoked_at", null),
    ]);
  if (people.error) throw new Error("read-person-profiles-failed");
  if (projects.error) throw new Error("read-project-profiles-failed");
  if (histories.error) throw new Error("read-project-histories-failed");
  if (relationships.error) throw new Error("read-relationships-failed");
  return candidateWorldFromRows({
    people: people.data ?? [],
    projects: projects.data ?? [],
    histories: histories.data ?? [],
    relationships: relationships.data ?? [],
    internalEmailHashes,
    confirmedParticipantMappings: mappings.error ? [] : mappings.data ?? [],
    founderConfirmedEmailIdentities: identities.error ? [] : identities.data ?? [],
  });
}

export async function loadGmailIntakePersonDirectory(
  client: SupabaseClient,
): Promise<GmailIntakePersonDirectoryRow[]> {
  const people = await client
    .from("continuum_person_profiles")
    .select("person_id, display_name, email");
  if (people.error) throw new Error("read-person-profiles-failed");
  return intakeDirectoryFromPersonRows(people.data ?? []);
}

export async function loadGmailCandidateWorldFromAdmin(
  internalEmailHashes: readonly string[] = [],
): Promise<GmailCandidateWorld> {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("supabase-admin-unavailable");
  return loadGmailCandidateWorld(client, internalEmailHashes);
}

export async function loadGmailIntakePersonDirectoryFromAdmin(): Promise<
  GmailIntakePersonDirectoryRow[]
> {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("supabase-admin-unavailable");
  return loadGmailIntakePersonDirectory(client);
}
