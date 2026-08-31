/**
 * Compose Person-scoped Project Books from canonical Client Memory.
 * Does not fetch Gmail, invent item kind, or merge sibling Projects.
 * Ordering: latest project-scoped visible note, else updatedAt, else createdAt,
 * descending; tie-break by projectId ascending.
 */

import { isHistoryVisibleNoteLifecycle, type ClientMemoryReadSnapshot } from "../read/types";
import { specFieldsFromHistory } from "../project-desk/status";
import type {
  PersonProjectBook,
  PersonProjectBookComposeOptions,
  PersonProjectBookHistoryEntry,
  PersonProjectBookPerson,
  PersonProjectBookStoredField,
} from "./types";
import { CLIENT_MEMORY_PROJECT_BOOK_NOTE_LIMIT } from "./types";
import { projectKindOf, type ProjectKind } from "../project-kind";

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

function linkedPeople(
  projectId: string,
  snapshot: ClientMemoryReadSnapshot,
): PersonProjectBookPerson[] {
  const ids: string[] = [];
  for (const row of snapshot.relationships) {
    if (row.kind !== "client-project" || row.status !== "active") continue;
    if (row.fromEntityId === projectId) ids.push(row.toEntityId);
    else if (row.toEntityId === projectId) ids.push(row.fromEntityId);
  }
  const unique = [...new Set(ids)];
  const people = unique.flatMap((personId) => {
    const person = snapshot.profiles.find((row) => row.personId === personId);
    const displayName = person?.displayName.trim();
    if (!displayName) return [];
    return [{ personId, displayName }];
  });
  return people.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" }),
  );
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function notesForProject(
  projectId: string,
  snapshot: ClientMemoryReadSnapshot,
): PersonProjectBookHistoryEntry[] {
  return snapshot.sourceNotes
    .filter(
      (row) =>
        row.projectId === projectId &&
        isHistoryVisibleNoteLifecycle(row.lifecycleStatus),
    )
    .sort((a, b) => {
      if (a.createdAt === b.createdAt) return b.id.localeCompare(a.id);
      return a.createdAt < b.createdAt ? 1 : -1;
    })
    .slice(0, CLIENT_MEMORY_PROJECT_BOOK_NOTE_LIMIT)
    .map((row) => ({
      id: row.id,
      projectId: row.projectId,
      sourceSystem: row.sourceSystem,
      noteText: row.noteText,
      createdAt: row.createdAt,
    }));
}

function storedSpecs(
  history: ClientMemoryReadSnapshot["projectHistories"][number] | null,
): PersonProjectBookStoredField[] {
  return specFieldsFromHistory(history).map((row) => ({
    fieldName: row.fieldName,
    label: row.label,
    value: row.value,
    plane: "stored",
  }));
}

function founderReviewRequired(
  projectId: string,
  storedOrder: string | null,
  recovered: PersonProjectBookComposeOptions["recoveredOrderConflicts"],
): boolean {
  const extras = recovered?.[projectId] ?? [];
  const stored = storedOrder?.trim() ?? "";
  return extras.some((value) => {
    const token = value.trim();
    return token.length > 0 && token !== stored;
  });
}

function sortBooks(books: PersonProjectBook[]): PersonProjectBook[] {
  return [...books].sort((a, b) => {
    const aKey = a.lastMeaningfulAt ?? a.updatedAt ?? a.createdAt;
    const bKey = b.lastMeaningfulAt ?? b.updatedAt ?? b.createdAt;
    if (aKey !== bKey) return aKey < bKey ? 1 : -1;
    return a.projectId.localeCompare(b.projectId);
  });
}

export function composePersonProjectBooks(
  snapshot: ClientMemoryReadSnapshot,
  personId: string,
  options: PersonProjectBookComposeOptions = {},
): PersonProjectBook[] {
  const trimmed = personId.trim();
  if (!trimmed) return [];
  const profile = snapshot.profiles.find((row) => row.personId === trimmed);
  if (!profile) return [];

  const projectIds = linkedProjectIds(trimmed, snapshot.relationships);
  const books: PersonProjectBook[] = projectIds.flatMap((projectId) => {
    const project = snapshot.projectProfiles.find(
      (row) => row.projectId === projectId,
    );
    if (!project) return [];
    const history =
      snapshot.projectHistories.find((row) => row.projectId === projectId) ??
      null;
    const people = linkedPeople(projectId, snapshot);
    const historyEntries = notesForProject(projectId, snapshot);
    const cadIdentifier = trimOrNull(history?.cadJobNumber);
    const storedOrderIdentifier = trimOrNull(history?.orderNumber);
    const fingerSize = trimOrNull(history?.fingerSize);
    const metal = trimOrNull(history?.metal);
    const centerStone = trimOrNull(history?.centerStone);
    const indexedEmailOnFile = Boolean(trimOrNull(history?.gmailThreadId));
    const lastNoteAt = historyEntries[0]?.createdAt ?? null;
    const lastMeaningfulAt =
      lastNoteAt ?? trimOrNull(project.updatedAt) ?? trimOrNull(project.createdAt);
    const specs = storedSpecs(history);
    const projectKind: ProjectKind | null = projectKindOf(project);
    const book: PersonProjectBook = {
      projectId: project.projectId,
      title: project.displayTitle,
      projectKind,
      cadIdentifier,
      storedOrderIdentifier,
      lastMeaningfulAt,
      sourceCount: historyEntries.length,
      indexedEmailOnFile,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      overview: {
        title: project.displayTitle,
        projectKind,
        cadIdentifier,
        storedOrderIdentifier,
        fingerSize,
        metal,
        centerStone,
        linkedPeople: people,
        indexedEmailOnFile,
      },
      itemsAndSpecs: {
        itemType: null,
        specs,
      },
      communication: {
        indexedEmailOnFile,
        sourceCount: historyEntries.length,
      },
      decisionsAndApprovals: [],
      cadDesign: {
        cadIdentifier,
      },
      artifacts: {
        connected: false,
        canonicalCount: 0,
      },
      commercial: {
        storedOrderIdentifier,
        founderReviewRequired: founderReviewRequired(
          projectId,
          storedOrderIdentifier,
          options.recoveredOrderConflicts,
        ),
      },
      history: historyEntries,
    };
    return [book];
  });

  return sortBooks(books);
}
