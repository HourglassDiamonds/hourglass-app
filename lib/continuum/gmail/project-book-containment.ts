/**
 * Project Book containment / evidence-ownership model (Slice 1B).
 * One Person → many independent Project Books.
 * Candidate contracts and mocks only. Does not write canonical truth.
 * Does not create, merge, or delete Projects. Does not alter Person.
 * Does not fetch Gmail, related threads, or attachment bytes.
 * automaticApply: false.
 */

import {
  classifyCadIdentifierStrength,
  extractCadJobIdentifiers,
} from "./cad-job-identifier";
import {
  isWeakIdentifierSpecificity,
  WEAK_IDENTIFIER_SUPPORT_SCORE,
} from "./identifier-specificity";
import {
  classifyOrderIdentifierStrength,
  extractOrderIdentifiers,
} from "./order-identifier";
import {
  classifyJewelryItemTypes,
  RECONSTRUCTION_MUTATION_BOUNDARY,
  type JewelryItemType,
  type ProjectBookReconstructionHandoff,
  type ProjectLifecycleCandidate,
  type RelatedThreadCandidate,
} from "./project-reconstruction";

export { extractOrderIdentifiers } from "./order-identifier";

export const PERSON_LEVEL_MEMORY_KINDS = [
  "canonical_identity_contact",
  "family_personal_context",
  "general_style_taste",
  "birthdays_anniversaries",
  "communication_preferences",
  "relationship_notes",
  "linked_project_books",
] as const;

export type PersonLevelMemoryKind = (typeof PERSON_LEVEL_MEMORY_KINDS)[number];

export const PROJECT_LEVEL_MEMORY_KINDS = [
  "jewelry_items",
  "project_specs",
  "cad_job_identifiers",
  "order_identifiers",
  "project_vendor_data",
  "design_decisions",
  "approvals",
  "revisions",
  "correspondence",
  "attachments_artifacts",
  "pricing_references",
  "timeline",
  "lifecycle_state",
  "reconstructed_project_evidence",
] as const;

export type ProjectLevelMemoryKind = (typeof PROJECT_LEVEL_MEMORY_KINDS)[number];

export type MemoryPlane = "person" | "project";

