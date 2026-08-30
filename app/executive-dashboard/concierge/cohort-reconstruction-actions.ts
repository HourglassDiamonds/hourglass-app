"use server";

/**
 * Founder-only Cohort 1 reconstruction actions.
 * Bounded to the Cohort 1 Project Book set. Read-only.
 * Does not take Gmail thread ids or queries from the browser.
 */

import { createSupabaseClientMemoryStore } from "@/lib/continuum/client-memory/persistence/supabase";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { createLiveGmailApi } from "@/lib/continuum/gmail/adapter";
import {
  executeProjectCandidateDiscovery,
  failedAchedekalDiscovery,
  type AchedekalDiscoveryProject,
  type AchedekalDiscoveryState,
} from "@/lib/continuum/gmail/achedekal-candidate-discovery";
import {
  executeProjectEvidenceReview,
  failedAchedekalReview,
  pointerFromProjectHistory,
  type AchedekalReviewState,
} from "@/lib/continuum/gmail/achedekal-review";
import {
  executeProjectArtifactHunt,
  failedArtifactHunt,
  type ArtifactHuntProject,
  type ArtifactHuntState,
} from "@/lib/continuum/gmail/artifact-hunt";
import { lookupFromGetProjectHistory } from "@/lib/continuum/gmail/exact-thread";
import {
  getAuthenticatedGmailConnectionStore,
  getAuthenticatedGmailHistoryStores,
} from "@/lib/continuum/gmail/load";
import { liveGmailAccessTokenRefresher } from "@/lib/continuum/gmail/oauth";
import {
  RECONSTRUCTION_COHORT_1_LIFECYCLE_LABEL,
  isPermittedCohort1ProjectId,
} from "@/lib/continuum/gmail/reconstruction-cohort";
import { listReconstructionProjectBooks } from "@/lib/continuum/gmail/cohort-reconstruction-load";
import { decryptRefreshToken, loadGmailTokenKek } from "@/lib/continuum/gmail/token-crypto";

async function cohortStores() {
  const auth = await getAuthenticatedGmailHistoryStores();
  if (!auth.ok) return { ok: false as const, reason: auth.reason };
  const deskAuth = await getAuthenticatedProjectDeskReader();
  if (!deskAuth.ok) {
    return { ok: false as const, reason: deskAuth.reason };
  }
  let memory: ReturnType<typeof createSupabaseClientMemoryStore>;
  try {
    memory = createSupabaseClientMemoryStore();
  } catch {
    return { ok: false as const, reason: "unavailable" as const };
  }
  const internalEmailHashes = auth.connections
    ? [((await auth.connections.getFounderConnection())?.mailboxEmailHash ?? "")]
        .filter(Boolean)
    : [];
  return {
    ok: true as const,
    auth,
    deskAuth,
    memory,
    internalEmailHashes,
  };
}

async function targetDiscoveryProject(
  projectId: string,
  stores: Exclude<Awaited<ReturnType<typeof cohortStores>>, { ok: false }>,
): Promise<AchedekalDiscoveryProject | null> {
  const history = await stores.memory.getProjectHistory(projectId);
  if (!history || history.projectId !== projectId) return null;
  const desk = await stores.deskAuth.reader.getProjectDesk(projectId);
  const personId = desk.ok ? (desk.desk.people[0]?.personId ?? null) : null;
  let personEmailHash: string | null = null;
  if (personId) {
    const person = await stores.memory.getPersonProfile(personId);
    personEmailHash = person?.email ? (hashEmail(person.email) ?? null) : null;
  }
  return {
    projectId,
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
}

export async function reviewCohortProjectGmailEvidence(
  projectId: string,
  _prev: AchedekalReviewState | null,
  _formData: FormData,
): Promise<AchedekalReviewState> {
  void _formData;
  if (!isPermittedCohort1ProjectId(projectId)) {
    return failedAchedekalReview("project-not-found");
  }
  const auth = await getAuthenticatedGmailConnectionStore();
  if (!auth.ok) {
    return failedAchedekalReview(
      auth.reason === "unauthorized" ? "unauthorized" : "connection-unavailable",
    );
  }
  const deskAuth = await getAuthenticatedProjectDeskReader();
  const kek = loadGmailTokenKek();
  if (!kek.ok) return failedAchedekalReview("connection-unavailable");
  let memory: ReturnType<typeof createSupabaseClientMemoryStore>;
  try {
    memory = createSupabaseClientMemoryStore();
  } catch {
    return failedAchedekalReview("connection-unavailable");
  }
  let projectName = "Project";
  if (deskAuth.ok) {
    const desk = await deskAuth.reader.getProjectDesk(projectId);
    if (desk.ok) projectName = desk.desk.title;
  }
  return executeProjectEvidenceReview({
    founderSessionOk: true,
    projectId,
    projectName,
    lifecycleLabel: RECONSTRUCTION_COHORT_1_LIFECYCLE_LABEL,
    projects: lookupFromGetProjectHistory(async (id) => {
      if (!isPermittedCohort1ProjectId(id)) return null;
      const history = await memory.getProjectHistory(id);
      return pointerFromProjectHistory(history);
    }),
    connections: auth.store,
    decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, kek.key),
    refreshAccessToken: (refreshToken) =>
      liveGmailAccessTokenRefresher.refreshAccessToken(refreshToken),
    createApi: (accessToken) => createLiveGmailApi(accessToken),
  });
}

