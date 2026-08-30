/**
 * Founder-reviewed reconstruction proposal (Slice 3C).
 * Synthesizes stored project data, known-thread evidence, and
 * founder-reviewed artifact observations. Candidate-only.
 * Does not write Persons, specs, lifecycle, Open Jobs, Human Intake, or CoS.
 * Does not fetch Gmail, attachments, or artifact bytes.
 */

import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import {
  ACHEDEKAL_KNOWN_ARTIFACT_CAD,
  ACHEDEKAL_PROJECT_ID,
} from "./achedekal-acceptance";
import { aleaKnownThreadReconstructionInput } from "./alea-known-thread-fixture";
import {
  founderReviewedAchedekalArtifactObservation,
  type ArtifactEvidenceStrength,
  type ArtifactObservation,
  type ArtifactObservationFact,
} from "./artifact-observation";
import type { ProtectedExactThread } from "./exact-thread-payload";
import {
  reconstructProjectBook,
  RECONSTRUCTION_MUTATION_BOUNDARY,
  type ProjectBookReconstructionHandoff,
  type ReconstructedItemType,
  type ReconstructionPerson,
  type SourceNameEvidence,
} from "./project-reconstruction";
import type { ExactThreadCurrentSpecs } from "./reconstruction-evidence";

export const RECONSTRUCTION_PROPOSAL_STATUS = "review_only" as const;

export const EPISTEMIC_STAGES = [
  "reality",
  "evidence",
  "observation",
  "reasoning",
  "recommendation",
  "decision",
  "action",
] as const;

export type EpistemicStage = (typeof EPISTEMIC_STAGES)[number];

export type ReconstructionProposalFactSource =
  | "artifact"
  | "known_thread"
  | "stored_project"
  | "founder_reported";

export type ReconstructionProposalFact = {
  field: string;
  value: string;
  source: ReconstructionProposalFactSource;
  evidenceStrength: ArtifactEvidenceStrength;
  canonical: false;
  founderReviewed: boolean;
  sourceArtifact?: string;
  sourceThreadId?: string;
  sourceProjectId?: string;
  cadIdentifier?: string;
  category?: ArtifactObservationFact["category"];
  mapsToFingerSize: false;
};

export type ConflictingStoredDatum = {
  field: "finger_size" | "order_number";
  label: "Finger size" | "Order";
  storedValue: string;
  status:
    | "unsupported_conflicting_with_item_context"
    | "unsupported";
  currentStored: true;
  recoveredEvidence: false;
  deleted: false;
  corrected: false;
  transformed: false;
  reviewNote: string;
};

export type FounderReportedContextItem = {
  field: string;
  value: string;
  source: "founder_reported";
  canonical: false;
  reconciledToArtifact: false;
  reconciledToCanonicalProject: false;
};

export type ReconstructionProposalEpistemicBoundary = {
  authorizedThrough: "observation";
  recommendationAuthorized: false;
  decisionAuthorized: false;
  actionAuthorized: false;
  cadImpliesSold: false;
  founderReviewImpliesDesignApproval: false;
  braceletCadImpliesDelivered: false;
  automaticApply: false;
};

export type BraceletLengthProposal = {
  finishedLengthShown: string;
  extenderLengthShown: string;
  sizeType: "bracelet_length";
  mapsToFingerSize: false;
  source: "artifact";
};

export type CadComponentDimensions = {
  overallLength: string;
  bodyDetail: string;
  height: string;
  sideProfile: string;
  category: "cad_component";
  notGemstoneDimensions: true;
};

