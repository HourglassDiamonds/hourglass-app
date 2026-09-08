/**
 * Deterministic Gmail commercial-work → canonical Project linkage.
 * Uses stored thread provenance, approved Candidate targets, or unique
 * person + exact created title. Never title similarity / fuzzy matching.
 */

import {
  effectiveCandidatePayload,
  effectiveCandidateTarget,
} from "@/lib/continuum/candidates/review";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { coerceGmailThreadId } from "@/lib/continuum/client-memory/gmail";
import {
  GENERIC_NEW_PROJECT_TITLES,
  NEW_PROJECT_CONTEXT_TOPIC,
} from "@/lib/continuum/gmail/candidates/new-project";
import { parseGmailCandidateSourceRef } from "@/lib/continuum/gmail/candidates/source-ref";
import type { GmailCandidateProject } from "@/lib/continuum/gmail/candidates/types";
import { foldProjectTitle } from "./create";
import { confirmedPersonFromThread } from "./identity-gate";

export type LinkedGmailCanonicalProject = {
  projectId: string;
  title: string;
  projectKind: string | null;
  lifecycleStage: string | null;
  link:
    | "exact_gmail_thread"
    | "approved_candidate_target"
    | "approved_title_and_person";
};

export type CanonicalGmailProjectLookup = {
  threadId: string;
  candidates: readonly ContinuumCandidate[];
  projects: readonly GmailCandidateProject[];
  personIdHint?: string | null;
  allowUnscopedExactTitle?: boolean;
};

function threadIdOf(row: ContinuumCandidate): string | null {
  return parseGmailCandidateSourceRef(row.sourceRef)?.threadId ?? null;
}

function newProjectValue(row: ContinuumCandidate): string | null {
  const payload = effectiveCandidatePayload(row);
  if (payload.kind !== "project_context") return null;
  if (payload.topic !== NEW_PROJECT_CONTEXT_TOPIC) return null;
  const value = payload.value.trim();
  return value || null;
}

function isNewProjectRow(row: ContinuumCandidate): boolean {
  return Boolean(newProjectValue(row));
}

function projectsWithExactThread(
  threadId: string,
  projects: readonly GmailCandidateProject[],
): GmailCandidateProject[] {
  const coercedThread = coerceGmailThreadId(threadId);
  if (coercedThread.status !== "canonical") return [];
  return projects.filter((project) => {
    const stored = coerceGmailThreadId(project.gmailThreadId);
    return stored.status === "canonical" && stored.value === coercedThread.value;
  });
}

function newProjectsOnThread(
  candidates: readonly ContinuumCandidate[],
  threadId: string,
): ContinuumCandidate[] {
  return candidates.filter(
    (row) => isNewProjectRow(row) && threadIdOf(row) === threadId,
  );
}

function approvedNewProjectsOnThread(
  candidates: readonly ContinuumCandidate[],
  threadId: string,
): ContinuumCandidate[] {
  return newProjectsOnThread(candidates, threadId).filter(
    (row) => row.reviewStatus === "approved",
  );
}

function uniqueProjectByExactTitle(
  personId: string,
  title: string,
  projects: readonly GmailCandidateProject[],
): GmailCandidateProject | null {
  const folded = foldProjectTitle(title);
  if (!folded) return null;
  const matches = projects.filter(
    (project) =>
      project.personIds.includes(personId) &&
      foldProjectTitle(project.title) === folded,
  );
  return matches.length === 1 ? matches[0]! : null;
}

function uniqueUnscopedExactTitle(
  title: string,
  projects: readonly GmailCandidateProject[],
): GmailCandidateProject | null {
  if (GENERIC_NEW_PROJECT_TITLES.has(title.trim())) return null;
  const folded = foldProjectTitle(title);
  if (!folded) return null;
  const matches = projects.filter(
    (project) => foldProjectTitle(project.title) === folded,
  );
  return matches.length === 1 ? matches[0]! : null;
}

function titlesForLookup(rows: readonly ContinuumCandidate[]): string[] {
  const approved = [
    ...new Set(
      rows.flatMap((row) => {
        if (row.reviewStatus !== "approved") return [];
        const value = newProjectValue(row);
        return value ? [value] : [];
      }),
    ),
  ];
  if (approved.length > 0) return approved;
  return [
    ...new Set(
      rows.flatMap((row) => {
        if (row.reviewStatus === "discarded") return [];
        const value = newProjectValue(row);
        return value ? [value] : [];
      }),
    ),
  ];
}

function linkedFromProject(
  project: GmailCandidateProject,
  link: LinkedGmailCanonicalProject["link"],
): LinkedGmailCanonicalProject {
  return {
    projectId: project.projectId,
    title: project.title,
    projectKind: project.projectKind ?? null,
    lifecycleStage: project.lifecycleStage ?? null,
    link,
  };
}

export function canonicalProjectForGmailThread(
  input: CanonicalGmailProjectLookup,
): LinkedGmailCanonicalProject | null {
  const threadId = input.threadId.trim();
  if (!threadId) return null;

  const exact = projectsWithExactThread(threadId, input.projects);
  if (exact.length === 1) return linkedFromProject(exact[0]!, "exact_gmail_thread");
  if (exact.length > 1) return null;

  const approved = approvedNewProjectsOnThread(input.candidates, threadId);
  const targeted = approved.flatMap((row) => {
    const target = effectiveCandidateTarget(row);
    if (target.kind !== "project" || !target.projectId) return [];
    const project = input.projects.find((item) => item.projectId === target.projectId);
    return project ? [project] : [];
  });
  const uniqueTargetIds = [...new Set(targeted.map((row) => row.projectId))];
  if (uniqueTargetIds.length === 1) {
    return linkedFromProject(targeted[0]!, "approved_candidate_target");
  }

  const onThread = newProjectsOnThread(input.candidates, threadId);
  const titles = titlesForLookup(onThread);
  const confirmed = confirmedPersonFromThread(input.candidates, threadId);
  const personId = confirmed?.personId ?? input.personIdHint?.trim() ?? null;
  if (personId && titles.length === 1) {
    const project = uniqueProjectByExactTitle(personId, titles[0]!, input.projects);
    if (project) return linkedFromProject(project, "approved_title_and_person");
  }

  if (input.allowUnscopedExactTitle && titles.length === 1) {
    const project = uniqueUnscopedExactTitle(titles[0]!, input.projects);
    if (project) return linkedFromProject(project, "approved_title_and_person");
  }
  return null;
}

export function knownGmailProjectThreadIds(
  candidates: readonly ContinuumCandidate[],
  projects: readonly GmailCandidateProject[],
): string[] {
  const ids = new Set<string>();
  for (const project of projects) {
    const stored = coerceGmailThreadId(project.gmailThreadId);
    if (stored.status === "canonical") ids.add(stored.value);
  }
  const threadIds = new Set<string>();
  for (const row of candidates) {
    const threadId = threadIdOf(row);
    if (threadId) threadIds.add(threadId);
  }
  for (const threadId of threadIds) {
    if (ids.has(threadId)) continue;
    const linked = canonicalProjectForGmailThread({
      threadId,
      candidates,
      projects,
      allowUnscopedExactTitle: false,
    });
    if (linked) ids.add(threadId);
  }
  return [...ids];
}

export function canonicalGmailThreadId(threadId: string | null | undefined): string | null {
  const coerced = coerceGmailThreadId(threadId ?? null);
  return coerced.status === "canonical" ? coerced.value : null;
}
