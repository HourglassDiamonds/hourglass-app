/**
 * Map canonical Continuum People/Projects into the Gmail candidate world.
 * Profile email hashes are supporting evidence only. Never display-name matching.
 */

import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { PersonProfile, ProjectHistory, ProjectProfile } from "@/lib/continuum/client-memory/types";
import type { EntityRelationship } from "@/lib/continuum/client-memory/types";
import type {
  GmailCandidatePerson,
  GmailCandidateProject,
  GmailCandidateWorld,
} from "./types";

export type CandidateWorldInput = {
  people: readonly PersonProfile[];
  projects: readonly ProjectProfile[];
  histories: readonly ProjectHistory[];
  relationships: readonly EntityRelationship[];
  internalEmails?: readonly (string | null)[];
  confirmedParticipantMappings?: GmailCandidateWorld["confirmedParticipantMappings"];
  confirmedSourceLinks?: GmailCandidateWorld["confirmedSourceLinks"];
  founderConfirmedEmailIdentities?: GmailCandidateWorld["founderConfirmedEmailIdentities"];
};

export function buildGmailCandidateWorld(
  input: CandidateWorldInput,
): GmailCandidateWorld {
  const people = input.people.filter(
    (person) => person.personId.trim() && person.displayName.trim(),
  );
  const projects = input.projects.filter(
    (project) => project.projectId.trim() && project.displayTitle.trim(),
  );
  const knownPeople = new Set(people.map((person) => person.personId));
  const knownProjects = new Set(projects.map((project) => project.projectId));
  const projectIdsByPerson = new Map<string, string[]>();
  const personIdsByProject = new Map<string, string[]>();
  for (const row of input.relationships) {
    if (row.kind !== "client-project" || row.status !== "active") continue;
    const from = row.fromEntityId;
    const to = row.toEntityId;
    const personToProject = knownPeople.has(from) && knownProjects.has(to);
    const projectToPerson = knownProjects.has(from) && knownPeople.has(to);
    if (!personToProject && !projectToPerson) continue;
    const personId = personToProject ? from : to;
    const projectId = personToProject ? to : from;
    const personProjects = projectIdsByPerson.get(personId) ?? [];
    personProjects.push(projectId);
    projectIdsByPerson.set(personId, personProjects);
    const projectPeople = personIdsByProject.get(projectId) ?? [];
    projectPeople.push(personId);
    personIdsByProject.set(projectId, projectPeople);
  }
  const historyByProject = new Map(
    input.histories
      .filter((row) => knownProjects.has(row.projectId))
      .map((row) => [row.projectId, row]),
  );
  const mappedPeople: GmailCandidatePerson[] = people.map((person) => ({
    personId: person.personId,
    displayName: person.displayName,
    emailHash: hashEmail(person.email),
    role: person.roles[0] ?? null,
    projectIds: projectIdsByPerson.get(person.personId) ?? [],
  }));
  const mappedProjects: GmailCandidateProject[] = projects.map((project) => {
    const history = historyByProject.get(project.projectId);
    return {
      projectId: project.projectId,
      title: project.displayTitle,
      gmailThreadId: history?.gmailThreadId ?? null,
      cadJobNumber: history?.cadJobNumber ?? null,
      orderNumber: history?.orderNumber ?? null,
      fingerSize: history?.fingerSize ?? null,
      metal: history?.metal ?? null,
      centerStone: history?.centerStone ?? null,
      diamondSupplyNotes: history?.diamondSupplyNotes ?? null,
      personIds: personIdsByProject.get(project.projectId) ?? [],
      founderApprovedCurrent: true,
    };
  });
  return {
    people: mappedPeople,
    projects: mappedProjects,
    internalEmailHashes: (input.internalEmails ?? [])
      .map((email) => hashEmail(email))
      .filter((row): row is string => Boolean(row)),
    confirmedParticipantMappings: input.confirmedParticipantMappings ?? [],
    confirmedSourceLinks: input.confirmedSourceLinks ?? [],
    founderConfirmedEmailIdentities: input.founderConfirmedEmailIdentities ?? [],
  };
}