export type ProjectReconstructionProposal = {
  projectId: string;
  status: typeof RECONSTRUCTION_PROPOSAL_STATUS;
  supportedFacts: ReconstructionProposalFact[];
  unresolvedFacts: ReconstructionProposalFact[];
  conflictingStoredData: ConflictingStoredDatum[];
  founderReportedContext: FounderReportedContextItem[];
  proposedCanonicalWrites: [];
  automaticApply: false;
  itemTypeFromTextOnly: ReconstructedItemType;
  itemTypeCandidate: ReconstructedItemType;
  projectState: "unknown";
  lifecycle: "historical_closed";
  designArtifactPresent: boolean;
  artifactReviewedByFounder: boolean;
  approvedDesign: false;
  approvedForProduction: false;
  completed: false;
  sold: false;
  completedSold: false;
  approvedInProduction: false;
  braceletLength: BraceletLengthProposal | null;
  cadComponentDimensions: CadComponentDimensions | null;
  stoneLayout: {
    shape: string | null;
    size: string | null;
    quantity: string | null;
    material: null;
    color: null;
    origin: null;
    caratWeight: null;
  };
  epistemicBoundary: ReconstructionProposalEpistemicBoundary;
  mutationBoundary: typeof RECONSTRUCTION_MUTATION_BOUNDARY;
};

export type ReconstructionProposalInput = {
  textReconstruction: ProjectBookReconstructionHandoff;
  currentStored: ExactThreadCurrentSpecs;
  artifactObservation: ArtifactObservation | null;
  founderReportedContext?: readonly FounderReportedContextItem[];
};

const EPISTEMIC_BOUNDARY: ReconstructionProposalEpistemicBoundary = {
  authorizedThrough: "observation",
  recommendationAuthorized: false,
  decisionAuthorized: false,
  actionAuthorized: false,
  cadImpliesSold: false,
  founderReviewImpliesDesignApproval: false,
  braceletCadImpliesDelivered: false,
  automaticApply: false,
};

function cloneFounderContext(
  rows: readonly FounderReportedContextItem[] | undefined,
): FounderReportedContextItem[] {
  return (rows ?? []).map((row) => ({
    field: row.field,
    value: row.value,
    source: "founder_reported",
    canonical: false,
    reconciledToArtifact: false,
    reconciledToCanonicalProject: false,
  }));
}

function fromArtifact(
  row: ArtifactObservationFact,
): ReconstructionProposalFact {
  return {
    field: row.field,
    value: row.observedValue,
    source: "artifact",
    evidenceStrength: row.evidenceStrength,
    canonical: false,
    founderReviewed: true,
    sourceArtifact: row.sourceArtifact,
    sourceThreadId: row.sourceThreadId,
    sourceProjectId: row.sourceProjectId,
    cadIdentifier: row.cadIdentifier,
    category: row.category,
    mapsToFingerSize: false,
  };
}

function unresolved(
  field: string,
  value: string,
): ReconstructionProposalFact {
  return {
    field,
    value,
    source: "known_thread",
    evidenceStrength: "unresolved",
    canonical: false,
    founderReviewed: false,
    mapsToFingerSize: false,
  };
}

function hasArtifactField(
  observation: ArtifactObservation | null,
  field: ArtifactObservationFact["field"],
): ArtifactObservationFact | undefined {
  return observation?.observations.find((row) => row.field === field);
}

function quarantineStoredData(
  currentStored: ExactThreadCurrentSpecs,
  itemTypeCandidate: ReconstructedItemType,
): ConflictingStoredDatum[] {
  const rows: ConflictingStoredDatum[] = [];
  const fingerSize = currentStored.fingerSize?.trim() ?? "";
  if (fingerSize) {
    rows.push({
      field: "finger_size",
      label: "Finger size",
      storedValue: fingerSize,
      status:
        itemTypeCandidate === "bracelet"
          ? "unsupported_conflicting_with_item_context"
          : "unsupported",
      currentStored: true,
      recoveredEvidence: false,
      deleted: false,
      corrected: false,
      transformed: false,
      reviewNote:
        itemTypeCandidate === "bracelet"
          ? "Not supported by recovered evidence for this bracelet project."
          : "Not supported by recovered evidence.",
    });
  }
  const orderNumber = currentStored.orderNumber?.trim() ?? "";
  if (orderNumber) {
    rows.push({
      field: "order_number",
      label: "Order",
      storedValue: orderNumber,
      status: "unsupported",
      currentStored: true,
      recoveredEvidence: false,
      deleted: false,
      corrected: false,
      transformed: false,
      reviewNote: "Not independently supported by recovered evidence.",
    });
  }
  return rows;
}

