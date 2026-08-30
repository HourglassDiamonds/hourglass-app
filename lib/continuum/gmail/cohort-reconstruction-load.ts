/**
 * Founder-only live loaders for Cohort 1 reconstruction review.
 * Read-only. Does not call Gmail. Does not write canonical records.
 */

import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { ProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/reader";
import type { ProjectHistory } from "@/lib/continuum/client-memory/types";
import type { GmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import type { GmailAttachmentStore } from "./attachments";
import type { AchedekalDiscoveryProject } from "./achedekal-candidate-discovery";
import type { ArtifactHuntProject } from "./artifact-hunt";
import type { ExistingProjectBook } from "./project-book-containment";
import {
  composeCohortProjectReview,
  summarizeCohortProject,
  type CohortIndexSummary,
  type CohortProjectReview,
} from "./cohort-reconstruction-compose";
import {
  RECONSTRUCTION_COHORT_1_PROJECT_IDS,
  isPermittedCohort1ProjectId,
} from "./reconstruction-cohort";
import { isDiscardedIndexedMessage } from "./project-reconstruction";
import type { ReconstructionPerson } from "./project-reconstruction";

export type CohortMemory = {
  getProjectHistory(projectId: string): Promise<ProjectHistory | null>;
  getPersonProfile(
    personId: string,
  ): Promise<{ email?: string | null } | null>;
};

export async function listReconstructionProjectBooks(
  reader: ProjectDeskReader,
  memory: CohortMemory,
): Promise<ExistingProjectBook[]> {
  const listed = await reader.listProjects();
  const histories = await Promise.all(
    listed.map((row) =>
      row.projectId
        ? memory.getProjectHistory(row.projectId)
        : Promise.resolve(null),
    ),
  );
  const books: ExistingProjectBook[] = [];
  listed.forEach((row, index) => {
    if (!row.projectId) return;
    const history = histories[index];
    books.push({
      projectId: row.projectId,
      personId: row.people[0]?.personId ?? "",
      title: row.title,
      lifecycle: "unknown",
      items: [],
      cadJobNumbers: history?.cadJobNumber ? [history.cadJobNumber] : [],
      orderNumbers: history?.orderNumber ? [history.orderNumber] : [],
      gmailThreadIds: history?.gmailThreadId ? [history.gmailThreadId] : [],
      artifactRefs: [],
      vendors: [],
      subjectTerms: [],
      dateRange: null,
    });
  });
  return books;
}

async function personEmailHashFor(
  memory: CohortMemory,
  personId: string | null,
): Promise<string | null> {
  if (!personId) return null;
  const person = await memory.getPersonProfile(personId);
  return person?.email ? (hashEmail(person.email) ?? null) : null;
}

export async function loadCohort1Index(input: {
  reader: ProjectDeskReader;
  memory: CohortMemory;
  index: Pick<GmailIndexStore, "listMessagesByThread">;
  attachments: Pick<GmailAttachmentStore, "listByThread">;
}): Promise<CohortIndexSummary[]> {
  const rows: CohortIndexSummary[] = [];
  for (const projectId of RECONSTRUCTION_COHORT_1_PROJECT_IDS) {
    const desk = await input.reader.getProjectDesk(projectId);
    if (!desk.ok) {
      rows.push(
        summarizeCohortProject({
          projectId,
          title: "Project unavailable",
          personCount: 0,
          gmailThreadId: null,
          cadJobNumber: null,
          orderNumber: null,
          fingerSize: null,
          indexedMessageCount: 0,
          attachmentMetadataCount: 0,
        }),
      );
      continue;
    }
    const history = await input.memory.getProjectHistory(projectId);
    const threadId = history?.gmailThreadId?.trim() ?? "";
    const [messages, attachments] = threadId
      ? await Promise.all([
          input.index.listMessagesByThread(threadId),
          input.attachments.listByThread(threadId),
        ])
      : [[], []];
    rows.push(
      summarizeCohortProject({
        projectId,
        title: desk.desk.title,
        personCount: desk.desk.people.length,
        gmailThreadId: history?.gmailThreadId ?? null,
        cadJobNumber: history?.cadJobNumber ?? null,
        orderNumber: history?.orderNumber ?? null,
        fingerSize: history?.fingerSize ?? null,
        indexedMessageCount: messages.filter(
          (row) => !isDiscardedIndexedMessage(row),
        ).length,
        attachmentMetadataCount: attachments.length,
      }),
    );
  }
  return rows;
}

export async function loadCohort1ProjectReview(input: {
  founderSessionOk: boolean;
  projectId: string;
  reader: ProjectDeskReader;
  memory: CohortMemory;
  index: GmailIndexStore;
  attachments: GmailAttachmentStore;
  internalEmailHashes: readonly string[];
}): Promise<CohortProjectReview | null> {
  const projectId = input.projectId.trim();
  if (!isPermittedCohort1ProjectId(projectId)) return null;
  const desk = await input.reader.getProjectDesk(projectId);
  if (!desk.ok) return null;
  const history = await input.memory.getProjectHistory(projectId);
  const personId = desk.desk.people[0]?.personId ?? null;
  const personEmailHash = await personEmailHashFor(input.memory, personId);
  const existingPerson: ReconstructionPerson | null = personId
    ? {
        personId,
        displayName: desk.desk.people[0]?.displayName ?? "",
        emailHash: personEmailHash,
      }
    : null;

  const discoveryProject = (): AchedekalDiscoveryProject => ({
    projectId,
    gmailThreadId: history?.gmailThreadId ?? null,
    cadJobNumber: history?.cadJobNumber ?? null,
    orderNumber: history?.orderNumber ?? null,
    fingerSize: history?.fingerSize ?? null,
    metal: history?.metal ?? null,
    centerStone: history?.centerStone ?? null,
    personId,
    personEmailHash,
    personEmailHashes: personEmailHash ? [personEmailHash] : [],
  });
  const huntProject = async (
    requested: string,
  ): Promise<ArtifactHuntProject | null> => {
    if (requested !== projectId) return null;
    return {
      projectId,
      title: desk.desk.title,
      gmailThreadId: history?.gmailThreadId ?? null,
      cadJobNumber: history?.cadJobNumber ?? null,
      orderNumber: history?.orderNumber ?? null,
      fingerSize: history?.fingerSize ?? null,
      metal: history?.metal ?? null,
      centerStone: history?.centerStone ?? null,
      personId,
      personEmailHash,
      personEmailHashes: personEmailHash ? [personEmailHash] : [],
      lifecycle: "unknown",
    };
  };

  return composeCohortProjectReview({
    founderSessionOk: input.founderSessionOk,
    projectId,
    title: desk.desk.title,
    personCount: desk.desk.people.length,
    existingPerson,
    history,
    catalog: {
      getDiscoveryProject: async () => discoveryProject(),
      getHuntProject: huntProject,
      listProjectBooks: () =>
        listReconstructionProjectBooks(input.reader, input.memory),
    },
    index: input.index,
    attachments: input.attachments,
    internalEmailHashes: input.internalEmailHashes,
  });
}
