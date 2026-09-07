/**
 * Exact Project / Person association for Gmail candidates.
 * Exact identifiers and known links only. No closest-name heuristic.
 * Does not mint Persons. Does not auto-merge.
 */

import { correlateExactProjectThread } from "../projects";
import { identifierTokensMatch } from "../identifier-specificity";
import { extractCadJobIdentifiers, isStrongStructuredCadIdentifier } from "../cad-job-identifier";
import { extractOrderIdentifiers, isStrongStructuredOrderIdentifier } from "../order-identifier";
import type { GmailCandidatePerson, GmailCandidateProject } from "./types";

export type ProjectAssociationHit = {
  project: GmailCandidateProject;
  match: "exact" | "ambiguous";
  token: string | null;
  ruleIds: readonly string[];
};

export type PersonAssociationHit = {
  person: GmailCandidatePerson | null;
  emailHash: string | null;
  collisionPersonIds: readonly string[];
  internal: boolean;
  ruleIds: readonly string[];
};

function uniqueById(
  hits: readonly ProjectAssociationHit[],
): ProjectAssociationHit[] {
  const seen = new Set<string>();
  const out: ProjectAssociationHit[] = [];
  for (const hit of hits) {
    if (seen.has(hit.project.projectId)) continue;
    seen.add(hit.project.projectId);
    out.push(hit);
  }
  return out;
}

export function exactThreadProjectHits(
  threadId: string,
  projects: readonly GmailCandidateProject[],
): ProjectAssociationHit[] {
  const match = correlateExactProjectThread(
    threadId,
    projects.map((project) => ({
      projectId: project.projectId,
      gmailThreadId: project.gmailThreadId,
    })),
  );
  if (match.status !== "exact") return [];
  const ambiguous = match.projectIds.length > 1;
  return match.projectIds.flatMap((projectId) => {
    const project = projects.find((row) => row.projectId === projectId);
    if (!project) return [];
    return [
      {
        project,
        match: ambiguous ? "ambiguous" : "exact",
        token: threadId,
        ruleIds: ambiguous
          ? ["exact_gmail_thread", "ambiguous_thread_projects"]
          : ["exact_gmail_thread"],
      } satisfies ProjectAssociationHit,
    ];
  });
}

function identifierProjectHits(
  tokens: readonly string[],
  projects: readonly GmailCandidateProject[],
  field: "cadJobNumber" | "orderNumber",
  rule: string,
  strong: (value: string) => boolean,
): ProjectAssociationHit[] {
  const hits: ProjectAssociationHit[] = [];
  for (const token of tokens) {
    if (!strong(token)) continue;
    const matched = projects.filter((project) => {
      const stored = project[field];
      return stored ? identifierTokensMatch(stored, token) : false;
    });
    if (matched.length === 0) continue;
    const ambiguous = matched.length > 1;
    for (const project of matched) {
      hits.push({
        project,
        match: ambiguous ? "ambiguous" : "exact",
        token,
        ruleIds: ambiguous ? [rule, "ambiguous_identifier_projects"] : [rule],
      });
    }
  }
  return uniqueById(hits);
}

export function cadProjectHits(
  text: string,
  projects: readonly GmailCandidateProject[],
): ProjectAssociationHit[] {
  return identifierProjectHits(
    extractCadJobIdentifiers(text),
    projects,
    "cadJobNumber",
    "exact_cad_job",
    isStrongStructuredCadIdentifier,
  );
}

export function orderProjectHits(
  text: string,
  projects: readonly GmailCandidateProject[],
): ProjectAssociationHit[] {
  return identifierProjectHits(
    extractOrderIdentifiers(text),
    projects,
    "orderNumber",
    "exact_order_number",
    isStrongStructuredOrderIdentifier,
  );
}

export function personProjectHits(
  person: GmailCandidatePerson,
  projects: readonly GmailCandidateProject[],
): ProjectAssociationHit[] {
  const linked = projects.filter(
    (project) =>
      project.founderApprovedCurrent &&
      (person.projectIds.includes(project.projectId) ||
        project.personIds.includes(person.personId)),
  );
  if (linked.length === 0) return [];
  const ambiguous = linked.length > 1;
  return linked.map((project) => ({
    project,
    match: ambiguous ? "ambiguous" : "exact",
    token: null,
    ruleIds: ambiguous
      ? ["person_project_link", "ambiguous_person_projects"]
      : ["person_project_link"],
  }));
}

export function resolveProjectHits(input: {
  threadId: string;
  haystack: string;
  person: GmailCandidatePerson | null;
  projects: readonly GmailCandidateProject[];
}): ProjectAssociationHit[] {
  const threadHits = exactThreadProjectHits(input.threadId, input.projects);
  if (threadHits.length > 0) return threadHits;
  const cadHits = cadProjectHits(input.haystack, input.projects);
  if (cadHits.length > 0) return cadHits;
  const orderHits = orderProjectHits(input.haystack, input.projects);
  if (orderHits.length > 0) return orderHits;
  if (input.person) return personProjectHits(input.person, input.projects);
  return [];
}

export function resolvePersonHit(input: {
  fromEmailHash: string | null;
  people: readonly GmailCandidatePerson[];
  internalEmailHashes: readonly string[];
}): PersonAssociationHit {
  const emailHash = input.fromEmailHash?.trim() || null;
  if (!emailHash) {
    return {
      person: null,
      emailHash: null,
      collisionPersonIds: [],
      internal: false,
      ruleIds: ["unresolved_sender"],
    };
  }
  if (input.internalEmailHashes.includes(emailHash)) {
    return {
      person: null,
      emailHash,
      collisionPersonIds: [],
      internal: true,
      ruleIds: ["internal_mailbox"],
    };
  }
  const matched = input.people.filter((person) => person.emailHash === emailHash);
  if (matched.length === 1) {
    return {
      person: matched[0]!,
      emailHash,
      collisionPersonIds: [],
      internal: false,
      ruleIds: ["exact_email_hash"],
    };
  }
  if (matched.length > 1) {
    return {
      person: null,
      emailHash,
      collisionPersonIds: matched.map((row) => row.personId).sort(),
      internal: false,
      ruleIds: ["email_hash_collision"],
    };
  }
  return {
    person: null,
    emailHash,
    collisionPersonIds: [],
    internal: false,
    ruleIds: ["unresolved_email_hash"],
  };
}