export async function findCohortRelatedThreads(
  projectId: string,
  _prev: AchedekalDiscoveryState | null,
  _formData: FormData,
): Promise<AchedekalDiscoveryState> {
  void _formData;
  if (!isPermittedCohort1ProjectId(projectId)) {
    return failedAchedekalDiscovery("project-not-found");
  }
  const stores = await cohortStores();
  if (!stores.ok) {
    return failedAchedekalDiscovery(
      stores.reason === "unauthorized" ? "unauthorized" : "index-unavailable",
    );
  }
  let projectName = "Project";
  const desk = await stores.deskAuth.reader.getProjectDesk(projectId);
  if (desk.ok) projectName = desk.desk.title;
  return executeProjectCandidateDiscovery({
    founderSessionOk: true,
    requestedProjectId: projectId,
    projectName,
    lifecycleLabel: RECONSTRUCTION_COHORT_1_LIFECYCLE_LABEL,
    catalog: {
      getTargetProject: () => targetDiscoveryProject(projectId, stores),
      listProjectBooks: () =>
        listReconstructionProjectBooks(stores.deskAuth.reader, stores.memory),
    },
    index: stores.auth.index,
    attachments: stores.auth.attachments,
    internalEmailHashes: stores.internalEmailHashes,
  });
}

export async function findCohortArtifactCandidates(
  projectId: string,
  _prev: ArtifactHuntState | null,
  _formData: FormData,
): Promise<ArtifactHuntState> {
  void _formData;
  if (!isPermittedCohort1ProjectId(projectId)) {
    return failedArtifactHunt("project-not-found");
  }
  const stores = await cohortStores();
  if (!stores.ok) {
    return failedArtifactHunt(
      stores.reason === "unauthorized" ? "unauthorized" : "index-unavailable",
    );
  }
  return executeProjectArtifactHunt({
    founderSessionOk: true,
    projectId,
    catalog: {
      async getProject(id: string): Promise<ArtifactHuntProject | null> {
        if (!isPermittedCohort1ProjectId(id)) return null;
        const history = await stores.memory.getProjectHistory(id);
        if (!history) return null;
        const desk = await stores.deskAuth.reader.getProjectDesk(id);
        const personId = desk.ok ? (desk.desk.people[0]?.personId ?? null) : null;
        let personEmailHash: string | null = null;
        if (personId) {
          const person = await stores.memory.getPersonProfile(personId);
          personEmailHash = person?.email
            ? (hashEmail(person.email) ?? null)
            : null;
        }
        return {
          projectId: id,
          title: desk.ok ? desk.desk.title : "Project",
          gmailThreadId: history.gmailThreadId,
          cadJobNumber: history.cadJobNumber,
          orderNumber: history.orderNumber,
          fingerSize: history.fingerSize,
          metal: history.metal,
          centerStone: history.centerStone,
          personId,
          personEmailHash,
          personEmailHashes: personEmailHash ? [personEmailHash] : [],
          lifecycle: "unknown",
        };
      },
      listProjectBooks: () =>
        listReconstructionProjectBooks(stores.deskAuth.reader, stores.memory),
    },
    index: stores.auth.index,
    attachments: stores.auth.attachments,
    internalEmailHashes: stores.internalEmailHashes,
  });
}
