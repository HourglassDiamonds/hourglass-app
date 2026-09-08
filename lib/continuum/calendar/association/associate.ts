/**
 * Deterministic Calendar → Person / Project association analysis.
 * Consumes #22 evidence. Does not mutate it. Does not fetch descriptions.
 * Email is supporting evidence only. No closest-name matching.
 * Does not mint or merge People. Does not create Open Jobs.
 */

import {
  extractCadJobIdentifiers,
  isStrongStructuredCadIdentifier,
} from "@/lib/continuum/gmail/cad-job-identifier";
import { identifierTokensMatch } from "@/lib/continuum/gmail/identifier-specificity";
import {
  extractOrderIdentifiers,
  isStrongStructuredOrderIdentifier,
} from "@/lib/continuum/gmail/order-identifier";
import type { CalendarAttendeeEvidence, CalendarEventEvidence } from "../types";
import { packCalendarCandidateSourceRef } from "./source-ref";
import type {
  CalendarAssociationAnalysis,
  CalendarAssociationPerson,
  CalendarAssociationProject,
  CalendarAssociationWorld,
  CalendarConfirmedParticipantMapping,
  CalendarPersonAssociationHit,
  CalendarProjectAssociationHit,
} from "./types";

const PROJECT_ID_IN_TITLE =
  /\b([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\b/gi;

function uniqueByProjectId(
  hits: readonly CalendarProjectAssociationHit[],
): CalendarProjectAssociationHit[] {
  const seen = new Set<string>();
  const out: CalendarProjectAssociationHit[] = [];
  for (const hit of hits) {
    if (seen.has(hit.projectId)) continue;
    seen.add(hit.projectId);
    out.push(hit);
  }
  return out;
}

function titleHaystack(evidence: CalendarEventEvidence): string {
  return evidence.title?.trim() ?? "";
}

function participantKey(row: {
  email_hash: string | null;
  display_name: string | null;
}): string {
  if (row.email_hash) return `hash:${row.email_hash}`;
  const name = row.display_name?.trim().toLowerCase() ?? "";
  return name ? `name:${name}` : "unknown";
}

function collectParticipants(
  evidence: CalendarEventEvidence,
): CalendarAttendeeEvidence[] {
  const rows: CalendarAttendeeEvidence[] = [];
  if (evidence.organizer && !evidence.organizer.self) {
    rows.push({
      display_name: evidence.organizer.display_name,
      email_hash: evidence.organizer.email_hash,
      email_present: evidence.organizer.email_present,
      response_status: "unknown",
      optional: false,
      organizer: true,
      self: evidence.organizer.self,
    });
  }
  for (const attendee of evidence.attendees) {
    if (attendee.self) continue;
    rows.push(attendee);
  }
  const seen = new Set<string>();
  const out: CalendarAttendeeEvidence[] = [];
  for (const row of rows) {
    const key = participantKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function identifierProjectHits(
  tokens: readonly string[],
  projects: readonly CalendarAssociationProject[],
  field: "cadJobNumber" | "orderNumber",
  rule: string,
  strong: (value: string) => boolean,
  haystack: string,
): CalendarProjectAssociationHit[] {
  const hits: CalendarProjectAssociationHit[] = [];
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
        projectId: project.projectId,
        title: project.title,
        token,
        match: ambiguous ? "ambiguous" : "exact",
        ruleIds: ambiguous ? [rule, "ambiguous_identifier_projects"] : [rule],
        matchedText: haystack || token,
      });
    }
  }
  return uniqueByProjectId(hits);
}

function cadProjectHits(
  haystack: string,
  projects: readonly CalendarAssociationProject[],
): CalendarProjectAssociationHit[] {
  return identifierProjectHits(
    extractCadJobIdentifiers(haystack),
    projects,
    "cadJobNumber",
    "exact_cad_job",
    isStrongStructuredCadIdentifier,
    haystack,
  );
}

function orderProjectHits(
  haystack: string,
  projects: readonly CalendarAssociationProject[],
): CalendarProjectAssociationHit[] {
  return identifierProjectHits(
    extractOrderIdentifiers(haystack),
    projects,
    "orderNumber",
    "exact_order_number",
    isStrongStructuredOrderIdentifier,
    haystack,
  );
}

function projectIdHits(
  haystack: string,
  projects: readonly CalendarAssociationProject[],
): CalendarProjectAssociationHit[] {
  if (!haystack) return [];
  const ids = new Set<string>();
  PROJECT_ID_IN_TITLE.lastIndex = 0;
  for (const match of haystack.matchAll(PROJECT_ID_IN_TITLE)) {
    const id = (match[1] ?? "").toLowerCase();
    if (id) ids.add(id);
  }
  if (ids.size === 0) return [];
  const hits: CalendarProjectAssociationHit[] = [];
  for (const project of projects) {
    if (!ids.has(project.projectId.toLowerCase())) continue;
    hits.push({
      projectId: project.projectId,
      title: project.title,
      token: project.projectId,
      match: "exact",
      ruleIds: ["exact_project_id"],
      matchedText: haystack,
    });
  }
  return uniqueByProjectId(hits);
}

