/**
 * Presentation-only thread → canonical Project association.
 * Does not mint Persons, merge Persons, or write associations.
 */

import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import {
  candidateText,
  confirmedPersonId,
  hasRule,
  isStudioOrVendorLabel,
  payloadOf,
  projectByThreadFromCandidates,
  sourceThreadId,
} from "@/lib/continuum/candidates/founder-attention";
import { coerceGmailThreadId } from "@/lib/continuum/client-memory/gmail";
import {
  extractCadJobIdentifiers,
  hasBoundedIdentifierToken,
  isStrongStructuredCadIdentifier,
} from "@/lib/continuum/gmail/cad-job-identifier";
import { identifierTokensMatch } from "@/lib/continuum/gmail/identifier-specificity";
import { isStrongStructuredOrderIdentifier } from "@/lib/continuum/gmail/order-identifier";
import { correlateExactProjectThread } from "@/lib/continuum/gmail/projects";
import type { CosProjectContext, CosProjectPerson } from "./types";

export const THREAD_ASSOCIATION_VIAS = [
  "explicit",
  "thread",
  "person",
  "identifier",
] as const;

export type ThreadAssociationVia = (typeof THREAD_ASSOCIATION_VIAS)[number];

export type SupportedThreadProject = {
  projectId: string;
  via: ThreadAssociationVia;
};

function evidenceHaystack(row: ContinuumCandidate): string {
  return `${candidateText(row)} ${row.evidenceBasis.matchedText ?? ""}`;
}

function threadHaystack(
  rows: readonly ContinuumCandidate[],
  threadId: string,
): string {
  return rows
    .filter((row) => sourceThreadId(row) === threadId)
    .map(evidenceHaystack)
    .join("\n");
}

function uniquePersonProjectIds(
  projects: ReadonlyMap<string, CosProjectContext>,
): Map<string, string> {
  const personToProjects = new Map<string, Set<string>>();
  for (const project of projects.values()) {
    for (const person of project.people ?? []) {
      if (isStudioOrVendorLabel(person.displayName)) continue;
      if (person.role === "vendor-contact") continue;
      const set = personToProjects.get(person.personId) ?? new Set();
      set.add(project.projectId);
      personToProjects.set(person.personId, set);
    }
  }
  const unique = new Map<string, string>();
  for (const [personId, ids] of personToProjects) {
    if (ids.size === 1) unique.set(personId, [...ids][0]!);
  }
  return unique;
}

const TYPED_CAD_RULE = "exact_cad_job";

function specValue(project: CosProjectContext, fieldName: string): string | null {
  const value = project.specs?.find((spec) => spec.fieldName === fieldName)?.value.trim() ?? "";
  return value || null;
}

function cadFamily(token: string): string | null {
  const match = token.trim().match(/^([A-Za-z]{2,})\d/);
  return match ? match[1]!.toUpperCase() : null;
}

function typedCadByThread(
  rows: readonly ContinuumCandidate[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const threadId = sourceThreadId(row);
    if (!threadId) continue;
    if (!hasRule(row, TYPED_CAD_RULE)) continue;
    const tokens = extractCadJobIdentifiers(evidenceHaystack(row)).filter(
      isStrongStructuredCadIdentifier,
    );
    if (tokens.length === 0) continue;
    const existing = map.get(threadId) ?? [];
    for (const token of tokens) {
      if (!existing.some((item) => identifierTokensMatch(item, token))) existing.push(token);
    }
    map.set(threadId, existing);
  }
  return map;
}

function storedStrongCads(projects: ReadonlyMap<string, CosProjectContext>): string[] {
  const tokens: string[] = [];
  for (const project of projects.values()) {
    const value = specValue(project, "cad_job_number");
    if (!value || !isStrongStructuredCadIdentifier(value)) continue;
    if (!tokens.some((item) => identifierTokensMatch(item, value))) tokens.push(value);
  }
  return tokens;
}