export const ARTIFACT_TYPES = [
  "cad_render",
  "inspiration_image",
  "invoice",
  "certificate",
  "vendor_paperwork",
  "client_image",
  "finished_photography",
  "sketch",
  "other",
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export const EVIDENCE_ATTRIBUTION_RESOLUTIONS = [
  "exact_project",
  "ambiguous_between_projects",
  "person_related_unassigned",
  "unrelated_rejected",
] as const;

export type EvidenceAttributionResolution =
  (typeof EVIDENCE_ATTRIBUTION_RESOLUTIONS)[number];

export const ATTRIBUTION_STRENGTHS = [
  "exact",
  "strong",
  "moderate",
  "weak",
  "insufficient",
] as const;

export type AttributionStrength = (typeof ATTRIBUTION_STRENGTHS)[number];

export const ATTRIBUTION_REASON_KINDS = [
  "exact_gmail_thread_anchor",
  "exact_cad_job_identifier",
  "cad_identifier_strong",
  "cad_identifier_weak_numeric",
  "cad_identifier_weak_short_structured",
  "exact_order_identifier",
  "order_identifier_weak_numeric",
  "order_identifier_weak_short_structured",
  "exact_project_artifact_reference",
  "bounded_project_date_range",
  "strong_subject_continuity",
  "project_vendor_order_context",
  "person_identity_only",
  "vendor_only",
  "vendor_supporting_only",
  "jewelry_type_only",
  "similar_stones_or_subject",
  "nearby_dates_only",
  "generic_correspondence",
  "spans_multiple_projects",
  "item_id_owned_by_project",
  "foreign_item_id",
  "unknown_item_id",
] as const;

export type AttributionReasonKind = (typeof ATTRIBUTION_REASON_KINDS)[number];

export type AttributionReason = {
  kind: AttributionReasonKind;
  value: string;
  detail: string;
};

export const COMMUNICATION_ROUTING_STATES = [
  "exact",
  "unassigned_needs_project_routing",
  "ambiguous_multi_project",
  "rejected",
] as const;

export type CommunicationRoutingState =
  (typeof COMMUNICATION_ROUTING_STATES)[number];

export const RELATED_THREAD_DISCOVERY_HANDOFF = {
  active: false,
  autoFetch: false,
  mailboxWideBodySearch: false,
  requiresFounderApprovalToFetch: true,
} as const;

export const CONTAINMENT_MUTATION_BOUNDARY = {
  ...RECONSTRUCTION_MUTATION_BOUNDARY,
  createsProjects: false,
  mergesProjects: false,
  deletesProjects: false,
  altersPerson: false,
  fetchesGmail: false,
  fetchesRelatedThreads: false,
  fetchesAttachmentBytes: false,
  writesChiefOfStaff: false,
  createsOpenJobs: false,
  createsToday5: false,
  writesHumanIntake: false,
  automaticCreate: false,
} as const;

export type ContainmentMutationBoundary = typeof CONTAINMENT_MUTATION_BOUNDARY;

const GENERIC_SUBJECT_TERMS = new Set([
  "re",
  "fw",
  "fwd",
  "hi",
  "hello",
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "for",
  "in",
  "on",
  "your",
  "our",
  "this",
  "that",
  "please",
  "see",
  "attached",
  "thanks",
  "thank",
  "you",
  "update",
  "checking",
  "just",
  "is",
]);

const EXACT_ATTACH_SCORE = 80;

export type ContainmentPerson = {
  personId: string;
  displayName: string;
};

export type ExistingProjectItem = {
  itemId: string;
  itemType: JewelryItemType;
};

export type ExistingProjectBook = {
  projectId: string;
  personId: string;
  title: string;
  lifecycle: ProjectLifecycleCandidate;
  items: readonly ExistingProjectItem[];
  cadJobNumbers: readonly string[];
  orderNumbers: readonly string[];
  gmailThreadIds: readonly string[];
  artifactRefs: readonly string[];
  vendors: readonly string[];
  subjectTerms: readonly string[];
  dateRange: { start: string; end: string } | null;
};

export type ArtifactMetadataCandidate = {
  artifactId: string;
  itemId: string | null;
  sourceMessageId: string | null;
  sourceThreadId: string | null;
  filename: string | null;
  artifactType: ArtifactType;
  bytesFetched: false;
};

export type ProjectEvidenceCandidate = {
  evidenceId: string;
  kind: "email" | "thread" | "artifact_metadata";
  personId: string | null;
  subject: string | null;
  text: string;
  sentAt: string | null;
  threadId: string | null;
  messageId: string | null;
  vendorMentions: readonly string[];
  artifact: ArtifactMetadataCandidate | null;
};

export type ProjectAttributionCandidate = {
  candidateProjectId: string;
  strength: AttributionStrength;
  score: number;
  reasons: AttributionReason[];
  requiresFounderReview: boolean;
};

export type ProjectEvidenceAttribution = {
  evidenceId: string;
  resolution: EvidenceAttributionResolution;
  candidateProjectId: string | null;
  attachedProjectId: string | null;
  spanningProjectIds: readonly string[];
  duplicatedAcrossProjects: false;
  strength: AttributionStrength;
  score: number;
  reasons: AttributionReason[];
  requiresFounderReview: boolean;
  candidates: ProjectAttributionCandidate[];
  communicationRouting: CommunicationRoutingState;
};

export type ArtifactOwnershipRecord = {
  artifactId: string;
  projectId: string | null;
  itemId: string | null;
  sourceMessageId: string | null;
  sourceThreadId: string | null;
  artifactType: ArtifactType;
  filename: string | null;
  attributionReasons: AttributionReason[];
  confidence: AttributionStrength;
  reviewState:
    | "assigned"
    | "unassigned"
    | "needs_review"
    | "rejected";
  bytesFetched: false;
};

export type PossibleNewProjectCandidate = {
  kind: "possible_new_project";
  personId: string;
  evidenceId: string;
  evidenceSummary: string;
  likelyTimePeriod: string | null;
  likelyJewelryContext: JewelryItemType[];
  requiresFounderApproval: true;
  automaticCreate: false;
};

export type ProjectBookViewContract = {
  projectId: string;
  title: string;
  lifecycle: ProjectLifecycleCandidate;
  items: readonly ExistingProjectItem[];
  specs: {
    cadJobNumbers: readonly string[];
    orderNumbers: readonly string[];
  };
  correspondence: readonly ProjectEvidenceAttribution[];
  decisions: [];
  approvals: [];
  revisions: [];
  vendors: readonly string[];
  orders: readonly string[];
  artifacts: readonly ArtifactOwnershipRecord[];
  timeline: { start: string | null; end: string | null };
  sourceEvidence: readonly ProjectEvidenceAttribution[];
  historicalSafety: {
    remainsHistorical: boolean;
    operationalIdentitySeparate: true;
    createsOpenJobs: false;
    createsToday5: false;
    writesChiefOfStaff: false;
    becomesActive: false;
    addingEvidenceIsOperational: false;
  };
  openJobs: [];
  operationalWork: [];
};

export type PersonProjectBookSummary = {
  projectId: string;
  title: string;
  lifecycle: ProjectLifecycleCandidate;
  itemCount: number;
  itemTypes: readonly JewelryItemType[];
};

export type PersonRelationshipMemory = {
  personId: string;
  displayName: string;
  kinds: readonly PersonLevelMemoryKind[];
  linkedProjectBookIds: readonly string[];
  projectEvidenceInlined: false;
};

export type PersonProjectBookListContract = {
  personId: string;
  relationshipMemory: PersonRelationshipMemory;
  projectBooks: readonly PersonProjectBookSummary[];
  inlinedHistoricalDump: false;
};

export type ProjectContainmentResult = {
  personId: string;
  projectBooks: readonly ExistingProjectBook[];
  attributions: ProjectEvidenceAttribution[];
  artifacts: ArtifactOwnershipRecord[];
  possibleNewProjects: PossibleNewProjectCandidate[];
  views: ProjectBookViewContract[];
  personList: PersonProjectBookListContract;
  relatedThreadDiscovery: typeof RELATED_THREAD_DISCOVERY_HANDOFF;
  createdProjects: [];
  mergedProjects: [];
  deletedProjects: [];
  openJobs: [];
  chiefOfStaffWrites: [];
  canonicalWrites: [];
  mutationBoundary: ContainmentMutationBoundary;
  automaticApply: false;
};

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function excerpt(text: string, max = 160): string {
  const value = compact(text);
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}…`;
}

export function memoryPlaneForKind(
  kind: PersonLevelMemoryKind | ProjectLevelMemoryKind,
): MemoryPlane {
  if ((PERSON_LEVEL_MEMORY_KINDS as readonly string[]).includes(kind)) {
    return "person";
  }
  return "project";
}

export function mayStoreOnPerson(
  kind: PersonLevelMemoryKind | ProjectLevelMemoryKind,
): boolean {
  return memoryPlaneForKind(kind) === "person";
}

function haystackOf(evidence: ProjectEvidenceCandidate): string {
  return [evidence.subject, evidence.text, evidence.artifact?.filename]
    .filter(Boolean)
    .join("\n");
}

function isGenericCorrespondence(evidence: ProjectEvidenceCandidate): boolean {
  const hay = haystackOf(evidence).toLowerCase();
  if (extractCadJobIdentifiers(hay).length > 0) return false;
  if (extractOrderIdentifiers(hay).length > 0) return false;
  if (classifyJewelryItemTypes(hay).length > 0) return false;
  const tokens = hay.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((token) => GENERIC_SUBJECT_TERMS.has(token));
}

function inDateRange(
  sentAt: string | null,
  range: ExistingProjectBook["dateRange"],
): boolean {
  if (!sentAt || !range) return false;
  const sent = Date.parse(sentAt);
  const start = Date.parse(range.start);
  const end = Date.parse(range.end);
  if (![sent, start, end].every(Number.isFinite)) return false;
  return sent >= start && sent <= end;
}

function nearbyDateOnly(
  sentAt: string | null,
  range: ExistingProjectBook["dateRange"],
): boolean {
  if (!sentAt || !range) return false;
  const sent = Date.parse(sentAt);
  const start = Date.parse(range.start);
  const end = Date.parse(range.end);
  if (![sent, start, end].every(Number.isFinite)) return false;
  if (sent >= start && sent <= end) return false;
  const windowMs = 90 * 24 * 60 * 60 * 1000;
  return sent >= start - windowMs && sent <= end + windowMs;
}

function hasToken(hay: string, token: string): boolean {
  const needle = norm(token);
  if (!needle) return false;
  return norm(hay).includes(needle);
}

function uniqueReasons(reasons: AttributionReason[]): AttributionReason[] {
  const seen = new Set<string>();
  const rows: AttributionReason[] = [];
  for (const reason of reasons) {
    const key = `${reason.kind}:${norm(reason.value)}:${reason.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(reason);
  }
  return rows;
}

