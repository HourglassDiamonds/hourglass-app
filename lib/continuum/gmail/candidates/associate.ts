/**
 * Exact Project / Person association for Gmail candidates.
 * Exact identifiers and known links only. No closest-name heuristic.
 * Email hash is supporting evidence only unless a founder-confirmed mapping exists.
 * Does not mint Persons. Does not auto-merge.
 */

import { correlateExactProjectThread } from "../projects";
import { identifierTokensMatch } from "../identifier-specificity";
import { extractCadJobIdentifiers, isStrongStructuredCadIdentifier } from "../cad-job-identifier";
import { extractOrderIdentifiers, isStrongStructuredOrderIdentifier } from "../order-identifier";
import type {
  GmailCandidatePerson,
  GmailCandidateProject,
  GmailCandidateWorld,
  GmailConfirmedPersonMapping,
} from "./types";

export const FOUNDER_CONFIRMED_GMAIL_SOURCE_LINK =
  "founder_confirmed_gmail_source_link" as const;
export const FOUNDER_CONFIRMED_PARTICIPANT_MAPPING =
  "founder_confirmed_participant_mapping" as const;
export const FOUNDER_CONFIRMED_ADDRESS_IDENTITY =
  "founder_confirmed_address_identity" as const;
export const EMAIL_HASH_SUPPORTING_NOT_IDENTITY =
  "email_hash_supporting_not_identity" as const;

export const STRONG_GMAIL_IDENTITY_RULES = [
  FOUNDER_CONFIRMED_GMAIL_SOURCE_LINK,
  FOUNDER_CONFIRMED_PARTICIPANT_MAPPING,
  FOUNDER_CONFIRMED_ADDRESS_IDENTITY,
] as const;

export function isStrongGmailIdentityRule(
  ruleIds: readonly string[],
): boolean {
  return ruleIds.some((rule) =>
    (STRONG_GMAIL_IDENTITY_RULES as readonly string[]).includes(rule),
  );
}

export type ProjectAssociationHit = {
  project: GmailCandidateProject;
  match: "exact" | "ambiguous";
  token: string | null;
  ruleIds: readonly string[];
};

