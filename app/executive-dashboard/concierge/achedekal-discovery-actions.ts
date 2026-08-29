"use server";

import { createSupabaseClientMemoryStore } from "@/lib/continuum/client-memory/persistence/supabase";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import {
  ACHEDEKAL_PROJECT_ID,
  isPermittedAchedekalProjectId,
} from "@/lib/continuum/gmail/achedekal-acceptance";
import {
  executeAchedekalCandidateDiscovery,
  failedAchedekalDiscovery,
  type AchedekalDiscoveryProject,
  type AchedekalDiscoveryState,
} from "@/lib/continuum/gmail/achedekal-candidate-discovery";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import type { ExistingProjectBook } from "@/lib/continuum/gmail/project-book-containment";

export async function findAchedekalRelatedThreads(
  _prev: AchedekalDiscoveryState | null,
  _formData: FormData,
): Promise<AchedekalDiscoveryState> {
  const auth = await getAuthenticatedGmailHistoryStores();
  if (!auth.ok) {
    return failedAchedekalDiscovery(
      auth.reason === "unauthorized" ? "unauthorized" : "index-unavailable",
    );
  }

  const deskAuth = await getAuthenticatedProjectDeskReader();
  if (!deskAuth.ok) {
    return failedAchedekalDiscovery(
      deskAuth.reason === "unauthorized" ? "unauthorized" : "index-unavailable",
    );
  }

  let memory: ReturnType<typeof createSupabaseClientMemoryStore>;
  try {
    memory = createSupabaseClientMemoryStore();
  } catch {
    return failedAchedekalDiscovery("index-unavailable");
  }

  const internalEmailHashes = auth.connections
    ? [((await auth.connections.getFounderConnection())?.mailboxEmailHash ?? "")]
        .filter(Boolean)
    : [];

  return executeAchedekalCandidateDiscovery({
    founderSessionOk: true,
    catalog: {
      async getTargetProject(): Promise<AchedekalDiscoveryProject | null> {
        const history = await memory.getProjectHistory(ACHEDEKAL_PROJECT_ID);
        if (!history || !isPermittedAchedekalProjectId(history.projectId)) return null;
        const desk = await deskAuth.reader.getProjectDesk(ACHEDEKAL_PROJECT_ID);
        const personId = desk.ok ? (desk.desk.people[0]?.personId ?? null) : null;
        let personEmailHash: string | null = null;
        if (personId) {
          const person = await memory.getPersonProfile(personId);
          personEmailHash = person?.email ? (hashEmail(person.email) ?? null) : null;
        }
        return {
          projectId: ACHEDEKAL_PROJECT_ID,
          gmailThreadId: history.gmailThreadId,
          cadJobNumber: history.cadJobNumber,
          orderNumber: history.orderNumber,
          fingerSize: history.fingerSize,
          metal: history.metal,
          centerStone: history.centerStone,
          personId,
          personEmailHash,
          personEmailHashes: personEmailHash ? [personEmailHash] : [],
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
