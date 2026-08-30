/**
 * Generic Cohort 1 reconstruction read model.
 * Reuses Project Desk, candidate discovery, Artifact Hunt, and the
 * reconstruction proposal builder. Does not write canonical records.
 * Does not fetch Gmail thread bodies or attachment bytes on compose.
 */

import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import type { ProjectHistory } from "@/lib/continuum/client-memory/types";
import { classifyIdentifierSpecificity } from "./identifier-specificity";
import {
  executeProjectCandidateDiscovery,
  type AchedekalDiscoveryAttachments,
  type AchedekalDiscoveryCatalog,
  type AchedekalDiscoveryIndex,
  type AchedekalDiscoveryProject,
  type AchedekalDiscoveryState,
} from "./achedekal-candidate-discovery";
import {
  executeProjectArtifactHunt,
  type ArtifactHuntAttachments,
  type ArtifactHuntCatalog,
  type ArtifactHuntIndex,
  type ArtifactHuntProject,
  type ArtifactHuntState,
} from "./artifact-hunt";
import type { ExistingProjectBook } from "./project-book-containment";
import {
  presentIndexedProjectReconstructionProposal,
  reconstructionProposalView,
  type ProjectReconstructionProposal,
  type ReconstructionProposalView,
} from "./reconstruction-proposal";
import {
  collectProjectScopedRecoveredSnippets,
  type RecoveredProjectMetadataSnippet,
} from "./reconstruction-evidence-support";
import {
  COHORT_DISCOVERY_HYDRATE_CAP,
  COHORT_IDENTIFIER_TOKEN_LIMIT,
  COHORT_MUTATION_BOUNDARY,
  RECONSTRUCTION_COHORT_1_LIFECYCLE_LABEL,
  cohort1LabelFor,
} from "./reconstruction-cohort";
import type { ReconstructionPerson } from "./project-reconstruction";
import type { ExactThreadCurrentSpecs } from "./reconstruction-evidence";

export type CohortStoredFlag =
  | "finger_size"
  | "order_number"
  | "cad_job_number"
  | "gmail_thread_id";

export type CohortIndexSummary = {
  projectId: string;
  label: string;
  title: string;
  personLinked: boolean;
  personCount: number;
  storedGmailAnchor: boolean;
  storedThreadIndexStatus: "indexed" | "empty-index" | "no-stored-thread";
  strongCad: boolean;
  weakOrder: boolean;
  attachmentMetadataCount: number;
  indexedMessageCount: number;
  suspiciousStored: CohortStoredFlag[];
  reviewOnly: true;
  automaticApply: false;
};

export type CohortQueryBounds = {
  projectReads: number;
  historyReads: number;
  threadReads: number;
  attachmentIndexSearches: number;
  candidateDiscoveryQueries: number;
  hydrateCap: typeof COHORT_DISCOVERY_HYDRATE_CAP;
  identifierTokenLimit: typeof COHORT_IDENTIFIER_TOKEN_LIMIT;
  fullMailboxScan: false;
};

export type CohortProjectReview = {
  projectId: string;
  label: string;
  title: string;
  personLinked: boolean;
  personCount: number;
  storedGmailAnchor: boolean;
  storedThreadIndexStatus: "indexed" | "empty-index" | "no-stored-thread";
  currentStored: readonly { label: string; value: string }[];
  suspiciousStored: CohortStoredFlag[];
  proposal: ProjectReconstructionProposal;
  proposalView: ReconstructionProposalView;
  discovery: AchedekalDiscoveryState;
  hunt: ArtifactHuntState;
  queryBounds: CohortQueryBounds;
  reviewOnly: true;
  automaticApply: false;
  proposedCanonicalWrites: [];
  mutationBoundary: typeof COHORT_MUTATION_BOUNDARY;
};

export function isSuspiciousFingerSize(value: string | null | undefined): boolean {
  const raw = (value ?? "").trim();
  if (!raw) return false;
  if (/^\d{3,}$/.test(raw)) return true;
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    return n < 1 || n > 20;
  }
  return false;
}

export function isWeakOrSuspiciousOrder(
  value: string | null | undefined,
): boolean {
  const raw = (value ?? "").trim();
  if (!raw) return false;
  if (raw.includes("/")) return true;
  return classifyIdentifierSpecificity(raw) !== "strong_structured";
}

export function suspiciousStoredFlags(input: {
  fingerSize?: string | null;
  orderNumber?: string | null;
}): CohortStoredFlag[] {
  const flags: CohortStoredFlag[] = [];
  if (isSuspiciousFingerSize(input.fingerSize)) flags.push("finger_size");
  if (isWeakOrSuspiciousOrder(input.orderNumber)) flags.push("order_number");
  return flags;
}

