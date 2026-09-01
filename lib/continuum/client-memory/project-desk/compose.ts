/**
 * Compose Project Desk list and detail read models from canonical Client Memory.
 * Does not infer Open Jobs, Gmail state, artifacts, or project lifecycle.
 */

import {
  CLIENT_MEMORY_NOTE_LIMIT,
  isHistoryVisibleNoteLifecycle,
} from "../read/types";
import type { ProjectHistoryRevision } from "../types";
import {
  PROJECT_DESK_NOTE_LIMIT,
  type ListProjectsFilter,
  type ProjectDeskGetResult,
  type ProjectDeskNote,
  type ProjectDeskPerson,
  type ProjectDeskRead,
  type ProjectDeskSnapshot,
  type ProjectDeskSummary,
} from "./types";
import {
  notePreview,
  projectCoverage,
  sliceAOperationalStatus,
  specFieldsFromHistory,
} from "./status";
import { projectKindOf } from "../project-kind";
import {
  activeOperatingLayer,
  customDetailsByProjectId,
  repairDetailsByProjectId,
} from "../project-operating/layer";
import {
  activeLifecycleView,
  lifecycleStatesByProjectId,
} from "../project-lifecycle/view";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function linkedPeople(
  projectId: string,
  snapshot: ProjectDeskSnapshot,
): ProjectDeskPerson[] {
  const ids: string[] = [];
  for (const row of snapshot.relationships) {
    if (row.kind !== "client-project" || row.status !== "active") continue;
    if (row.fromEntityId === projectId) ids.push(row.toEntityId);
    else if (row.toEntityId === projectId) ids.push(row.fromEntityId);
  }
  const unique = [...new Set(ids)];
  const people = unique.flatMap((personId) => {
    const person = snapshot.people.find((row) => row.personId === personId);
    if (!person) return [];
    return [{ personId: person.personId, displayName: person.displayName }];
  });
  return people.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" }),
  );
}

function notesForProject(
  projectId: string,
  snapshot: ProjectDeskSnapshot,
): ProjectDeskNote[] {
  const peopleById = new Map(
    snapshot.people.map((row) => [row.personId, row.displayName]),
  );
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
    .slice(0, PROJECT_DESK_NOTE_LIMIT)
    .map((row) => ({
      id: row.id,
      personId: row.personId,
      personName:
        row.personId && peopleById.has(row.personId)
          ? (peopleById.get(row.personId) ?? null)
          : null,
      contextLayer: row.contextLayer,
      sourceSystem: row.sourceSystem,
      sourceArtifact: row.sourceArtifact,
      sourceSheet: row.sourceSheet,
      sourceField: row.sourceField,
      noteText: row.noteText,
      createdAt: row.createdAt,
    }));
}

function specCorrectionsForProject(
  projectId: string,
  snapshot: ProjectDeskSnapshot,
): ProjectHistoryRevision[] {
  return (snapshot.specRevisions ?? [])
    .filter((row) => row.projectId === projectId)
    .sort((a, b) => {
      if (a.changedAt === b.changedAt) return b.id.localeCompare(a.id);
      return a.changedAt < b.changedAt ? 1 : -1;
    });
}

function composeSummary(
  snapshot: ProjectDeskSnapshot,
  profile: ProjectDeskSnapshot["projectProfiles"][number],
): ProjectDeskSummary {
  const people = linkedPeople(profile.projectId, snapshot);
  const history =
    snapshot.projectHistories.find((row) => row.projectId === profile.projectId) ??
    null;
  const specs = specFieldsFromHistory(history);
  const notes = notesForProject(profile.projectId, snapshot);
  const latest = notes[0] ?? null;
  return {
    projectId: profile.projectId,
    title: profile.displayTitle,
    projectKind: projectKindOf(profile),
    people,
    latestNoteAt: latest?.createdAt ?? null,
    latestNotePreview: latest ? notePreview(latest.noteText) : null,
    coverage: projectCoverage({
      peopleCount: people.length,
      specCount: specs.length,
      noteCount: notes.length,
    }),
    recordCreatedAt: profile.createdAt,
  };
}

function sortSummaries(rows: ProjectDeskSummary[]): ProjectDeskSummary[] {
  return [...rows].sort((a, b) => {
    const aKey = a.latestNoteAt ?? a.recordCreatedAt;
    const bKey = b.latestNoteAt ?? b.recordCreatedAt;
    if (aKey === bKey) return a.title.localeCompare(b.title, "en", { sensitivity: "base" });
    return aKey < bKey ? 1 : -1;
  });
}

export function listProjectsFromSnapshot(
  snapshot: ProjectDeskSnapshot,
  filter: ListProjectsFilter = {},
): ProjectDeskSummary[] {
  const rows = snapshot.projectProfiles.map((profile) =>
    composeSummary(snapshot, profile),
  );
  const sorted = sortSummaries(rows);
  if (filter.limit != null && filter.limit >= 0) {
    return sorted.slice(0, filter.limit);
  }
  return sorted;
}

export function getProjectDeskFromSnapshot(
  snapshot: ProjectDeskSnapshot,
  projectId: string,
): ProjectDeskGetResult {
  const trimmed = projectId.trim();
  if (!trimmed || !UUID_RE.test(trimmed)) return { ok: false, reason: "not-found" };
  const profile = snapshot.projectProfiles.find((row) => row.projectId === trimmed);
  if (!profile) return { ok: false, reason: "not-found" };

  const summary = composeSummary(snapshot, profile);
  const history =
    snapshot.projectHistories.find((row) => row.projectId === trimmed) ?? null;
  const notes = notesForProject(trimmed, snapshot).slice(0, CLIENT_MEMORY_NOTE_LIMIT);
  const customById = customDetailsByProjectId(snapshot.customDetails);
  const repairById = repairDetailsByProjectId(snapshot.repairDetails);
  const lifecycleById = lifecycleStatesByProjectId(snapshot.lifecycleStates);
  const desk: ProjectDeskRead = {
    projectId: summary.projectId,
    title: summary.title,
    projectKind: summary.projectKind,
    recordCreatedAt: summary.recordCreatedAt,
    people: summary.people,
    specs: specFieldsFromHistory(history),
    specCorrections: specCorrectionsForProject(trimmed, snapshot),
    notes,
    latestNoteAt: summary.latestNoteAt,
    latestNotePreview: summary.latestNotePreview,
    coverage: summary.coverage,
    operationalStatus: sliceAOperationalStatus(),
    operatingLayer: activeOperatingLayer({
      projectKind: summary.projectKind,
      customDetails: customById.get(trimmed) ?? null,
      repairDetails: repairById.get(trimmed) ?? null,
    }),
    lifecycle: activeLifecycleView({
      projectKind: summary.projectKind,
      states: lifecycleById.get(trimmed) ?? [],
      events: (snapshot.lifecycleEvents ?? []).filter(
        (row) => row.projectId === trimmed,
      ),
    }),
    openJobs: { connected: false },
    artifacts: { connected: false },
  };
  return { ok: true, desk };
}