function strengthForScore(score: number): AttributionStrength {
  if (score >= 100) return "exact";
  if (score >= 80) return "strong";
  if (score >= 40) return "moderate";
  if (score >= 15) return "weak";
  return "insufficient";
}

function scoreProject(
  evidence: ProjectEvidenceCandidate,
  project: ExistingProjectBook,
): ProjectAttributionCandidate {
  const hay = haystackOf(evidence);
  const reasons: AttributionReason[] = [];
  let score = 0;
  let strongIdentity = false;
  const cads = extractCadJobIdentifiers(hay);
  const orders = extractOrderIdentifiers(hay);

  if (evidence.threadId) {
    const threadHit = project.gmailThreadIds.some(
      (id) => norm(id) === norm(evidence.threadId ?? ""),
    );
    if (threadHit) {
      score += 100;
      strongIdentity = true;
      reasons.push({
        kind: "exact_gmail_thread_anchor",
        value: evidence.threadId,
        detail: `Exact stored Gmail thread matches Project ${project.projectId} only as an anchor.`,
      });
    }
  }

  for (const cad of cads) {
    if (!project.cadJobNumbers.some((id) => norm(id) === norm(cad))) continue;
    const strength = classifyCadIdentifierStrength(cad);
    if (strength === "strong_structured") {
      score += 100;
      strongIdentity = true;
      reasons.push({
        kind: "exact_cad_job_identifier",
        value: cad,
        detail: `Validated CAD/job identifier ${cad} belongs to Project ${project.projectId}.`,
      });
      reasons.push({
        kind: "cad_identifier_strong",
        value: cad,
        detail: `Structured CAD/job identifier ${cad} is strong project identity evidence.`,
      });
    } else if (isWeakIdentifierSpecificity(strength)) {
      score += WEAK_IDENTIFIER_SUPPORT_SCORE;
      reasons.push({
        kind:
          strength === "weak_short_structured"
            ? "cad_identifier_weak_short_structured"
            : "cad_identifier_weak_numeric",
        value: cad,
        detail: `Weak CAD/job identifier ${cad} is too weak to route or discover a project by itself.`,
      });
    }
  }

  for (const order of orders) {
    if (!project.orderNumbers.some((id) => norm(id) === norm(order))) continue;
    const strength = classifyOrderIdentifierStrength(order);
    if (strength === "strong_structured") {
      score += 100;
      strongIdentity = true;
      reasons.push({
        kind: "exact_order_identifier",
        value: order,
        detail: `Validated order identifier ${order} belongs to Project ${project.projectId}.`,
      });
    } else if (isWeakIdentifierSpecificity(strength)) {
      score += WEAK_IDENTIFIER_SUPPORT_SCORE;
      reasons.push({
        kind:
          strength === "weak_short_structured"
            ? "order_identifier_weak_short_structured"
            : "order_identifier_weak_numeric",
        value: order,
        detail: `Weak order identifier ${order} is too weak to route or attach a project by itself.`,
      });
    }
  }

  const artifact = evidence.artifact;
  if (artifact) {
    const refs = [artifact.artifactId, artifact.filename].filter(
      (value): value is string => Boolean(value),
    );
    const artifactHit = refs.some((ref) =>
      project.artifactRefs.some((owned) => norm(owned) === norm(ref)),
    );
    if (artifactHit) {
      score += 95;
      strongIdentity = true;
      reasons.push({
        kind: "exact_project_artifact_reference",
        value: artifact.artifactId,
        detail: `Artifact reference is already owned by Project ${project.projectId}.`,
      });
    }
  }

  const vendorHit = evidence.vendorMentions.some((vendor) =>
    project.vendors.some((owned) => norm(owned) === norm(vendor)),
  );
  const jewelryTypes = classifyJewelryItemTypes(hay);
  const jewelryHit = jewelryTypes.some((type) =>
    project.items.some((item) => item.itemType === type),
  );
  const subjectHit = project.subjectTerms.some((term) => hasToken(hay, term));
  const dated = inDateRange(evidence.sentAt, project.dateRange);
  const nearby = nearbyDateOnly(evidence.sentAt, project.dateRange);

  if (vendorHit && strongIdentity) {
    score += 15;
    reasons.push({
      kind: "vendor_supporting_only",
      value: evidence.vendorMentions.find((vendor) =>
        project.vendors.some((owned) => norm(owned) === norm(vendor)),
      ) ?? "",
      detail: "Vendor is supporting evidence only and cannot route a thread by itself.",
    });
    const matchedOrder = orders.find((order) =>
      project.orderNumbers.some((id) => norm(id) === norm(order)),
    );
    if (matchedOrder) {
      reasons.push({
        kind: "project_vendor_order_context",
        value: evidence.vendorMentions[0] ?? "",
        detail: "Vendor appears with order context; vendor alone is not ownership.",
      });
    }
  } else if (vendorHit) {
    reasons.push({
      kind: "vendor_only",
      value: evidence.vendorMentions.find((vendor) =>
        project.vendors.some((owned) => norm(owned) === norm(vendor)),
      ) ?? "",
      detail: "Same vendor is insufficient for project ownership.",
    });
  }

  if (dated && (subjectHit || jewelryHit)) {
    score += 25;
    reasons.push({
      kind: "bounded_project_date_range",
      value: evidence.sentAt ?? "",
      detail: "Date falls inside the project window, but date is not enough alone.",
    });
    if (subjectHit || jewelryHit) {
      reasons.push({
        kind: "strong_subject_continuity",
        value: jewelryTypes.join(",") || project.subjectTerms.join(","),
        detail: "Subject continuity is a supporting signal, not silent attachment.",
      });
    }
  } else if (subjectHit || jewelryHit) {
    score += 15;
    reasons.push({
      kind: jewelryHit && !subjectHit ? "jewelry_type_only" : "similar_stones_or_subject",
      value: jewelryTypes.join(",") || project.subjectTerms.join(","),
      detail: "Similar jewelry type or subject does not merge or attach projects.",
    });
  } else if (nearby) {
    reasons.push({
      kind: "nearby_dates_only",
      value: evidence.sentAt ?? "",
      detail: "Nearby dates are insufficient for project ownership.",
    });
  }

  const cleaned = uniqueReasons(reasons);
  const strength = strengthForScore(score);
  return {
    candidateProjectId: project.projectId,
    strength,
    score,
    reasons: cleaned,
    requiresFounderReview: score < EXACT_ATTACH_SCORE,
  };
}

