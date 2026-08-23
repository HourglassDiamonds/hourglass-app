/**
 * Compose a Concierge Person profile from canonical Client Memory rows.
 * Does not infer spouse/family. Does not mutate.
 */

import {
  CLIENT_MEMORY_NOTE_LIMIT,
  isActiveWishStatus,
  type ClientMemoryReadSnapshot,
  type ClientRelationshipSummary,
  type ConciergePersonProfile,
  type ConciergePersonProfileResult,
  type IdentityReviewSummary,
  type LinkedProjectRead,
  type ProjectHistorySummary,
  type SourceNoteSummary,
  type WishSummary,
} from "./types";

function histogram(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const value of values) {
    out[value] = (out[value] ?? 0) + 1;
  }
  return out;
}

function linkedProjectIds(
  personId: string,
  relationships: ClientMemoryReadSnapshot["relationships"],
): string[] {
  const ids: string[] = [];
  for (const row of relationships) {
    if (row.kind !== "client-project" || row.status !== "active") continue;
    if (row.fromEntityId === personId) ids.push(row.toEntityId);
    else if (row.toEntityId === personId) ids.push(row.fromEntityId);
  }
  return ids;
}

function personImportRowKeys(
  personId: string,
  identities: ClientMemoryReadSnapshot["identities"],
): string[] {
  return identities
    .filter(
      (row) =>
        row.entityId === personId &&
        row.identityKind === "import_row_key" &&
        row.revokedAt == null,
    )
    .map((row) => row.identifier);
}

function reviewsForPerson(input: {
  personId: string;
  snapshot: ClientMemoryReadSnapshot;
  projectIds: string[];
}): ClientMemoryReadSnapshot["reviews"] {
  const importKeys = new Set(personImportRowKeys(input.personId, input.snapshot.identities));
  for (const profile of input.snapshot.projectProfiles) {
    if (!input.projectIds.includes(profile.projectId)) continue;
    if (profile.importRowKey) importKeys.add(profile.importRowKey);
  }
  return input.snapshot.reviews.filter((row) => {
    if (row.leftPersonId === input.personId || row.rightPersonId === input.personId) {
      return true;
    }
    return Boolean(row.importRowKey && importKeys.has(row.importRowKey));
  });
}

function toHistorySummary(
  history: ClientMemoryReadSnapshot["projectHistories"][number],
): ProjectHistorySummary {
  return {
    cadJobNumber: history.cadJobNumber,
    orderNumber: history.orderNumber,
    gmailThreadId: history.gmailThreadId,
    matchJudgment: history.matchJudgment,
    fingerSize: history.fingerSize,
    metal: history.metal,
    centerStone: history.centerStone,
    diamondSupplyNotes: history.diamondSupplyNotes,
  };
}

function toNoteSummary(note: ClientMemoryReadSnapshot["sourceNotes"][number]): SourceNoteSummary {
  return {
    id: note.id,
    projectId: note.projectId,
    sourceSystem: note.sourceSystem,
    sourceArtifact: note.sourceArtifact,
    sourceSheet: note.sourceSheet,
    sourceField: note.sourceField,
    gmailThreadId: note.gmailThreadId,
    noteText: note.noteText,
    createdAt: note.createdAt,
  };
}

export function composePersonProfile(
  snapshot: ClientMemoryReadSnapshot,
  personId: string,
): ConciergePersonProfileResult {
  const trimmed = personId.trim();
  if (!trimmed) return { ok: false, reason: "not-found" };
  const profile = snapshot.profiles.find((row) => row.personId === trimmed);
  if (!profile) return { ok: false, reason: "not-found" };

  const relationships = snapshot.relationships.filter(
    (row) => row.fromEntityId === trimmed || row.toEntityId === trimmed,
  );
  const relationshipSummaries: ClientRelationshipSummary[] = relationships.map((row) => ({
    id: row.id,
    fromEntityId: row.fromEntityId,
    toEntityId: row.toEntityId,
    kind: row.kind,
    status: row.status,
    createdAt: row.createdAt,
  }));

  const facts = snapshot.facts.filter((row) => row.personId === trimmed);
  const current = facts.filter((row) => row.status === "current");
  const candidateCount = facts.filter((row) => row.status === "candidate").length;
  const conflictingCount = facts.filter((row) => row.status === "conflicting").length;

  const wishes: WishSummary[] = snapshot.wishes
    .filter((row) => row.personId === trimmed && isActiveWishStatus(row.status))
    .map((row) => ({
      id: row.id,
      description: row.description,
      category: row.category,
      status: row.status,
      visibility: row.visibility,
      createdAt: row.createdAt,
    }));

  const projectIds = linkedProjectIds(trimmed, relationships);
  const projects: LinkedProjectRead[] = projectIds.flatMap((projectId) => {
    const project = snapshot.projectProfiles.find((row) => row.projectId === projectId);
    if (!project) return [];
    const history = snapshot.projectHistories.find((row) => row.projectId === projectId);
    return [
      {
        profile: {
          projectId: project.projectId,
          displayTitle: project.displayTitle,
          visibility: project.visibility,
        },
        internalHistory: history ? toHistorySummary(history) : null,
      },
    ];
  });

  const sourceNotes: SourceNoteSummary[] = snapshot.sourceNotes
    .filter(
      (row) =>
        row.personId === trimmed ||
        (row.projectId != null && projectIds.includes(row.projectId)),
    )
    .sort((a, b) => {
      if (a.createdAt === b.createdAt) return b.id.localeCompare(a.id);
      return a.createdAt < b.createdAt ? 1 : -1;
    })
    .slice(0, CLIENT_MEMORY_NOTE_LIMIT)
    .map(toNoteSummary);

  const personReviews = reviewsForPerson({
    personId: trimmed,
    snapshot,
    projectIds,
  });
  const openReviews = personReviews.filter((row) => row.status === "open");

  const composed: ConciergePersonProfile = {
    person: {
      id: profile.personId,
      displayName: profile.displayName,
      givenName: profile.givenName,
      familyName: profile.familyName,
      organizationName: profile.organizationName,
      email: profile.email,
      phone: profile.phone,
      streetAddress: profile.streetAddress,
      city: profile.city,
      state: profile.state,
      country: profile.country,
      postalCode: profile.postalCode,
      roles: profile.roles,
    },
    relationships: relationshipSummaries,
    facts: {
      current,
      candidateCount,
      conflictingCount,
    },
    wishes,
    projects,
    sourceNotes,
    reviews: {
      openCount: openReviews.length,
      reasonHistogram: histogram(openReviews.map((row) => row.reasonCode)),
    },
  };

  return { ok: true, profile: composed };
}

export function listOpenReviewsForPerson(
  snapshot: ClientMemoryReadSnapshot,
  personId: string,
): IdentityReviewSummary[] {
  const result = composePersonProfile(snapshot, personId);
  if (!result.ok) return [];
  const projectIds = result.profile.projects.map((row) => row.profile.projectId);
  return reviewsForPerson({ personId: personId.trim(), snapshot, projectIds })
    .filter((row) => row.status === "open")
    .map((row) => ({
      id: row.id,
      status: row.status,
      reasonCode: row.reasonCode,
      importRowKey: row.importRowKey,
      createdAt: row.createdAt,
    }));
}