function personProjectHits(
  people: readonly CalendarAssociationPerson[],
  projects: readonly CalendarAssociationProject[],
): CalendarProjectAssociationHit[] {
  const hits: CalendarProjectAssociationHit[] = [];
  for (const person of people) {
    const linked = projects.filter(
      (project) =>
        project.founderApprovedCurrent &&
        (person.projectIds.includes(project.projectId) ||
          project.personIds.includes(person.personId)),
    );
    if (linked.length === 0) continue;
    const ambiguous = linked.length > 1;
    for (const project of linked) {
      hits.push({
        projectId: project.projectId,
        title: project.title,
        token: null,
        match: ambiguous ? "ambiguous" : "exact",
        ruleIds: ambiguous
          ? ["unique_person_active_project", "ambiguous_person_projects"]
          : ["unique_person_active_project"],
        matchedText: person.displayName,
      });
    }
  }
  return uniqueByProjectId(hits);
}

function sourceLinkProjectHits(
  sourceRef: string,
  world: CalendarAssociationWorld,
): CalendarProjectAssociationHit[] {
  const links = world.confirmedLinks.filter(
    (row) => row.sourceRef === sourceRef && row.entityKind === "project",
  );
  if (links.length === 0) return [];
  const ambiguous = links.length > 1;
  const hits: CalendarProjectAssociationHit[] = [];
  for (const link of links) {
    const project = world.projects.find((row) => row.projectId === link.entityId);
    hits.push({
      projectId: link.entityId,
      title: project?.title ?? null,
      token: null,
      match: ambiguous ? "ambiguous" : "exact",
      ruleIds: ambiguous
        ? ["exact_calendar_source_link", "ambiguous_source_link_projects"]
        : ["exact_calendar_source_link"],
      matchedText: sourceRef,
    });
  }
  return uniqueByProjectId(hits);
}

function resolveProjectHits(input: {
  sourceRef: string;
  haystack: string;
  strongPeople: readonly CalendarAssociationPerson[];
  world: CalendarAssociationWorld;
}): CalendarProjectAssociationHit[] {
  const linked = sourceLinkProjectHits(input.sourceRef, input.world);
  if (linked.length > 0) return linked;
  const cadHits = cadProjectHits(input.haystack, input.world.projects);
  if (cadHits.length > 0) return cadHits;
  const orderHits = orderProjectHits(input.haystack, input.world.projects);
  if (orderHits.length > 0) return orderHits;
  const idHits = projectIdHits(input.haystack, input.world.projects);
  if (idHits.length > 0) return idHits;
  if (input.strongPeople.length > 0) {
    return personProjectHits(input.strongPeople, input.world.projects);
  }
  return [];
}

function sourceLinkPersonHits(
  sourceRef: string,
  world: CalendarAssociationWorld,
): CalendarPersonAssociationHit[] {
  const links = world.confirmedLinks.filter(
    (row) => row.sourceRef === sourceRef && row.entityKind === "person",
  );
  if (links.length === 0) return [];
  const ambiguous = links.length > 1;
  return links.map((link) => {
    const person = world.people.find((row) => row.personId === link.entityId);
    return {
      personId: link.entityId,
      displayName: person?.displayName ?? null,
      emailHash: link.participantEmailHash,
      mintPerson: false as const,
      mergePersons: false as const,
      ambiguous,
      confidence: ambiguous ? ("ambiguous" as const) : ("high" as const),
      ruleIds: ambiguous
        ? (["exact_calendar_source_link", "ambiguous_source_link_people"] as const)
        : (["exact_calendar_source_link"] as const),
      matchedText: sourceRef,
    };
  });
}

function mappingHitsForHash(
  emailHash: string,
  world: CalendarAssociationWorld,
): CalendarConfirmedParticipantMapping[] {
  return world.confirmedParticipantMappings.filter(
    (row) => row.emailHash === emailHash,
  );
}

function knownPeopleForHash(
  emailHash: string,
  world: CalendarAssociationWorld,
): CalendarAssociationPerson[] {
  return world.people.filter((row) => row.emailHash === emailHash);
}

