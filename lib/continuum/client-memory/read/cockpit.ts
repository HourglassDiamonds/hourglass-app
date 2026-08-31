/**
 * Bounded Person memory cockpit + History/Sources read models.
 * Does not mutate. Does not invent project lifecycle.
 */

import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import { PERSON_FACT_TYPE_BIRTHDAY } from "../facts/types";
import { composePersonProjectBooks } from "../project-books/compose";
import { relationshipLabel } from "./presentation";
import {
  CLIENT_MEMORY_COCKPIT_NOTE_LIMIT,
  CLIENT_MEMORY_HISTORY_PAGE_SIZE,
  CLIENT_MEMORY_PROJECT_PREVIEW_LIMIT,
  isActiveWishStatus,
  isCockpitVisibleNote,
  isHistoryVisibleNoteLifecycle,
  type ClientMemoryReadSnapshot,
  type PersonCockpit,
  type PersonCockpitProject,
  type PersonCockpitRelationship,
  type PersonCockpitResult,
  type PersonSourceHistory,
  type PersonSourceHistoryQuery,
  type PersonSourceHistoryResult,
  type ProjectHistorySummary,
  type SourceNoteSummary,
  type WishSummary,
} from "./types";

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
  return [...new Set(ids)];
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

function toNoteSummary(
  note: ClientMemoryReadSnapshot["sourceNotes"][number],
): SourceNoteSummary {
  return {
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
  };
}