export function specsFromHistory(
  history: Pick<
    ProjectHistory,
    "fingerSize" | "orderNumber" | "cadJobNumber" | "metal" | "centerStone"
  > | null,
): ExactThreadCurrentSpecs {
  return {
    fingerSize: history?.fingerSize ?? null,
    orderNumber: history?.orderNumber ?? null,
    cadJobNumber: history?.cadJobNumber ?? null,
    metal: history?.metal ?? null,
    centerStone: history?.centerStone ?? null,
  };
}

export function summarizeCohortProject(input: {
  projectId: string;
  title: string;
  personCount: number;
  gmailThreadId: string | null;
  cadJobNumber: string | null;
  orderNumber: string | null;
  fingerSize: string | null;
  indexedMessageCount: number;
  attachmentMetadataCount: number;
}): CohortIndexSummary {
  const storedGmailAnchor = Boolean(input.gmailThreadId?.trim());
  const storedThreadIndexStatus: CohortIndexSummary["storedThreadIndexStatus"] =
    !storedGmailAnchor
      ? "no-stored-thread"
      : input.indexedMessageCount > 0
        ? "indexed"
        : "empty-index";
  const cad = input.cadJobNumber?.trim() ?? "";
  return {
    projectId: input.projectId,
    label: cohort1LabelFor(input.projectId) ?? "Project",
    title: input.title,
    personLinked: input.personCount > 0,
    personCount: input.personCount,
    storedGmailAnchor,
    storedThreadIndexStatus,
    strongCad:
      cad.length > 0 && classifyIdentifierSpecificity(cad) === "strong_structured",
    weakOrder: isWeakOrSuspiciousOrder(input.orderNumber),
    attachmentMetadataCount: input.attachmentMetadataCount,
    indexedMessageCount: input.indexedMessageCount,
    suspiciousStored: suspiciousStoredFlags({
      fingerSize: input.fingerSize,
      orderNumber: input.orderNumber,
    }),
    reviewOnly: true,
    automaticApply: false,
  };
}

export type CohortComposeCatalog = {
  getDiscoveryProject(): Promise<AchedekalDiscoveryProject | null>;
  getHuntProject(projectId: string): Promise<ArtifactHuntProject | null>;
  listProjectBooks(): Promise<readonly ExistingProjectBook[]>;
};

export function recoveredMetadataFromCohortReview(input: {
  projectId: string;
  storedThreadId: string | null;
  indexedMessages: readonly GmailIndexedMessage[];
  discovery: AchedekalDiscoveryState;
  hunt: ArtifactHuntState;
}): RecoveredProjectMetadataSnippet[] {
  const projectId = input.projectId.trim();
  const storedThreadId = input.storedThreadId?.trim() || null;
  const storedThreadSubjects: {
    threadId: string;
    messageId: string | null;
    subject: string | null;
  }[] = input.indexedMessages
    .filter((row) => storedThreadId != null && row.threadId === storedThreadId)
    .map((row) => ({
      threadId: row.threadId,
      messageId: row.messageId,
      subject: row.subject,
    }));
  if (input.discovery.ok && input.discovery.knownThread?.subject) {
    storedThreadSubjects.push({
      threadId: input.discovery.knownThread.threadId,
      messageId: null,
      subject: input.discovery.knownThread.subject,
    });
  }
  return collectProjectScopedRecoveredSnippets({
    targetProjectId: projectId,
    storedThreadSubjects,
    candidateThreadSubjects: input.discovery.ok
      ? input.discovery.related.map((row) => ({
          threadId: row.threadId,
          subject: row.subject,
          attributedProjectId: projectId,
        }))
      : [],
    artifactMetadata: input.hunt.ok
      ? input.hunt.likely.map((row) => ({
          filename: row.filename,
          subject: row.subject,
          threadId: row.source.threadId,
          messageId: row.source.messageId,
          attributedProjectId:
            row.attachedProjectId ??
            (row.attribution === "exact_project" ? projectId : null),
          spanningProjectIds: row.spanningProjectIds,
        }))
      : [],
  });
}

