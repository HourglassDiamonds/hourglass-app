"use server";

/**
 * Founder-only Artifact Hunt acceptance harness.
 * Metadata discovery only. Does not write canonical records.
 * automaticAttach: false.
 */

import { createSupabaseClientMemoryStore } from "@/lib/continuum/client-memory/persistence/supabase";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import {
  ACHEDEKAL_PROJECT_ID,
  isPermittedAchedekalProjectId,
} from "@/lib/continuum/gmail/achedekal-acceptance";
import {
  executeProjectArtifactHunt,
  failedArtifactHunt,
  type ArtifactHuntProject,
  type ArtifactHuntState,
} from "@/lib/continuum/gmail/artifact-hunt";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import type { ExistingProjectBook } from "@/lib/continuum/gmail/project-book-containment";

export async function findAchedekalArtifactCandidates(
  _prev: ArtifactHuntState | null,
  _formData: FormData,
): Promise<ArtifactHuntState> {
  const auth = await getAuthenticatedGmailHistoryStores();
  if (!auth.ok) {
    return failedArtifactHunt(
      auth.reason === "unauthorized" ? "unauthorized" : "index-unavailable",
    );
  }

  const deskAuth = await getAuthenticatedProjectDeskReader();
  if (!deskAuth.ok) {
    return failedArtifactHunt(
      deskAuth.reason === "unauthorized" ? "unauthorized" : "index-unavailable",
    );
  }

  let memory: ReturnType<typeof createSupabaseClientMemoryStore>;
  try {
    memory = createSupabaseClientMemoryStore();
  } catch {
    return failedArtifactHunt("index-unavailable");
  }

  const internalEmailHashes = auth.connections
    ? [((await auth.connections.getFounderConnection())?.mailboxEmailHash ?? "")]
        .filter(Boolean)
    : [];

  return executeProjectArtifactHunt({
    founderSessionOk: true,
    projectId: ACHEDEKAL_PROJECT_ID,
    catalog: {
      async getProject(projectId: string): Promise<ArtifactHuntProject | null> {
        if (!isPermittedAchedekalProjectId(projectId)) return null;
        const history = await memory.getProjectHistory(ACHEDEKAL_PROJECT_ID);
        if (!history || !isPermittedAchedekalProjectId(history.projectId)) {
          return null;
        }
        const desk = await deskAuth.reader.getProjectDesk(ACHEDEKAL_PROJECT_ID);
        const personId = desk.ok ? (desk.desk.people[0]?.personId ?? null) : null;
        let personEmailHash: string | null = null;
        if (personId) {
          const person = await memory.getPersonProfile(personId);
          personEmailHash = person?.email ? (hashEmail(person.email) ?? null) : null;
        }
        return {
          projectId: ACHEDEKAL_PROJECT_ID,
          title: desk.ok ? desk.desk.title : "A. Achedekal",
          gmailThreadId: history.gmailThreadId,
          cadJobNumber: history.cadJobNumber,
          orderNumber: history.orderNumber,
          fingerSize: history.fingerSize,
          metal: history.metal,
          centerStone: history.centerStone,
          personId,
          personEmailHash,
          personEmailHashes: personEmailHash ? [personEmailHash] : [],
          lifecycle: "historical_closed",
        };
      },
      async listProjectBooks(): Promise<ExistingProjectBook[]> {
        const listed = await deskAuth.reader.listProjects();
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
      },
    },
    index: auth.index,
    attachments: auth.attachments,
    internalEmailHashes,
  });
}