function emptyProductionThreadProjects(
  projects: ReadonlyMap<string, CosProjectContext>,
): string[] {
  const hits: string[] = [];
  for (const project of projects.values()) {
    if (!project.isCurrent) continue;
    if (project.lifecycleStage !== "production") continue;
    if (!project.gmailThreadId?.trim()) continue;
    const storedCad = specValue(project, "cad_job_number");
    const storedOrder = specValue(project, "order_number");
    if (storedCad || storedOrder) continue;
    hits.push(project.projectId);
  }
  return hits;
}

/**
 * A typed shop CAD that is not stored on any Project may inherit the unique
 * current Production Project that already has a canonical Gmail thread and
 * no stored CAD, but only when that CAD is the unique unmatched token in a
 * family already stored on some canonical Project. Fail closed otherwise.
 * Does not use display names.
 */
function unmatchedVendorCadProjectId(
  threadTokens: readonly string[],
  typedByThread: ReadonlyMap<string, string[]>,
  projects: ReadonlyMap<string, CosProjectContext>,
): string | null {
  if (threadTokens.length !== 1) return null;
  const token = threadTokens[0]!;
  const family = cadFamily(token);
  if (!family) return null;
  const stored = storedStrongCads(projects);
  if (stored.some((value) => identifierTokensMatch(value, token))) return null;
  if (!stored.some((value) => cadFamily(value) === family)) return null;
  const unmatched = new Set<string>();
  for (const tokens of typedByThread.values()) {
    for (const item of tokens) {
      if (cadFamily(item) !== family) continue;
      if (stored.some((value) => identifierTokensMatch(value, item))) continue;
      unmatched.add(item.toUpperCase());
    }
  }
  if (unmatched.size !== 1) return null;
  const projectsHit = emptyProductionThreadProjects(projects);
  return projectsHit.length === 1 ? projectsHit[0]! : null;
}

function identifierProjectIds(
  hay: string,
  projects: ReadonlyMap<string, CosProjectContext>,
): string[] {
  if (!hay.trim()) return [];
  const hits = new Set<string>();
  for (const project of projects.values()) {
    for (const spec of project.specs ?? []) {
      const value = spec.value.trim();
      if (!value) continue;
      if (spec.fieldName === "cad_job_number") {
        if (!isStrongStructuredCadIdentifier(value)) continue;
        if (hasBoundedIdentifierToken(hay, value)) hits.add(project.projectId);
        continue;
      }
      if (spec.fieldName === "order_number") {
        if (!isStrongStructuredOrderIdentifier(value)) continue;
        if (hasBoundedIdentifierToken(hay, value)) hits.add(project.projectId);
      }
    }
  }
  return [...hits];
}

function setUnique(
  map: Map<string, SupportedThreadProject>,
  threadId: string,
  projectIds: readonly string[],
  via: ThreadAssociationVia,
): void {
  if (map.has(threadId)) return;
  if (projectIds.length !== 1) return;
  map.set(threadId, { projectId: projectIds[0]!, via });
}