export function buildProjectReconstructionProposal(
  input: ReconstructionProposalInput,
): ProjectReconstructionProposal {
  const textItem = input.textReconstruction.items[0];
  const itemTypeFromTextOnly = textItem?.itemType ?? "unknown";
  const observation = input.artifactObservation;
  const itemTypeObservation = hasArtifactField(observation, "item_type");
  const itemTypeCandidate: ReconstructedItemType =
    itemTypeObservation?.observedValue === "bracelet"
      ? "bracelet"
      : itemTypeFromTextOnly;

  const supportedFacts: ReconstructionProposalFact[] = [];
  if (observation) {
    for (const row of observation.observations) {
      supportedFacts.push(fromArtifact(row));
    }
    supportedFacts.push({
      field: "design_artifact_present",
      value: "true",
      source: "artifact",
      evidenceStrength: "explicit",
      canonical: false,
      founderReviewed: true,
      sourceArtifact: observation.artifactFilename,
      sourceThreadId: observation.sourceThreadId,
      sourceProjectId: observation.sourceProjectId,
      cadIdentifier: observation.cadIdentifier,
      mapsToFingerSize: false,
    });
    supportedFacts.push({
      field: "artifact_reviewed_by_founder",
      value: "true",
      source: "artifact",
      evidenceStrength: "explicit",
      canonical: false,
      founderReviewed: true,
      sourceArtifact: observation.artifactFilename,
      sourceThreadId: observation.sourceThreadId,
      sourceProjectId: observation.sourceProjectId,
      cadIdentifier: observation.cadIdentifier,
      mapsToFingerSize: false,
    });
  } else if (textItem?.designArtifactPresent) {
    supportedFacts.push({
      field: "design_artifact_present",
      value: "true",
      source: "known_thread",
      evidenceStrength: "strong",
      canonical: false,
      founderReviewed: false,
      mapsToFingerSize: false,
    });
  }

  const cadFromText = textItem?.cadJobNumbers[0]?.proposedValue ?? null;
  if (
    cadFromText &&
    !supportedFacts.some((row) => row.field === "cad_identifier")
  ) {
    supportedFacts.push({
      field: "cad_identifier",
      value: cadFromText,
      source: "known_thread",
      evidenceStrength: "strong",
      canonical: false,
      founderReviewed: false,
      mapsToFingerSize: false,
    });
  }

  const finished = hasArtifactField(observation, "finished_length");
  const extender = hasArtifactField(observation, "extender_length");
  const braceletLength: BraceletLengthProposal | null =
    finished && extender
      ? {
          finishedLengthShown: finished.observedValue,
          extenderLengthShown: extender.observedValue,
          sizeType: "bracelet_length",
          mapsToFingerSize: false,
          source: "artifact",
        }
      : null;

  const overall = hasArtifactField(observation, "cad_component_overall_length");
  const body = hasArtifactField(observation, "cad_component_body_detail");
  const height = hasArtifactField(observation, "cad_component_height");
  const side = hasArtifactField(observation, "cad_component_side_profile");
  const cadComponentDimensions: CadComponentDimensions | null =
    overall && body && height && side
      ? {
          overallLength: overall.observedValue,
          bodyDetail: body.observedValue,
          height: height.observedValue,
          sideProfile: side.observedValue,
          category: "cad_component",
          notGemstoneDimensions: true,
        }
      : null;

  const shape = hasArtifactField(observation, "stone_shape");
  const size = hasArtifactField(observation, "stone_size");
  const quantity = hasArtifactField(observation, "stone_quantity");

  const unresolvedFacts: ReconstructionProposalFact[] = [
    unresolved("completion_sale_status", "unknown"),
    unresolved("client_approval", "unknown"),
    unresolved("stone_material_color", "unknown"),
    unresolved("commercial_order_identity", "unknown"),
    unresolved("canonical_person_identity", "unknown"),
    unresolved("final_metal", "unknown"),
    unresolved("project_state", "unknown"),
  ];

  return {
    projectId: input.textReconstruction.projectId,
    status: RECONSTRUCTION_PROPOSAL_STATUS,
    supportedFacts,
    unresolvedFacts,
    conflictingStoredData: quarantineStoredData(
      input.currentStored,
      itemTypeCandidate,
    ),
    founderReportedContext: cloneFounderContext(input.founderReportedContext),
    proposedCanonicalWrites: [],
    automaticApply: false,
    itemTypeFromTextOnly,
    itemTypeCandidate,
    projectState: "unknown",
    lifecycle: "historical_closed",
    designArtifactPresent: Boolean(
      textItem?.designArtifactPresent || observation,
    ),
    artifactReviewedByFounder: Boolean(observation?.founderReviewed),
    approvedDesign: false,
    approvedForProduction: false,
    completed: false,
    sold: false,
    completedSold: false,
    approvedInProduction: false,
    braceletLength,
    cadComponentDimensions,
    stoneLayout: {
      shape: shape?.observedValue ?? null,
      size: size?.observedValue ?? null,
      quantity: quantity?.observedValue ?? null,
      material: null,
      color: null,
      origin: null,
      caratWeight: null,
    },
    epistemicBoundary: EPISTEMIC_BOUNDARY,
    mutationBoundary: RECONSTRUCTION_MUTATION_BOUNDARY,
  };
}

