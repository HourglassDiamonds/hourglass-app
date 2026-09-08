/**
 * Map canonical Continuum People/Projects into the Gmail candidate world.
 * Email hash identity only. Never Gmail display-name matching.
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
};

export function buildGmailCandidateWorld(
  input: CandidateWorldInput,
): GmailCandidateWorld {
  const projectIdsByPerson = new Map<string, string[]>();
  const personIdsByProject = new Map<string, string[]>();
  for (const row of input.relationships) {
    if (row.kind !== "client-project" || row.status !== "active") continue;
    const personId = input.people.some((person) => person.personId === row.fromEntityId)
      ? row.fromEntityId
      : row.toEntityId;
    const projectId = personId === row.fromEntityId ? row.toEntityId : row.fromEntityId;
    const personProjects = projectIdsByPerson.get(personId) ?? [];
    personProjects.push(projectId);
    projectIdsByPerson.set(personId, personProjects);
    const projectPeople = personIdsByProject.get(projectId) ?? [];
    projectPeople.push(personId);
    personIdsByProject.set(projectId, projectPeople);
  }
  const historyByProject = new Map(input.histories.map((row) => [row.projectId, row]));
  const people: GmailCandidatePerson[] = input.people.map((person) => ({
    personId: person.personId,
    displayName: person.displayName,
    emailHash: hashEmail(person.email),
    role: person.roles[0] ?? null,
    projectIds: projectIdsByPerson.get(person.personId) ?? [],
  }));
  const projects: GmailCandidateProject[] = input.projects.map((project) => {
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
    people,
    projects,
    internalEmailHashes: (input.internalEmails ?? [])
      .map((email) => hashEmail(email))
      .filter((row): row is string => Boolean(row)),
  };
}