function attributeOne(
  evidence: ProjectEvidenceCandidate,
  books: readonly ExistingProjectBook[],
  catalogPersonId: string,
): ProjectEvidenceAttribution {
  if (!evidence.personId || evidence.personId !== catalogPersonId) {
    return {
      evidenceId: evidence.evidenceId,
      resolution: "unrelated_rejected",
      candidateProjectId: null,
      attachedProjectId: null,
      spanningProjectIds: [],
      duplicatedAcrossProjects: false,
      strength: "insufficient",
      score: 0,
      reasons: [
        {
          kind: "person_identity_only",
          value: evidence.personId ?? "",
          detail: "Evidence is not tied to this Person or any Project Book.",
        },
      ],
      requiresFounderReview: true,
      candidates: [],
      communicationRouting: "rejected",
    };
  }

  const scored = books.map((book) => scoreProject(evidence, book));
  const exactHits = scored.filter((row) => row.score >= EXACT_ATTACH_SCORE);
  const plausible = scored.filter((row) => row.score > 0);
  const generic = isGenericCorrespondence(evidence);

  if (exactHits.length === 1) {
    const hit = exactHits[0]!;
    return {
      evidenceId: evidence.evidenceId,
      resolution: "exact_project",
      candidateProjectId: hit.candidateProjectId,
      attachedProjectId: hit.candidateProjectId,
      spanningProjectIds: [],
      duplicatedAcrossProjects: false,
      strength: hit.strength,
      score: hit.score,
      reasons: hit.reasons,
      requiresFounderReview: false,
      candidates: exactHits,
      communicationRouting: "exact",
    };
  }

  if (exactHits.length > 1) {
    const spanning = exactHits.map((row) => row.candidateProjectId);
    return {
      evidenceId: evidence.evidenceId,
      resolution: "ambiguous_between_projects",
      candidateProjectId: null,
      attachedProjectId: null,
      spanningProjectIds: spanning,
      duplicatedAcrossProjects: false,
      strength: "strong",
      score: Math.max(...exactHits.map((row) => row.score)),
      reasons: [
        {
          kind: "spans_multiple_projects",
          value: spanning.join(","),
          detail:
            "Evidence spans multiple Project Books and requires founder review rather than copying it everywhere.",
        },
        ...exactHits.flatMap((row) => row.reasons),
      ],
      requiresFounderReview: true,
      candidates: exactHits,
      communicationRouting: "ambiguous_multi_project",
    };
  }

  if (generic) {
    return {
      evidenceId: evidence.evidenceId,
      resolution: "person_related_unassigned",
      candidateProjectId: null,
      attachedProjectId: null,
      spanningProjectIds: [],
      duplicatedAcrossProjects: false,
      strength: "insufficient",
      score: 0,
      reasons: [
        {
          kind: "generic_correspondence",
          value: evidence.subject ?? excerpt(evidence.text, 80),
          detail:
            "Generic person correspondence is not copied into Project Books.",
        },
        {
          kind: "person_identity_only",
          value: evidence.personId,
          detail: "Same Person is insufficient for project ownership.",
        },
      ],
      requiresFounderReview: true,
      candidates: [],
      communicationRouting: "unassigned_needs_project_routing",
    };
  }

  if (plausible.length > 1) {
    const best = [...plausible].sort((left, right) => right.score - left.score)[0]!;
    return {
      evidenceId: evidence.evidenceId,
      resolution: "ambiguous_between_projects",
      candidateProjectId: best.candidateProjectId,
      attachedProjectId: null,
      spanningProjectIds: plausible.map((row) => row.candidateProjectId),
      duplicatedAcrossProjects: false,
      strength: best.strength,
      score: best.score,
      reasons: uniqueReasons(plausible.flatMap((row) => row.reasons)),
      requiresFounderReview: true,
      candidates: plausible,
      communicationRouting: "ambiguous_multi_project",
    };
  }

  const personOnlyReasons: AttributionReason[] = [
    {
      kind: "person_identity_only",
      value: evidence.personId,
      detail: "Same Person is insufficient for project ownership.",
    },
  ];
  if (evidence.vendorMentions.length > 0) {
    personOnlyReasons.push({
      kind: "vendor_only",
      value: evidence.vendorMentions[0] ?? "",
      detail: "Same vendor is insufficient for project ownership.",
    });
  }

  const explained = scored.filter((row) => row.reasons.length > 0);

  return {
    evidenceId: evidence.evidenceId,
    resolution: "person_related_unassigned",
    candidateProjectId: plausible[0]?.candidateProjectId ?? null,
    attachedProjectId: null,
    spanningProjectIds: [],
    duplicatedAcrossProjects: false,
    strength: plausible[0]?.strength ?? "insufficient",
    score: plausible[0]?.score ?? 0,
    reasons: uniqueReasons([
      ...personOnlyReasons,
      ...explained.flatMap((row) => row.reasons),
    ]),
    requiresFounderReview: true,
    candidates: plausible,
    communicationRouting: "unassigned_needs_project_routing",
  };
}