export type AchedekalReconstructionProposalInput = {
  currentStored?: Pick<ExactThreadCurrentSpecs, "fingerSize" | "orderNumber">;
  founderReportedContext?: readonly FounderReportedContextItem[];
};

export function presentAchedekalReconstructionProposal(
  input: AchedekalReconstructionProposalInput = {},
): ProjectReconstructionProposal {
  const known = aleaKnownThreadReconstructionInput();
  const textReconstruction = reconstructProjectBook(known);
  return buildProjectReconstructionProposal({
    textReconstruction,
    currentStored: {
      ...known.currentSpecs,
      // Live Project Desk overlay only. Never substitute fixture 141/140.
      fingerSize: input.currentStored?.fingerSize ?? null,
      orderNumber: input.currentStored?.orderNumber ?? null,
    },
    artifactObservation: founderReviewedAchedekalArtifactObservation(),
    founderReportedContext: input.founderReportedContext,
  });
}

export function emptyProtectedExactThread(threadId: string): ProtectedExactThread {
  const id = threadId.trim();
  return {
    threadId: id || "no-stored-thread",
    messages: [],
  };
}

export type IndexedProjectReconstructionProposalInput = {
  projectId: string;
  currentStored: ExactThreadCurrentSpecs;
  existingPerson: ReconstructionPerson | null;
  sourceNameEvidence?: readonly SourceNameEvidence[];
  indexedMessages: readonly GmailIndexedMessage[];
  storedThreadId: string | null;
  thread?: ProtectedExactThread | null;
};

export function presentIndexedProjectReconstructionProposal(
  input: IndexedProjectReconstructionProposalInput,
): ProjectReconstructionProposal {
  const thread =
    input.thread ?? emptyProtectedExactThread(input.storedThreadId ?? "");
  const textReconstruction = reconstructProjectBook({
    projectId: input.projectId,
    currentSpecs: input.currentStored,
    currentLifecycle: "unknown",
    existingPerson: input.existingPerson,
    sourceNameEvidence: input.sourceNameEvidence ?? [],
    thread,
    indexedMessages: input.indexedMessages,
  });
  return buildProjectReconstructionProposal({
    textReconstruction,
    currentStored: input.currentStored,
    artifactObservation: null,
  });
}

export type ReconstructionProposalViewRow = {
  label: string;
  value: string;
  note?: string;
};