function sortNotesNewestFirst(
  notes: ClientMemoryReadSnapshot["sourceNotes"],
): ClientMemoryReadSnapshot["sourceNotes"] {
  return [...notes].sort((a, b) => {
    if (a.createdAt === b.createdAt) return b.id.localeCompare(a.id);
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

function personNotes(
  snapshot: ClientMemoryReadSnapshot,
  personId: string,
): ClientMemoryReadSnapshot["sourceNotes"] {
  return snapshot.sourceNotes.filter((row) => row.personId === personId);
}

function histogramOpenReviews(
  snapshot: ClientMemoryReadSnapshot,
  personId: string,
  projectIds: string[],
): number {
  const importKeys = new Set(
    snapshot.identities
      .filter(
        (row) =>
          row.entityId === personId &&
          row.identityKind === "import_row_key" &&
          row.revokedAt == null,
      )
      .map((row) => row.identifier),
  );
  for (const profile of snapshot.projectProfiles) {
    if (!projectIds.includes(profile.projectId)) continue;
    if (profile.importRowKey) importKeys.add(profile.importRowKey);
  }
  return snapshot.reviews.filter((row) => {
    if (row.status !== "open") return false;
    if (row.leftPersonId === personId || row.rightPersonId === personId) {
      return true;
    }
    return Boolean(row.importRowKey && importKeys.has(row.importRowKey));
  }).length;
}

function cockpitRelationships(
  snapshot: ClientMemoryReadSnapshot,
  personId: string,
): PersonCockpitRelationship[] {
  const names = new Map(
    snapshot.profiles.map((row) => [row.personId, row.displayName]),
  );
  const rows: PersonCockpitRelationship[] = [];
  for (const row of snapshot.relationships) {
    if (row.status !== "active") continue;
    if (row.kind === "client-project") continue;
    const kindLabel = relationshipLabel(row.kind);
    if (kindLabel == null) continue;
    const counterpartId =
      row.fromEntityId === personId ? row.toEntityId : row.fromEntityId;
    if (counterpartId === personId) continue;
    const counterpartName = names.get(counterpartId)?.trim();
    if (!counterpartName) continue;
    rows.push({
      id: row.id,
      kind: row.kind as PersonCockpitRelationship["kind"],
      status: row.status,
      counterpartPersonId: counterpartId,
      counterpartName,
    });
  }
  return rows.sort((a, b) =>
    a.counterpartName.localeCompare(b.counterpartName, "en", {
      sensitivity: "base",
    }),
  );
}

function cockpitProjects(
  snapshot: ClientMemoryReadSnapshot,
  projectIds: string[],
): PersonCockpitProject[] {
  const projects: PersonCockpitProject[] = projectIds.flatMap((projectId) => {
    const project = snapshot.projectProfiles.find(
      (row) => row.projectId === projectId,
    );
    if (!project) return [];
    const history = snapshot.projectHistories.find(
      (row) => row.projectId === projectId,
    );
    return [
      {
        profile: {
          projectId: project.projectId,
          displayTitle: project.displayTitle,
          visibility: project.visibility,
          projectKind: project.projectKind ?? null,
        },
        internalHistory: history ? toHistorySummary(history) : null,
        sourceSystem: project.sourceSystem,
        imported: project.sourceSystem === CLIENT_MEMORY_SOURCE_SYSTEM,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ];
  });
  return projects.sort((a, b) => {
    if (a.imported !== b.imported) return a.imported ? 1 : -1;
    if (a.updatedAt === b.updatedAt) {
      return a.profile.displayTitle.localeCompare(b.profile.displayTitle, "en", {
        sensitivity: "base",
      });
    }
    return a.updatedAt < b.updatedAt ? 1 : -1;
  });
}

export function partitionCockpitProjects(projects: PersonCockpitProject[]): {
  preview: PersonCockpitProject[];
  remaining: PersonCockpitProject[];
} {
  if (projects.length <= CLIENT_MEMORY_PROJECT_PREVIEW_LIMIT) {
    return { preview: projects, remaining: [] };
  }
  return {
    preview: projects.slice(0, CLIENT_MEMORY_PROJECT_PREVIEW_LIMIT),
    remaining: projects.slice(CLIENT_MEMORY_PROJECT_PREVIEW_LIMIT),
  };
}

export function composePersonCockpit(
  snapshot: ClientMemoryReadSnapshot,
  personId: string,
  counts?: { noteCount?: number },
): PersonCockpitResult {
  const trimmed = personId.trim();
  if (!trimmed) return { ok: false, reason: "not-found" };
  const profile = snapshot.profiles.find((row) => row.personId === trimmed);
  if (!profile) return { ok: false, reason: "not-found" };

  const relationships = snapshot.relationships.filter(
    (row) => row.fromEntityId === trimmed || row.toEntityId === trimmed,
  );
  const facts = snapshot.facts.filter((row) => row.personId === trimmed);
  const current = facts.filter((row) => row.status === "current");
  const birthday =
    current.find((row) => row.factType === PERSON_FACT_TYPE_BIRTHDAY) ?? null;
  const personalFacts = current.filter(
    (row) => row.factType !== PERSON_FACT_TYPE_BIRTHDAY,
  );
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
  const ownedNotes = personNotes(snapshot, trimmed);
  const historyNotes = ownedNotes.filter((row) =>
    isHistoryVisibleNoteLifecycle(row.lifecycleStatus),
  );
  const recentManualNotes = sortNotesNewestFirst(
    ownedNotes.filter(isCockpitVisibleNote),
  )
    .slice(0, CLIENT_MEMORY_COCKPIT_NOTE_LIMIT)
    .map(toNoteSummary);

  const extraRoles = profile.roles.filter((role) => role !== "client");
  const composed: PersonCockpit = {
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
    birthday,
    personalFacts,
    work: {
      organizationName: profile.organizationName,
      roles: extraRoles,
    },
    relationships: cockpitRelationships(
      { ...snapshot, relationships },
      trimmed,
    ),
    projects: cockpitProjects(snapshot, projectIds),
    projectBooks: composePersonProjectBooks(snapshot, trimmed),
    wishes,
    recentManualNotes,
    reviews: {
      openCount: histogramOpenReviews(snapshot, trimmed, projectIds),
      candidateCount: facts.filter((row) => row.status === "candidate").length,
      conflictingCount: facts.filter((row) => row.status === "conflicting")
        .length,
    },
    history: {
      noteCount: counts?.noteCount ?? historyNotes.length,
    },
  };

  return { ok: true, cockpit: composed };
}

export function listPersonSourceHistoryFromSnapshot(
  snapshot: ClientMemoryReadSnapshot,
  personId: string,
  query: PersonSourceHistoryQuery = {},
): PersonSourceHistoryResult {
  const trimmed = personId.trim();
  if (!trimmed) return { ok: false, reason: "not-found" };
  const profile = snapshot.profiles.find((row) => row.personId === trimmed);
  if (!profile) return { ok: false, reason: "not-found" };

  const pageSize =
    query.pageSize && query.pageSize > 0
      ? Math.min(query.pageSize, CLIENT_MEMORY_HISTORY_PAGE_SIZE)
      : CLIENT_MEMORY_HISTORY_PAGE_SIZE;
  const page = query.page && query.page > 0 ? query.page : 1;
  const sourceSystem = query.sourceSystem?.trim() || null;
  const lifecycle = query.lifecycle === "trashed" ? "trashed" : null;

  const filtered = sortNotesNewestFirst(
    personNotes(snapshot, trimmed).filter((row) => {
      if (sourceSystem && row.sourceSystem !== sourceSystem) return false;
      if (lifecycle === "trashed") return row.lifecycleStatus === "trashed";
      return isHistoryVisibleNoteLifecycle(row.lifecycleStatus);
    }),
  );
  const start = (page - 1) * pageSize;
  const pageNotes = filtered.slice(start, start + pageSize).map(toNoteSummary);
  const history: PersonSourceHistory = {
    personId: trimmed,
    displayName: profile.displayName,
    notes: pageNotes,
    projectTitles: Object.fromEntries(
      snapshot.projectProfiles
        .filter((row) =>
          pageNotes.some((note) => note.projectId === row.projectId),
        )
        .map((row) => [row.projectId, row.displayTitle]),
    ),
    total: filtered.length,
    page,
    pageSize,
    sourceSystem,
    lifecycle,
  };
  return { ok: true, history };
}