function artifactRecord(
  evidence: ProjectEvidenceCandidate,
  attribution: ProjectEvidenceAttribution,
): ArtifactOwnershipRecord | null {
  const artifact = evidence.artifact;
  if (!artifact) return null;
  const itemOwnershipBlocked = attribution.reasons.some(
    (row) => row.kind === "foreign_item_id" || row.kind === "unknown_item_id",
  );
  const reviewState = itemOwnershipBlocked
    ? "needs_review"
    : attribution.resolution === "exact_project"
      ? "assigned"
      : attribution.resolution === "unrelated_rejected"
        ? "rejected"
        : attribution.resolution === "ambiguous_between_projects"
          ? "needs_review"
          : "unassigned";
  return {
    artifactId: artifact.artifactId,
    projectId: itemOwnershipBlocked ? null : attribution.attachedProjectId,
    itemId: artifact.itemId,
    sourceMessageId: artifact.sourceMessageId ?? evidence.messageId,
    sourceThreadId: artifact.sourceThreadId ?? evidence.threadId,
    artifactType: artifact.artifactType,
    filename: artifact.filename,
    attributionReasons: attribution.reasons,
    confidence: attribution.strength,
    reviewState,
    bytesFetched: false,
  };
}

function identifierOwnedByCatalog(
  value: string,
  books: readonly ExistingProjectBook[],
  field: "cadJobNumbers" | "orderNumbers",
): boolean {
  return books.some((book) =>
    book[field].some((owned) => norm(owned) === norm(value)),
  );
}

