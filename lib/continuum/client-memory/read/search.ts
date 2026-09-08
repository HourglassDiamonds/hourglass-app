/**
 * Deterministic Client Memory search ranking.
 * No embeddings, LLM, or Levenshtein matching.
 */

import { normalizeEmail, normalizePhone } from "../hashes";
import {
  CLIENT_MEMORY_SEARCH_LIMIT,
  type ClientMemoryReadSnapshot,
  type ClientSearchResult,
} from "./types";
import { personRelationshipContext } from "./relationship-context";

export const SEARCH_RANK = {
  exactEmail: 0,
  exactPhone: 1,
  exactDisplayName: 2,
  displayNamePrefix: 3,
  displayNameContains: 4,
  organizationContains: 5,
} as const;

type SearchableProfile = ClientMemoryReadSnapshot["profiles"][number];

function fold(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function linkedProjectCounts(
  relationships: ClientMemoryReadSnapshot["relationships"],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of relationships) {
    if (row.kind !== "client-project" || row.status !== "active") continue;
    counts.set(row.fromEntityId, (counts.get(row.fromEntityId) ?? 0) + 1);
  }
  return counts;
}

function linkedProjectsByPerson(
  relationships: ClientMemoryReadSnapshot["relationships"],
  projectProfiles: ClientMemoryReadSnapshot["projectProfiles"] | undefined,
): Map<string, Array<{ title: string; projectKind: ClientMemoryReadSnapshot["projectProfiles"][number]["projectKind"] }>> {
  const profiles = new Map(
    (projectProfiles ?? []).map((row) => [row.projectId, row]),
  );
  const byPerson = new Map<
    string,
    Array<{ title: string; projectKind: ClientMemoryReadSnapshot["projectProfiles"][number]["projectKind"] }>
  >();
  for (const row of relationships) {
    if (row.kind !== "client-project" || row.status !== "active") continue;
    const profile = profiles.get(row.toEntityId) ?? profiles.get(row.fromEntityId);
    if (!profile) continue;
    const personId = profiles.has(row.toEntityId) ? row.fromEntityId : row.toEntityId;
    const list = byPerson.get(personId) ?? [];
    list.push({
      title: profile.displayTitle,
      projectKind: profile.projectKind ?? null,
    });
    byPerson.set(personId, list);
  }
  return byPerson;
}

function nameRank(profile: SearchableProfile, queryFolded: string): number | null {
  const display = fold(profile.displayName);
  const given = fold(profile.givenName);
  const family = fold(profile.familyName);
  if (!queryFolded) return null;
  if (display === queryFolded) return SEARCH_RANK.exactDisplayName;
  if (display.startsWith(queryFolded) || given.startsWith(queryFolded) || family.startsWith(queryFolded)) {
    return SEARCH_RANK.displayNamePrefix;
  }
  if (
    display.includes(queryFolded) ||
    given.includes(queryFolded) ||
    family.includes(queryFolded)
  ) {
    return SEARCH_RANK.displayNameContains;
  }
  return null;
}

function organizationRank(
  profile: SearchableProfile,
  queryFolded: string,
): number | null {
  const organization = fold(profile.organizationName);
  if (queryFolded && organization.includes(queryFolded)) {
    return SEARCH_RANK.organizationContains;
  }
  return null;
}

export function rankSearchHit(
  profile: SearchableProfile,
  query: string,
): number | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const queryFolded = fold(trimmed);
  const emailQuery = normalizeEmail(trimmed);
  const phoneQuery = normalizePhone(trimmed);

  const ranks: number[] = [];
  if (emailQuery && normalizeEmail(profile.email) === emailQuery) {
    ranks.push(SEARCH_RANK.exactEmail);
  }
  if (phoneQuery && normalizePhone(profile.phone) === phoneQuery) {
    ranks.push(SEARCH_RANK.exactPhone);
  }
  const name = nameRank(profile, queryFolded);
  if (name != null) ranks.push(name);
  const organization = organizationRank(profile, queryFolded);
  if (organization != null) ranks.push(organization);

  if (ranks.length === 0) return null;
  return Math.min(...ranks);
}

export function searchPeopleFromSnapshot(
  snapshot: Pick<ClientMemoryReadSnapshot, "profiles" | "relationships"> & {
    projectProfiles?: ClientMemoryReadSnapshot["projectProfiles"];
  },
  query: string,
  limit = CLIENT_MEMORY_SEARCH_LIMIT,
): ClientSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const capped = Math.min(Math.max(1, limit), CLIENT_MEMORY_SEARCH_LIMIT);
  const projectCounts = linkedProjectCounts(snapshot.relationships);
  const linked = linkedProjectsByPerson(
    snapshot.relationships,
    snapshot.projectProfiles,
  );
  const ranked = snapshot.profiles
    .map((profile) => {
      const rank = rankSearchHit(profile, trimmed);
      if (rank == null) return null;
      return { profile, rank };
    })
    .filter((row): row is { profile: SearchableProfile; rank: number } => row != null)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const name = a.profile.displayName.localeCompare(b.profile.displayName);
      if (name !== 0) return name;
      return a.profile.personId.localeCompare(b.profile.personId);
    })
    .slice(0, capped);

  return ranked.map(({ profile }) => {
    const projects = linked.get(profile.personId) ?? [];
    return {
      personId: profile.personId,
      displayName: profile.displayName,
      organizationName: profile.organizationName,
      email: profile.email,
      phone: profile.phone,
      roles: profile.roles,
      linkedProjectCount: projectCounts.get(profile.personId) ?? 0,
      relationshipContext: personRelationshipContext({
        roles: profile.roles,
        projects: projects.map((row) => ({
          title: row.title,
          projectKind: row.projectKind ?? null,
        })),
      }),
    };
  });
}
