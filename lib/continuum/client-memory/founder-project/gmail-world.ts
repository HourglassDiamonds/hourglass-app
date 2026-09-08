/**
 * Canonical Continuum world for Gmail candidate association.
 * Profile email hashes are supporting evidence only.
 * Confirmed identity comes from founder mappings / source links, never display names.
 *
 * Person-world queries reuse the same Client Memory tables as People search.
 * One malformed Person/Project row is skipped. A missing history table or
 * Person-world outage does not invent identity.
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
import { normalizeEmail } from "../hashes";
import { projectKindFromUnknown } from "../project-kind";
import {
  CLIENT_MEMORY_SOURCE_SYSTEM,
  PERSON_ROLES,
  type EntityRelationship,
  type PersonProfile,
  type PersonRole,
  type ProjectHistory,
  type ProjectProfile,
} from "../types";

export const GMAIL_PERSON_PROFILES_TABLE = "continuum_person_profiles" as const;
export const GMAIL_PROJECT_PROFILES_TABLE = "continuum_project_profiles" as const;
export const GMAIL_PROJECT_HISTORY_TABLE = "continuum_project_history" as const;
export const GMAIL_RELATIONSHIPS_TABLE = "continuum_relationships" as const;

const EPOCH = "1970-01-01T00:00:00.000Z";

function asRoles(value: unknown): PersonRole[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is PersonRole =>
      typeof row === "string" && (PERSON_ROLES as readonly string[]).includes(row),
  );
}

function textOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function timestampOf(value: unknown): string {
  const text = textOrNull(value);
  return text || EPOCH;
}

export type GmailIntakePersonDirectoryRow = {
  personId: string;
  displayName: string;
  email: string | null;
};

export type GmailPersonWorldLoad = {
  world: GmailCandidateWorld;
  directory: GmailIntakePersonDirectoryRow[];
  peopleAvailable: boolean;
};

export function emptyGmailCandidateWorld(
  internalEmailHashes: readonly string[] = [],
): GmailCandidateWorld {
  return {
    people: [],
    projects: [],
    internalEmailHashes,
    confirmedParticipantMappings: [],
    confirmedSourceLinks: [],
    founderConfirmedEmailIdentities: [],
  };
}

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

function personProfileFromRow(row: Record<string, unknown>): PersonProfile | null {
  const personId = String(row.person_id ?? row.personId ?? "").trim();
  const displayName = String(row.display_name ?? row.displayName ?? "").trim();
  if (!personId || !displayName) return null;
  return {
    personId,
    displayName,
    givenName: textOrNull(row.given_name ?? row.givenName),
    familyName: textOrNull(row.family_name ?? row.familyName),
    organizationName: textOrNull(row.organization_name ?? row.organizationName),
    email: normalizeEmail(row.email == null ? null : String(row.email)),
    phone: textOrNull(row.phone),
    streetAddress: null,
    city: null,
    state: null,
    country: null,
    postalCode: null,
    roles: asRoles(row.roles),
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: timestampOf(row.created_at ?? row.createdAt),
    updatedAt: timestampOf(row.updated_at ?? row.updatedAt),
  };
}

function projectProfileFromRow(row: Record<string, unknown>): ProjectProfile | null {
  const projectId = String(row.project_id ?? row.projectId ?? "").trim();
  const displayTitle = String(row.display_title ?? row.displayTitle ?? "").trim();
  if (!projectId || !displayTitle) return null;
  return {
    projectId,
    displayTitle,
    visibility: "internal-only",
    importRowKey: null,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: timestampOf(row.created_at ?? row.createdAt),
    updatedAt: timestampOf(row.updated_at ?? row.updatedAt),
    projectKind: projectKindFromUnknown(row.project_kind ?? row.projectKind),
  };
}

function projectHistoryFromRow(row: Record<string, unknown>): ProjectHistory | null {
  const projectId = String(row.project_id ?? row.projectId ?? "").trim();
  if (!projectId) return null;
  return {
    projectId,
    cadJobNumber: textOrNull(row.cad_job_number ?? row.cadJobNumber),
    orderNumber: textOrNull(row.order_number ?? row.orderNumber),
    gmailThreadId: textOrNull(row.gmail_thread_id ?? row.gmailThreadId),
    matchJudgment: null,
    matchJudgmentRaw: null,
    fingerSize: textOrNull(row.finger_size ?? row.fingerSize),
    metal: textOrNull(row.metal),
    centerStone: textOrNull(row.center_stone ?? row.centerStone),
    diamondSupplyNotes: textOrNull(row.diamond_supply_notes ?? row.diamondSupplyNotes),
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: timestampOf(row.created_at ?? row.createdAt),
    updatedAt: timestampOf(row.updated_at ?? row.updatedAt),
  };
}

function relationshipFromRow(
  row: Record<string, unknown>,
  personIds: ReadonlySet<string>,
  projectIds: ReadonlySet<string>,
): EntityRelationship | null {
  const fromEntityId = String(row.from_entity_id ?? row.fromEntityId ?? "").trim();
  const toEntityId = String(row.to_entity_id ?? row.toEntityId ?? "").trim();
  if (!fromEntityId || !toEntityId || fromEntityId === toEntityId) return null;
  const personToProject =
    personIds.has(fromEntityId) && projectIds.has(toEntityId);
  const projectToPerson =
    projectIds.has(fromEntityId) && personIds.has(toEntityId);
  if (!personToProject && !projectToPerson) return null;
  const kind = row.kind === "client-project" ? "client-project" : null;
  const status = row.status === "active" || row.status == null ? "active" : null;
  if (kind !== "client-project" || status !== "active") return null;
  return {
    id: String(row.id ?? `${fromEntityId}-${toEntityId}`),
    fromEntityId,
    toEntityId,
    kind: "client-project",
    status: "active",
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: timestampOf(row.created_at ?? row.createdAt),
    createdBy: String(row.created_by ?? row.createdBy ?? "system"),
  };
}

export function intakeDirectoryFromPersonRows(
  people: readonly Record<string, unknown>[],
): GmailIntakePersonDirectoryRow[] {
  return people.flatMap((row) => {
    const profile = personProfileFromRow(row);
    if (!profile) return [];
    return [
      {
        personId: profile.personId,
        displayName: profile.displayName,
        email: profile.email,
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
  const people = input.people.flatMap((row) => {
    const profile = personProfileFromRow(row);
    return profile ? [profile] : [];
  });
  const projects = input.projects.flatMap((row) => {
    const profile = projectProfileFromRow(row);
    return profile ? [profile] : [];
  });
  const personIds = new Set(people.map((row) => row.personId));
  const projectIds = new Set(projects.map((row) => row.projectId));
  const histories = input.histories.flatMap((row) => {
    const history = projectHistoryFromRow(row);
    return history && projectIds.has(history.projectId) ? [history] : [];
  });
  const relationships = input.relationships.flatMap((row) => {
    const link = relationshipFromRow(row, personIds, projectIds);
    return link ? [link] : [];
  });
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

type QueryResult = {
  data: unknown[] | null;
  error: { message?: string; code?: string } | null;
};

async function readRows(
  query: PromiseLike<QueryResult>,
): Promise<{ rows: Record<string, unknown>[]; ok: boolean }> {
  try {
    const { data, error } = await query;
    if (error) return { rows: [], ok: false };
    const rows: Record<string, unknown>[] = [];
    for (const row of data ?? []) {
      if (row && typeof row === "object") rows.push(row as Record<string, unknown>);
    }
    return { rows, ok: true };
  } catch {
    return { rows: [], ok: false };
  }
}

export async function loadGmailPersonWorld(
  client: SupabaseClient,
  internalEmailHashes: readonly string[] = [],
): Promise<GmailPersonWorldLoad> {
  const [people, projects, histories, relationships, mappings, identities] =
    await Promise.all([
      readRows(
        client
          .from(GMAIL_PERSON_PROFILES_TABLE)
          .select(
            "person_id, display_name, given_name, family_name, organization_name, email, roles, created_at, updated_at",
          ),
      ),
      readRows(
        client
          .from(GMAIL_PROJECT_PROFILES_TABLE)
          .select("project_id, display_title, project_kind, created_at, updated_at"),
      ),
      readRows(
        client
          .from(GMAIL_PROJECT_HISTORY_TABLE)
          .select(
            "project_id, cad_job_number, order_number, gmail_thread_id, finger_size, metal, center_stone, diamond_supply_notes, created_at, updated_at",
          ),
      ),
      readRows(
        client
          .from(GMAIL_RELATIONSHIPS_TABLE)
          .select("id, from_entity_id, to_entity_id, kind, status, created_at, created_by")
          .eq("kind", "client-project")
          .eq("status", "active"),
      ),
      readRows(
        client.from("continuum_calendar_participant_mappings").select("email_hash, person_id"),
      ),
      readRows(
        client
          .from("continuum_external_identities")
          .select("entity_id, identity_kind, identifier, source_system, revoked_at")
          .eq("identity_kind", "email_hash")
          .eq("source_system", "concierge-manual")
          .is("revoked_at", null),
      ),
    ]);
  const world = candidateWorldFromRows({
    people: people.rows,
    projects: projects.ok ? projects.rows : [],
    histories: histories.ok ? histories.rows : [],
    relationships: relationships.ok ? relationships.rows : [],
    internalEmailHashes,
    confirmedParticipantMappings: mappings.ok ? mappings.rows : [],
    founderConfirmedEmailIdentities: identities.ok ? identities.rows : [],
  });
  return {
    world,
    directory: intakeDirectoryFromPersonRows(people.rows),
    peopleAvailable: people.ok,
  };
}

export async function loadGmailCandidateWorld(
  client: SupabaseClient,
  internalEmailHashes: readonly string[] = [],
): Promise<GmailCandidateWorld> {
  const loaded = await loadGmailPersonWorld(client, internalEmailHashes);
  return loaded.world;
}

export async function loadGmailIntakePersonDirectory(
  client: SupabaseClient,
): Promise<GmailIntakePersonDirectoryRow[]> {
  const loaded = await loadGmailPersonWorld(client);
  return loaded.directory;
}

export async function loadGmailPersonWorldFromAdmin(
  internalEmailHashes: readonly string[] = [],
): Promise<GmailPersonWorldLoad> {
  const client = getSupabaseAdmin();
  if (!client) {
    return {
      world: emptyGmailCandidateWorld(internalEmailHashes),
      directory: [],
      peopleAvailable: false,
    };
  }
  return loadGmailPersonWorld(client, internalEmailHashes);
}

export async function loadGmailCandidateWorldFromAdmin(
  internalEmailHashes: readonly string[] = [],
): Promise<GmailCandidateWorld> {
  const loaded = await loadGmailPersonWorldFromAdmin(internalEmailHashes);
  return loaded.world;
}

export async function loadGmailIntakePersonDirectoryFromAdmin(): Promise<
  GmailIntakePersonDirectoryRow[]
> {
  const loaded = await loadGmailPersonWorldFromAdmin();
  return loaded.directory;
}