function shouldProposeNewProject(
  evidence: ProjectEvidenceCandidate,
  attribution: ProjectEvidenceAttribution,
  books: readonly ExistingProjectBook[],
  catalogPersonId: string,
): boolean {
  if (!evidence.personId || evidence.personId !== catalogPersonId) return false;
  if (attribution.attachedProjectId) return false;
  if (isGenericCorrespondence(evidence)) return false;
  const hay = haystackOf(evidence);
  const unknownCad = extractCadJobIdentifiers(hay).some(
    (cad) =>
      classifyCadIdentifierStrength(cad) === "strong_structured" &&
      !identifierOwnedByCatalog(cad, books, "cadJobNumbers"),
  );
  const unknownOrder = extractOrderIdentifiers(hay).some(
    (order) =>
      classifyOrderIdentifierStrength(order) === "strong_structured" &&
      !identifierOwnedByCatalog(order, books, "orderNumbers"),
  );
  if (unknownCad || unknownOrder) return true;
  if (attribution.candidates.length > 0) return false;
  return classifyJewelryItemTypes(hay).length > 0;
}

function possibleNewProject(
  evidence: ProjectEvidenceCandidate,
): PossibleNewProjectCandidate {
  const hay = haystackOf(evidence);
  return {
    kind: "possible_new_project",
    personId: evidence.personId as string,
    evidenceId: evidence.evidenceId,
    evidenceSummary: excerpt(`${evidence.subject ?? ""} ${evidence.text}`.trim()),
    likelyTimePeriod: evidence.sentAt,
    likelyJewelryContext: classifyJewelryItemTypes(hay),
    requiresFounderApproval: true,
    automaticCreate: false,
  };
}