function personHitsFromParticipants(
  evidence: CalendarEventEvidence,
  world: CalendarAssociationWorld,
): {
  hits: CalendarPersonAssociationHit[];
  strongPeople: CalendarAssociationPerson[];
} {
  const hits: CalendarPersonAssociationHit[] = [];
  const strongPeople: CalendarAssociationPerson[] = [];
  const seenPerson = new Set<string>();
  const seenSupporting = new Set<string>();

  for (const participant of collectParticipants(evidence)) {
    const emailHash = participant.email_hash;
    if (emailHash && world.internalEmailHashes.includes(emailHash)) continue;

    if (emailHash) {
      const mappings = mappingHitsForHash(emailHash, world);
      if (mappings.length === 1) {
        const mapping = mappings[0]!;
        if (!seenPerson.has(mapping.personId)) {
          seenPerson.add(mapping.personId);
          const person = world.people.find((row) => row.personId === mapping.personId);
          if (person) strongPeople.push(person);
          hits.push({
            personId: mapping.personId,
            displayName: person?.displayName ?? participant.display_name,
            emailHash,
            mintPerson: false,
            mergePersons: false,
            ambiguous: false,
            confidence: "high",
            ruleIds: ["founder_confirmed_calendar_participant"],
            matchedText: emailHash,
          });
        }
        continue;
      }
      if (mappings.length > 1) {
        for (const mapping of mappings) {
          if (seenPerson.has(mapping.personId)) continue;
          seenPerson.add(mapping.personId);
          const person = world.people.find((row) => row.personId === mapping.personId);
          hits.push({
            personId: mapping.personId,
            displayName: person?.displayName ?? participant.display_name,
            emailHash,
            mintPerson: false,
            mergePersons: false,
            ambiguous: true,
            confidence: "ambiguous",
            ruleIds: [
              "founder_confirmed_calendar_participant",
              "ambiguous_participant_mappings",
            ],
            matchedText: emailHash,
          });
        }
        continue;
      }

      const known = knownPeopleForHash(emailHash, world);
      if (known.length >= 1 && !seenSupporting.has(emailHash)) {
        seenSupporting.add(emailHash);
        hits.push({
          personId: null,
          displayName: known[0]?.displayName ?? participant.display_name,
          emailHash,
          mintPerson: false,
          mergePersons: false,
          ambiguous: known.length > 1,
          confidence: known.length > 1 ? "ambiguous" : "low",
          ruleIds:
            known.length > 1
              ? ["email_hash_supporting_not_identity", "email_hash_collision"]
              : ["email_hash_supporting_not_identity"],
          matchedText: emailHash,
        });
      }
    }
  }

  return { hits, strongPeople };
}

export function analyzeCalendarEventAssociation(
  evidence: CalendarEventEvidence,
  world: CalendarAssociationWorld,
): CalendarAssociationAnalysis {
  const packed = packCalendarCandidateSourceRef({
    calendarId: evidence.calendar_id,
    calendarEventId: evidence.calendar_event_id,
  });
  if (!packed.ok) {
    return {
      evidence,
      sourceRef: null,
      personHits: [],
      projectHits: [],
      skipped: true,
      skipReason: "identity-too-long",
    };
  }
  if (
    evidence.status === "cancelled" ||
    evidence.occurrence_kind === "cancelled_occurrence"
  ) {
    return {
      evidence,
      sourceRef: packed.sourceRef,
      personHits: [],
      projectHits: [],
      skipped: true,
      skipReason: "cancelled",
    };
  }

  const sourceRef = packed.sourceRef;
  const linkedPeople = sourceLinkPersonHits(sourceRef, world);
  const fromParticipants = personHitsFromParticipants(evidence, world);
  const personHits: CalendarPersonAssociationHit[] = [];
  const seen = new Set<string>();
  for (const hit of [...linkedPeople, ...fromParticipants.hits]) {
    const key = `${hit.personId ?? "none"}:${hit.emailHash ?? ""}:${hit.ruleIds.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    personHits.push(hit);
  }

  const strongFromLinks = linkedPeople.flatMap((hit) => {
    if (!hit.personId) return [];
    const person = world.people.find((row) => row.personId === hit.personId);
    return person ? [person] : [];
  });
  const strongPeople = [...strongFromLinks, ...fromParticipants.strongPeople];
  const uniqueStrong: CalendarAssociationPerson[] = [];
  const strongSeen = new Set<string>();
  for (const person of strongPeople) {
    if (strongSeen.has(person.personId)) continue;
    strongSeen.add(person.personId);
    uniqueStrong.push(person);
  }

  const projectHits = resolveProjectHits({
    sourceRef,
    haystack: titleHaystack(evidence),
    strongPeople: uniqueStrong,
    world,
  });

  return {
    evidence,
    sourceRef,
    personHits,
    projectHits,
    skipped: false,
    skipReason: null,
  };
}