export type PersonAssociationHit = {
  person: GmailCandidatePerson | null;
  possiblePerson: GmailCandidatePerson | null;
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

function uniqueMappedPersonIds(
  rows: readonly GmailConfirmedPersonMapping[],
  emailHash: string,
): string[] {
  return [
    ...new Set(
      rows
        .filter((row) => row.emailHash === emailHash && row.personId.trim())
        .map((row) => row.personId),
    ),
  ].sort();
}

function personById(
  people: readonly GmailCandidatePerson[],
  personId: string,
): GmailCandidatePerson | null {
  return people.find((row) => row.personId === personId) ?? null;
}

function emptyHit(
  partial: Pick<PersonAssociationHit, "emailHash" | "internal" | "ruleIds"> &
    Partial<Pick<PersonAssociationHit, "collisionPersonIds" | "possiblePerson">>,
): PersonAssociationHit {
  return {
    person: null,
    possiblePerson: partial.possiblePerson ?? null,
    emailHash: partial.emailHash,
    collisionPersonIds: partial.collisionPersonIds ?? [],
    internal: partial.internal,
    ruleIds: partial.ruleIds,
  };
}

export function resolvePersonHit(input: {
  fromEmailHash: string | null;
  threadId?: string | null;
  people: readonly GmailCandidatePerson[];
  internalEmailHashes: readonly string[];
  confirmedParticipantMappings?: readonly GmailConfirmedPersonMapping[];
  confirmedSourceLinks?: GmailCandidateWorld["confirmedSourceLinks"];
  founderConfirmedEmailIdentities?: readonly GmailConfirmedPersonMapping[];
}): PersonAssociationHit {
  const emailHash = input.fromEmailHash?.trim() || null;
  if (!emailHash) {
    return emptyHit({
      emailHash: null,
      internal: false,
      ruleIds: ["unresolved_sender"],
    });
  }
  if (input.internalEmailHashes.includes(emailHash)) {
    return emptyHit({
      emailHash,
      internal: true,
      ruleIds: ["internal_mailbox"],
    });
  }

  const threadId = input.threadId?.trim() || "";
  const linkIds = [
    ...new Set(
      (input.confirmedSourceLinks ?? [])
        .filter((row) => row.threadId === threadId && row.personId.trim())
        .map((row) => row.personId),
    ),
  ].sort();
  const mappingIds = uniqueMappedPersonIds(
    input.confirmedParticipantMappings ?? [],
    emailHash,
  );
  const identityIds = uniqueMappedPersonIds(
    input.founderConfirmedEmailIdentities ?? [],
    emailHash,
  );

  const supporting = input.people.filter((person) => person.emailHash === emailHash);
  const supportingIds = supporting.map((row) => row.personId).sort();
  const possiblePerson = supporting.length === 1 ? supporting[0]! : null;

  function strong(
    personId: string,
    ruleIds: readonly string[],
  ): PersonAssociationHit {
    const person = personById(input.people, personId);
    if (!person) {
      return emptyHit({
        emailHash,
        internal: false,
        possiblePerson,
        collisionPersonIds: supporting.length > 1 ? supportingIds : [],
        ruleIds: [...ruleIds, "unresolved_confirmed_person"],
      });
    }
    return {
      person,
      possiblePerson: possiblePerson ?? person,
      emailHash,
      collisionPersonIds: [],
      internal: false,
      ruleIds,
    };
  }

  if (linkIds.length > 1) {
    return emptyHit({
      emailHash,
      internal: false,
      possiblePerson,
      collisionPersonIds: linkIds,
      ruleIds: [FOUNDER_CONFIRMED_GMAIL_SOURCE_LINK, "email_hash_collision"],
    });
  }
  if (linkIds.length === 1) {
    const linked = linkIds[0]!;
    if (mappingIds.length === 1 && mappingIds[0] !== linked) {
      return emptyHit({
        emailHash,
        internal: false,
        possiblePerson,
        collisionPersonIds: [linked, mappingIds[0]!].sort(),
        ruleIds: [
          FOUNDER_CONFIRMED_GMAIL_SOURCE_LINK,
          FOUNDER_CONFIRMED_PARTICIPANT_MAPPING,
          "email_hash_collision",
        ],
      });
    }
    return strong(linked, [FOUNDER_CONFIRMED_GMAIL_SOURCE_LINK]);
  }
  if (mappingIds.length > 1) {
    return emptyHit({
      emailHash,
      internal: false,
      possiblePerson,
      collisionPersonIds: mappingIds,
      ruleIds: [FOUNDER_CONFIRMED_PARTICIPANT_MAPPING, "email_hash_collision"],
    });
  }
  if (identityIds.length > 1) {
    return emptyHit({
      emailHash,
      internal: false,
      possiblePerson,
      collisionPersonIds: identityIds,
      ruleIds: [FOUNDER_CONFIRMED_ADDRESS_IDENTITY, "email_hash_collision"],
    });
  }
  if (mappingIds.length === 1 && identityIds.length === 1 && mappingIds[0] !== identityIds[0]) {
    return emptyHit({
      emailHash,
      internal: false,
      possiblePerson,
      collisionPersonIds: [mappingIds[0]!, identityIds[0]!].sort(),
      ruleIds: [
        FOUNDER_CONFIRMED_PARTICIPANT_MAPPING,
        FOUNDER_CONFIRMED_ADDRESS_IDENTITY,
        "email_hash_collision",
      ],
    });
  }
  if (mappingIds.length === 1) {
    return strong(mappingIds[0]!, [FOUNDER_CONFIRMED_PARTICIPANT_MAPPING]);
  }
  if (identityIds.length === 1) {
    return strong(identityIds[0]!, [FOUNDER_CONFIRMED_ADDRESS_IDENTITY]);
  }

  if (supporting.length > 1) {
    return emptyHit({
      emailHash,
      internal: false,
      collisionPersonIds: supportingIds,
      ruleIds: [EMAIL_HASH_SUPPORTING_NOT_IDENTITY, "email_hash_collision"],
    });
  }
  if (supporting.length === 1) {
    return emptyHit({
      emailHash,
      internal: false,
      possiblePerson,
      ruleIds: [EMAIL_HASH_SUPPORTING_NOT_IDENTITY],
    });
  }
  return emptyHit({
    emailHash,
    internal: false,
    ruleIds: ["unresolved_email_hash"],
  });
}