function historicalSafety(
  lifecycle: ProjectLifecycleCandidate,
): ProjectBookViewContract["historicalSafety"] {
  return {
    remainsHistorical: lifecycle === "historical_closed",
    operationalIdentitySeparate: true,
    createsOpenJobs: false,
    createsToday5: false,
    writesChiefOfStaff: false,
    becomesActive: false,
    addingEvidenceIsOperational: false,
  };
}

export function assembleProjectBookView(
  book: ExistingProjectBook,
  attributions: readonly ProjectEvidenceAttribution[],
  artifacts: readonly ArtifactOwnershipRecord[],
): ProjectBookViewContract {
  const owned = attributions.filter(
    (row) => row.attachedProjectId === book.projectId,
  );
  const ownedArtifacts = artifacts.filter(
    (row) => row.projectId === book.projectId,
  );
  return {
    projectId: book.projectId,
    title: book.title,
    lifecycle: book.lifecycle,
    items: book.items,
    specs: {
      cadJobNumbers: book.cadJobNumbers,
      orderNumbers: book.orderNumbers,
    },
    correspondence: owned.filter((row) => row.communicationRouting === "exact"),
    decisions: [],
    approvals: [],
    revisions: [],
    vendors: book.vendors,
    orders: book.orderNumbers,
    artifacts: ownedArtifacts,
    timeline: {
      start: book.dateRange?.start ?? null,
      end: book.dateRange?.end ?? null,
    },
    sourceEvidence: owned,
    historicalSafety: historicalSafety(book.lifecycle),
    openJobs: [],
    operationalWork: [],
  };
}

export function assemblePersonProjectBookList(
  person: ContainmentPerson,
  books: readonly ExistingProjectBook[],
): PersonProjectBookListContract {
  const owned = books.filter((book) => book.personId === person.personId);
  return {
    personId: person.personId,
    relationshipMemory: {
      personId: person.personId,
      displayName: person.displayName,
      kinds: PERSON_LEVEL_MEMORY_KINDS,
      linkedProjectBookIds: owned.map((book) => book.projectId),
      projectEvidenceInlined: false,
    },
    projectBooks: owned.map((book) => ({
      projectId: book.projectId,
      title: book.title,
      lifecycle: book.lifecycle,
      itemCount: book.items.length,
      itemTypes: book.items.map((item) => item.itemType),
    })),
    inlinedHistoricalDump: false,
  };
}

function itemOwnerProjectIds(
  itemId: string,
  books: readonly ExistingProjectBook[],
): string[] {
  return books
    .filter((book) =>
      book.items.some((item) => norm(item.itemId) === norm(itemId)),
    )
    .map((book) => book.projectId);
}