export async function composeCohortProjectReview(input: {
  founderSessionOk: boolean;
  projectId: string;
  title: string;
  personCount: number;
  existingPerson: ReconstructionPerson | null;
  history: ProjectHistory | null;
  catalog: CohortComposeCatalog;
  index: AchedekalDiscoveryIndex & ArtifactHuntIndex;
  attachments: AchedekalDiscoveryAttachments & ArtifactHuntAttachments;
  internalEmailHashes?: readonly string[];
}): Promise<CohortProjectReview> {
  const projectId = input.projectId.trim();
  const specs = specsFromHistory(input.history);
  const storedThreadId = input.history?.gmailThreadId?.trim() || null;

  const discoveryCatalog: AchedekalDiscoveryCatalog = {
    getTargetProject: () => input.catalog.getDiscoveryProject(),
    listProjectBooks: () => input.catalog.listProjectBooks(),
  };
  const huntCatalog: ArtifactHuntCatalog = {
    getProject: (id) => input.catalog.getHuntProject(id),
    listProjectBooks: () => input.catalog.listProjectBooks(),
  };

  const [discovery, hunt, indexedMessages] = await Promise.all([
    executeProjectCandidateDiscovery({
      founderSessionOk: input.founderSessionOk,
      requestedProjectId: projectId,
      catalog: discoveryCatalog,
      index: input.index,
      attachments: input.attachments,
      internalEmailHashes: input.internalEmailHashes,
      projectName: input.title,
      lifecycleLabel: RECONSTRUCTION_COHORT_1_LIFECYCLE_LABEL,
    }),
    executeProjectArtifactHunt({
      founderSessionOk: input.founderSessionOk,
      projectId,
      catalog: huntCatalog,
      index: input.index,
      attachments: input.attachments,
      internalEmailHashes: input.internalEmailHashes,
    }),
    storedThreadId
      ? input.index.listMessagesByThread(storedThreadId)
      : Promise.resolve([] as GmailIndexedMessage[]),
  ]);

  const recoveredProjectMetadata = recoveredMetadataFromCohortReview({
    projectId,
    storedThreadId,
    indexedMessages,
    discovery,
    hunt,
  });
  const proposal = presentIndexedProjectReconstructionProposal({
    projectId,
    currentStored: specs,
    existingPerson: input.existingPerson,
    indexedMessages,
    storedThreadId,
    recoveredProjectMetadata,
  });

  const indexedMessageCount = indexedMessages.length;
  const attachmentMetadataCount = hunt.ok
    ? hunt.likely.length + hunt.ambiguous.length + hunt.unassigned.length
    : 0;
  const summary = summarizeCohortProject({
    projectId,
    title: input.title,
    personCount: input.personCount,
    gmailThreadId: storedThreadId,
    cadJobNumber: specs.cadJobNumber,
    orderNumber: specs.orderNumber,
    fingerSize: specs.fingerSize,
    indexedMessageCount,
    attachmentMetadataCount,
  });

  const huntQueries = hunt.ok ? hunt.queryShape : null;
  const queryBounds: CohortQueryBounds = {
    projectReads: 1,
    historyReads: 1,
    threadReads:
      (storedThreadId ? 1 : 0) +
      (discovery.ok ? discovery.hydratedThreadCount : 0) +
      (huntQueries?.threadHydrations ?? 0),
    attachmentIndexSearches:
      (huntQueries?.storedThreadQueries ?? 0) +
      (huntQueries?.filenameTokenQueries ?? 0),
    candidateDiscoveryQueries: discovery.ok
      ? 1 + (storedThreadId ? 1 : 0)
      : 0,
    hydrateCap: COHORT_DISCOVERY_HYDRATE_CAP,
    identifierTokenLimit: COHORT_IDENTIFIER_TOKEN_LIMIT,
    fullMailboxScan: false,
  };

  return {
    projectId,
    label: summary.label,
    title: input.title,
    personLinked: summary.personLinked,
    personCount: input.personCount,
    storedGmailAnchor: summary.storedGmailAnchor,
    storedThreadIndexStatus: summary.storedThreadIndexStatus,
    currentStored: [
      { label: "Finger size", value: specs.fingerSize ?? "—" },
      { label: "Order", value: specs.orderNumber ?? "—" },
      { label: "CAD", value: specs.cadJobNumber ?? "—" },
      { label: "Metal", value: specs.metal ?? "—" },
      { label: "Center stone", value: specs.centerStone ?? "—" },
    ],
    suspiciousStored: summary.suspiciousStored,
    proposal,
    proposalView: reconstructionProposalView(proposal),
    discovery,
    hunt,
    queryBounds,
    reviewOnly: true,
    automaticApply: false,
    proposedCanonicalWrites: [],
    mutationBoundary: COHORT_MUTATION_BOUNDARY,
  };
}