export type ReconstructionProposalView = {
  heading: "Reconstruction proposal";
  supportedHeading: "Supported by recovered evidence";
  unresolvedHeading: "Unresolved";
  storedHeading: "Current stored data needing review";
  storedBanner: "Current stored data — not supported by recovered evidence";
  noChangesCopy: "No project changes have been applied";
  applyButton: false;
  automaticApply: false;
  projectId: string;
  cadIdentifier: string;
  supportedFacts: ReconstructionProposalViewRow[];
  componentDimensions: ReconstructionProposalViewRow[];
  unresolvedFacts: ReconstructionProposalViewRow[];
  conflictingStoredData: ReconstructionProposalViewRow[];
};

function itemTypeLabel(type: ReconstructedItemType): string {
  if (type === "unknown") return "Unknown";
  if (type === "loose_stones") return "Loose stones";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function stoneLayoutLabel(proposal: ProjectReconstructionProposal): string | null {
  const { quantity, shape, size } = proposal.stoneLayout;
  if (!quantity || !shape || !size) return null;
  const shapeLabel = /marquise/i.test(shape) ? "marquise (MQ)" : shape;
  return `${quantity} × ${shapeLabel}, ${size}`;
}

export function reconstructionProposalView(
  proposal: ProjectReconstructionProposal,
): ReconstructionProposalView {
  const item = itemTypeLabel(proposal.itemTypeCandidate);
  const cadFromFacts = proposal.supportedFacts.find(
    (row) => row.field === "cad_identifier",
  )?.value;
  const cad =
    cadFromFacts ||
    (proposal.projectId === ACHEDEKAL_PROJECT_ID
      ? ACHEDEKAL_KNOWN_ARTIFACT_CAD
      : "");
  const supportedFacts: ReconstructionProposalViewRow[] = [
    { label: "Item", value: item },
  ];
  if (cad) {
    supportedFacts.push({ label: "CAD", value: cad });
  }
  if (proposal.braceletLength) {
    supportedFacts.push({
      label: "Finished length shown",
      value: proposal.braceletLength.finishedLengthShown,
    });
    supportedFacts.push({
      label: "Adjustment / extender shown",
      value: proposal.braceletLength.extenderLengthShown,
    });
  }
  const layout = stoneLayoutLabel(proposal);
  if (layout) {
    supportedFacts.push({
      label: "Stone layout",
      value: layout,
    });
  }
  if (proposal.artifactReviewedByFounder) {
    supportedFacts.push({
      label: "Design artifact",
      value: "Founder reviewed",
    });
  } else if (proposal.designArtifactPresent) {
    supportedFacts.push({
      label: "Design artifact",
      value: "Present",
    });
  }

  const componentDimensions: ReconstructionProposalViewRow[] = [];
  if (proposal.cadComponentDimensions) {
    componentDimensions.push(
      {
        label: "Overall length",
        value: proposal.cadComponentDimensions.overallLength,
      },
      {
        label: "Body / detail",
        value: proposal.cadComponentDimensions.bodyDetail,
      },
      {
        label: "Height",
        value: proposal.cadComponentDimensions.height,
      },
      {
        label: "Side / profile",
        value: proposal.cadComponentDimensions.sideProfile,
      },
    );
  }

  return {
    heading: "Reconstruction proposal",
    supportedHeading: "Supported by recovered evidence",
    unresolvedHeading: "Unresolved",
    storedHeading: "Current stored data needing review",
    storedBanner: "Current stored data — not supported by recovered evidence",
    noChangesCopy: "No project changes have been applied",
    applyButton: false,
    automaticApply: false,
    projectId: proposal.projectId,
    cadIdentifier: cad,
    supportedFacts,
    componentDimensions,
    unresolvedFacts: [
      { label: "Completion / sale status", value: "Unresolved" },
      { label: "Client approval", value: "Unresolved" },
      { label: "Exact stone material/color", value: "Unresolved" },
      { label: "Final commercial order identity", value: "Unresolved" },
      { label: "Canonical client identity", value: "Unresolved" },
    ],
    conflictingStoredData: proposal.conflictingStoredData.map((row) => ({
      label: row.label,
      value: row.storedValue,
      note: row.reviewNote,
    })),
  };
}