function enforceItemOwnership(
  attribution: ProjectEvidenceAttribution,
  evidence: ProjectEvidenceCandidate,
  books: readonly ExistingProjectBook[],
): ProjectEvidenceAttribution {
  const itemId = evidence.artifact?.itemId?.trim() || null;
  if (!itemId) return attribution;
  if (attribution.resolution === "unrelated_rejected") return attribution;

  const owners = itemOwnerProjectIds(itemId, books);
  if (owners.length === 0) {
    return {
      ...attribution,
      resolution: "person_related_unassigned",
      attachedProjectId: null,
      requiresFounderReview: true,
      communicationRouting: "unassigned_needs_project_routing",
      strength:
        attribution.strength === "exact" || attribution.strength === "strong"
          ? "moderate"
          : attribution.strength,
      reasons: uniqueReasons([
        ...attribution.reasons,
        {
          kind: "unknown_item_id",
          value: itemId,
          detail: "Unknown itemId cannot be attributed to a Project Book.",
        },
      ]),
    };
  }

  const attached = attribution.attachedProjectId;
  if (attached && owners.includes(attached)) {
    return {
      ...attribution,
      reasons: uniqueReasons([
        ...attribution.reasons,
        {
          kind: "item_id_owned_by_project",
          value: itemId,
          detail: `itemId belongs to Project ${attached}.`,
        },
      ]),
    };
  }

  if (attached && !owners.includes(attached)) {
    const spanning = [...new Set([attached, ...owners])];
    return {
      ...attribution,
      resolution: "ambiguous_between_projects",
      candidateProjectId: null,
      attachedProjectId: null,
      spanningProjectIds: spanning,
      duplicatedAcrossProjects: false,
      requiresFounderReview: true,
      communicationRouting: "ambiguous_multi_project",
      strength: "strong",
      reasons: uniqueReasons([
        ...attribution.reasons,
        {
          kind: "foreign_item_id",
          value: itemId,
          detail:
            "itemId belongs to a different Project Book and cannot be attached here.",
        },
        {
          kind: "spans_multiple_projects",
          value: spanning.join(","),
          detail:
            "Evidence spans multiple Project Books and requires founder review rather than copying it everywhere.",
        },
      ]),
    };
  }

  return attribution;
}

export function containIsolatedReconstructedBook(
  handoff: ProjectBookReconstructionHandoff,
  siblingProjectIds: readonly string[],
): {
  projectId: string;
  itemIds: string[];
  attachmentIds: string[];
  siblingBleed: false;
  mergedInto: null;
} {
  const attachmentIds = handoff.items.flatMap((item) =>
    item.attachments.map((row) => row.attachmentId),
  );
  void siblingProjectIds;
  return {
    projectId: handoff.projectId,
    itemIds: handoff.items.map((item) => item.itemId),
    attachmentIds,
    siblingBleed: false,
    mergedInto: null,
  };
}

export function routeRelatedThreadCandidates(
  candidates: readonly RelatedThreadCandidate[],
  books: readonly ExistingProjectBook[],
  person: ContainmentPerson,
): ProjectEvidenceAttribution[] {
  void books;
  void person;
  return candidates.map((candidate) => ({
    evidenceId: `related-thread:${candidate.threadId}`,
    resolution: "person_related_unassigned" as const,
    candidateProjectId: null,
    attachedProjectId: null,
    spanningProjectIds: [],
    duplicatedAcrossProjects: false as const,
    strength: "insufficient" as const,
    score: 0,
    reasons: [
      {
        kind: "person_identity_only" as const,
        value: candidate.threadId,
        detail:
          "Related-thread discovery remains dormant. Candidates are not fetched or attached.",
      },
    ],
    requiresFounderReview: true,
    candidates: [],
    communicationRouting: "unassigned_needs_project_routing" as const,
  }));
}

export function routeProjectEvidence(input: {
  person: ContainmentPerson;
  projectBooks: readonly ExistingProjectBook[];
  evidence: readonly ProjectEvidenceCandidate[];
}): ProjectContainmentResult {
  const books = input.projectBooks.filter(
    (book) => book.personId === input.person.personId,
  );
  const attributions = input.evidence.map((row) =>
    enforceItemOwnership(
      attributeOne(row, books, input.person.personId),
      row,
      books,
    ),
  );
  const artifacts = input.evidence
    .map((row, index) => artifactRecord(row, attributions[index]!))
    .filter((row): row is ArtifactOwnershipRecord => row !== null);
  const possibleNewProjects = input.evidence.flatMap((row, index) => {
    const attribution = attributions[index]!;
    if (
      !shouldProposeNewProject(
        row,
        attribution,
        books,
        input.person.personId,
      )
    ) {
      return [];
    }
    return [possibleNewProject(row)];
  });
  const views = books.map((book) =>
    assembleProjectBookView(book, attributions, artifacts),
  );

  return {
    personId: input.person.personId,
    projectBooks: books,
    attributions,
    artifacts,
    possibleNewProjects,
    views,
    personList: assemblePersonProjectBookList(input.person, books),
    relatedThreadDiscovery: RELATED_THREAD_DISCOVERY_HANDOFF,
    createdProjects: [],
    mergedProjects: [],
    deletedProjects: [],
    openJobs: [],
    chiefOfStaffWrites: [],
    canonicalWrites: [],
    mutationBoundary: CONTAINMENT_MUTATION_BOUNDARY,
    automaticApply: false,
  };
}