export function projectBySupportedAssociation(
  rows: readonly ContinuumCandidate[],
  projects: ReadonlyMap<string, CosProjectContext>,
): Map<string, SupportedThreadProject> {
  const map = new Map<string, SupportedThreadProject>();
  const explicit = projectByThreadFromCandidates(rows);
  for (const [threadId, projectId] of explicit) {
    map.set(threadId, { projectId, via: "explicit" });
  }

  const threadPointers = [...projects.values()].map((project) => ({
    projectId: project.projectId,
    gmailThreadId: project.gmailThreadId ?? null,
  }));
  const threadIds = new Set(
    rows.map(sourceThreadId).filter((id): id is string => Boolean(id)),
  );
  for (const threadId of threadIds) {
    if (map.has(threadId)) continue;
    const coerced = coerceGmailThreadId(threadId);
    if (coerced.status !== "canonical") continue;
    const match = correlateExactProjectThread(coerced.value, threadPointers);
    if (match.status !== "exact") continue;
    setUnique(map, threadId, match.projectIds, "thread");
  }

  const uniquePersonProject = uniquePersonProjectIds(projects);
  const threadPersons = new Map<string, Set<string>>();
  for (const row of rows) {
    const threadId = sourceThreadId(row);
    const personId = confirmedPersonId(row);
    if (!threadId || !personId) continue;
    const set = threadPersons.get(threadId) ?? new Set();
    set.add(personId);
    threadPersons.set(threadId, set);
  }
  for (const [threadId, persons] of threadPersons) {
    if (map.has(threadId)) continue;
    if (persons.size !== 1) continue;
    const projectId = uniquePersonProject.get([...persons][0]!);
    if (projectId) map.set(threadId, { projectId, via: "person" });
  }

  for (const threadId of threadIds) {
    if (map.has(threadId)) continue;
    const ids = identifierProjectIds(threadHaystack(rows, threadId), projects);
    setUnique(map, threadId, ids, "identifier");
  }

  const typedCad = typedCadByThread(rows);
  for (const threadId of threadIds) {
    if (map.has(threadId)) continue;
    const projectId = unmatchedVendorCadProjectId(
      typedCad.get(threadId) ?? [],
      typedCad,
      projects,
    );
    if (projectId) map.set(threadId, { projectId, via: "identifier" });
  }

  return map;
}

export function projectIdsByThread(
  association: ReadonlyMap<string, SupportedThreadProject>,
): Map<string, string> {
  return new Map(
    [...association].map(([threadId, row]) => [threadId, row.projectId]),
  );
}

export function vendorSourcedThread(
  association: ReadonlyMap<string, SupportedThreadProject>,
  rows: readonly ContinuumCandidate[],
): boolean {
  return rows.some((row) => {
    const threadId = sourceThreadId(row);
    if (!threadId) return false;
    const via = association.get(threadId)?.via;
    return via === "thread" || via === "identifier";
  });
}

export function pickClientPerson(
  project: CosProjectContext | null,
): CosProjectPerson | null {
  if (!project) return null;
  const pool = (project.people ?? []).filter((person) => {
    if (isStudioOrVendorLabel(person.displayName)) return false;
    if (person.role === "vendor-contact") return false;
    return true;
  });
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0] ?? null;
  const title = new Set(
    project.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4),
  );
  const matched = pool.filter((person) =>
    person.displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .some((token) => token.length >= 4 && title.has(token)),
  );
  if (matched.length === 1) return matched[0] ?? null;
  return null;
}

function personNameById(
  personId: string,
  projects: ReadonlyMap<string, CosProjectContext>,
): string | null {
  for (const project of projects.values()) {
    const match = project.people?.find((row) => row.personId === personId);
    if (match && !isStudioOrVendorLabel(match.displayName)) return match.displayName;
  }
  return null;
}

function personNameFromAssociation(
  evidence: readonly ContinuumCandidate[],
  personId: string,
): string | null {
  for (const row of evidence) {
    if (confirmedPersonId(row) !== personId) continue;
    const payload = payloadOf(row);
    if (payload.kind === "person_association") {
      const name = payload.displayName?.trim() ?? "";
      if (name && !isStudioOrVendorLabel(name)) return name;
    }
  }
  return null;
}

export function resolveProjectAttribution(
  evidence: readonly ContinuumCandidate[],
  projectId: string | null,
  projects: ReadonlyMap<string, CosProjectContext>,
): {
  projectId: string | null;
  projectTitle: string | null;
  personName: string | null;
} {
  const project = projectId ? (projects.get(projectId) ?? null) : null;
  const client = pickClientPerson(project);
  let personName = client?.displayName ?? null;
  if (!personName) {
    const personIds = [
      ...new Set(evidence.map(confirmedPersonId).filter((id): id is string => Boolean(id))),
    ];
    if (personIds.length === 1) {
      personName =
        personNameById(personIds[0]!, projects) ??
        personNameFromAssociation(evidence, personIds[0]!);
    }
  }
  if (personName && isStudioOrVendorLabel(personName)) personName = null;
  return {
    projectId,
    projectTitle: project?.title ?? (projectId ? "Project" : null),
    personName,
  };
}
