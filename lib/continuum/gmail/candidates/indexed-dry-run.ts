/**
 * Read-only Gmail index → Candidate dry-run.
 * Uses already-indexed metadata only. Does not fetch Gmail or persist bodies.
 * Fixture worlds may be passed in tests; real #16B acceptance loads live index
 * rows in scripts/continuum-gmail-candidate-indexed-dry-run.ts.
 */

import { CANDIDATE_MUTATION_BOUNDARY } from "@/lib/continuum/candidates/types";
import { presentCandidate, type CandidateReadModel } from "@/lib/continuum/candidates/present";
import { proposeGmailCandidates } from "./propose";
import { evidenceFromIndexed } from "./types";
import { packGmailCandidateSourceRef } from "./source-ref";
import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import type { GmailCandidateWorld } from "./types";

export const INDEX_LIMITATION_BODY_TEXT_NOT_AVAILABLE =
  "INDEX LIMITATION — BODY TEXT NOT AVAILABLE" as const;

export const INDEXED_EIGHT_PROJECT_KEYS = [
  "pennock",
  "leeSpiegel",
  "travis",
  "sarah",
  "dylan",
  "chelsea",
  "madi",
  "kaitlin",
] as const;

export type IndexedEightProjectKey = (typeof INDEXED_EIGHT_PROJECT_KEYS)[number];

export const INDEXED_EIGHT_KNOWN_MESSAGE_IDS = {
  pennock: "1a06863965567144",
  leeSpiegel: "1a05d268e3f18e0c",
  travis: "19fdca0abe1a7e3e",
  travisVendor: "19ffcce49298efeb",
  sarah: "1a06199489703eb6",
  sarahQuote: "1a061cd96e477a82",
  chelsea: "1a03a908cae8f77b",
} as const;

export const INDEXED_EIGHT_KNOWN_MESSAGE_IDS_BY_PROJECT: Record<
  IndexedEightProjectKey,
  readonly string[]
> = {
  pennock: [INDEXED_EIGHT_KNOWN_MESSAGE_IDS.pennock],
  leeSpiegel: [INDEXED_EIGHT_KNOWN_MESSAGE_IDS.leeSpiegel],
  travis: [
    INDEXED_EIGHT_KNOWN_MESSAGE_IDS.travis,
    INDEXED_EIGHT_KNOWN_MESSAGE_IDS.travisVendor,
  ],
  sarah: [
    INDEXED_EIGHT_KNOWN_MESSAGE_IDS.sarah,
    INDEXED_EIGHT_KNOWN_MESSAGE_IDS.sarahQuote,
  ],
  dylan: [],
  chelsea: [INDEXED_EIGHT_KNOWN_MESSAGE_IDS.chelsea],
  madi: [],
  kaitlin: [],
};

export const INDEX_ONLY_BODY_DEPENDENT_PARSER_RULES = [
  "explicit_finger_size",
  "explicit_fractional_size",
  "explicit_metal",
  "explicit_center_stone",
  "explicit_supply_notes",
  "explicit_cad_revision",
  "explicit_client_approval",
  "explicit_design_refinement",
  "explicit_durability_discussion",
  "explicit_founder_commitment",
  "explicit_client_request",
  "explicit_cad_feedback",
  "explicit_change_request",
  "explicit_production_question",
  "explicit_shop_blocker",
  "explicit_delivery_payment_issue",
  "explicit_vendor_waiting",
  "relative_tomorrow",
  "relative_two_weeks",
  "relative_next_weekday",
  "explicit_named_date",
  "explicit_follow_up",
] as const;

export const INDEX_ONLY_EXPECTED_BODY_DEPENDENT_BY_PROJECT: Record<
  IndexedEightProjectKey,
  readonly string[]
> = {
  pennock: [
    "structured_spec:metal (platinum)",
    "structured_spec:diamond_supply_notes (family synthetic sapphire)",
  ],
  leeSpiegel: [
    "project_context:design_refinement",
    "project_context:client_approval",
    "note:durability",
    "open_job:client_request",
  ],
  travis: [
    "structured_spec:finger_size (12.5)",
    "open_job:vendor_waiting",
  ],
  sarah: [
    "project_context:cad_revision",
    "structured_spec:finger_size",
    "structured_spec:diamond_supply_notes",
  ],
  dylan: [
    "project_context:client_approval (CAD looks great / diamond looks awesome)",
  ],
  chelsea: ["structured_spec:cad_job_number (CR5001024) from body"],
  madi: ["structured_spec:cad_job_number (C017756) from body"],
  kaitlin: ["structured_spec:cad_job_number (C017755) from body"],
};

export type IndexedCandidateDryRunRow = {
  messageId: string;
  presentInIndex: boolean;
  sourceSystem: "gmail" | null;
  sourceRef: string | null;
  sourceTimestamp: string | null;
  subjectPresent: boolean;
  plaintextAvailable: false;
  plaintextUsed: false;
  candidateTypes: readonly CandidateReadModel["candidateType"][];
  projectTargets: readonly (string | null)[];
  candidateStateByType: readonly string[];
  reviewStatusByType: readonly string[];
  associationBasis: readonly string[];
  candidateIds: readonly string[];
  openJobCandidates: readonly CandidateReadModel[];
  specRelations: readonly {
    fieldName: string;
    relation: "blank" | "conflict" | "equal-skipped";
    proposedValue: string;
  }[];
  candidates: readonly CandidateReadModel[];
};

export type IndexedEightProjectCandidateDryRun = {
  mutationBoundary: typeof CANDIDATE_MUTATION_BOUNDARY;
  liveModelCalls: false;
  gmailFetch: false;
  plaintextUsed: false;
  indexOnly: true;
  rows: IndexedCandidateDryRunRow[];
  candidates: CandidateReadModel[];
};

export type IndexedEvidenceHit = {
  messageId: string;
  sourceSystem: "gmail";
  sourceRef: string;
  sourceTimestamp: string;
  subjectPresent: boolean;
  plaintextAvailable: false;
  hasAttachments: boolean;
  associationBasis: readonly string[];
};

export type IndexedEmittedCandidate = {
  candidateId: string;
  candidateType: CandidateReadModel["candidateType"];
  candidateState: CandidateReadModel["candidateState"];
  reviewStatus: CandidateReadModel["reviewStatus"];
  associationBasis: readonly string[];
  proposalSummary: string;
};

export type IndexedProjectAcceptanceRow = {
  projectKey: IndexedEightProjectKey;
  projectId: string | null;
  projectTitle: string | null;
  indexedEvidence: readonly IndexedEvidenceHit[];
  emittedCandidates: readonly IndexedEmittedCandidate[];
  notEmittedBecauseIndexLacksContent: readonly {
    expected: string;
    reason: typeof INDEX_LIMITATION_BODY_TEXT_NOT_AVAILABLE;
  }[];
};

export type IndexedEightProjectAcceptance = {
  indexOnly: true;
  gmailFetch: false;
  plaintextUsed: false;
  liveModelCalls: false;
  mutationBoundary: typeof CANDIDATE_MUTATION_BOUNDARY;
  projects: IndexedProjectAcceptanceRow[];
};

function specRelation(
  row: CandidateReadModel,
): IndexedCandidateDryRunRow["specRelations"][number] | null {
  if (row.payload.kind !== "structured_spec") return null;
  if (row.payload.conflict) {
    return {
      fieldName: row.payload.fieldName,
      relation: "conflict",
      proposedValue: row.payload.proposedValue,
    };
  }
  return {
    fieldName: row.payload.fieldName,
    relation: "blank",
    proposedValue: row.payload.proposedValue,
  };
}

function packedSourceRef(message: GmailIndexedMessage): string | null {
  const packed = packGmailCandidateSourceRef({
    threadId: message.threadId,
    messageId: message.messageId,
  });
  return packed.ok ? packed.sourceRef : null;
}

function proposalSummary(row: CandidateReadModel): string {
  const payload = row.payload;
  switch (payload.kind) {
    case "structured_spec":
      return `${payload.kind}:${payload.fieldName}=${payload.proposedValue}`;
    case "project_association":
      return `${payload.kind}:${payload.token ?? payload.title ?? ""}`;
    case "person_association":
      return `${payload.kind}:${payload.emailHash ?? "unresolved"}`;
    case "project_context":
      return `${payload.kind}:${payload.topic}`;
    case "open_job":
      return `${payload.kind}:${payload.jobKind}`;
    case "note":
      return `${payload.kind}`;
    case "date":
      return `${payload.kind}:${payload.raw}`;
    case "follow_up":
      return `${payload.kind}`;
  }
}

function expectedEmitted(
  expected: string,
  emitted: readonly IndexedEmittedCandidate[],
): boolean {
  const needle = expected.toLowerCase();
  return emitted.some((row) => {
    const hay = `${row.candidateType}:${row.proposalSummary}`.toLowerCase();
    if (needle.includes("platinum")) {
      return hay.includes("metal") && hay.includes("platinum");
    }
    if (needle.includes("synthetic sapphire")) {
      return hay.includes("diamond_supply_notes") || hay.includes("synthetic");
    }
    if (needle.includes("finger_size")) {
      return hay.includes("finger_size");
    }
    if (needle.includes("cad_job_number")) {
      return hay.includes("cad_job_number");
    }
    if (needle.includes("design_refinement")) {
      return hay.includes("design_refinement");
    }
    if (needle.includes("client_approval")) {
      return hay.includes("client_approval");
    }
    if (needle.includes("durability")) {
      return hay.includes("note") || hay.includes("durability");
    }
    if (needle.includes("client_request") || needle.includes("open_job:client")) {
      return hay.includes("open_job") && row.proposalSummary.includes("request");
    }
    if (needle.includes("vendor_waiting")) {
      return hay.includes("open_job") && row.proposalSummary.includes("blocked");
    }
    if (needle.includes("cad_revision")) {
      return hay.includes("cad_revision");
    }
    return hay.includes(needle);
  });
}

export function presentIndexedGmailCandidateDryRun(input: {
  messages: readonly (GmailIndexedMessage | null)[];
  knownMessageIds: readonly string[];
  world: GmailCandidateWorld;
  createdAt?: string;
}): IndexedEightProjectCandidateDryRun {
  const byId = new Map<string, GmailIndexedMessage>();
  for (const message of input.messages) {
    if (message) byId.set(message.messageId, message);
  }
  const evidence = [...byId.values()].map(evidenceFromIndexed);
  const proposed = proposeGmailCandidates({
    evidence,
    world: input.world,
    createdAt: input.createdAt,
  });
  const presented = proposed.candidates.map(presentCandidate);
  const rows: IndexedCandidateDryRunRow[] = input.knownMessageIds.map((messageId) => {
    const indexed = byId.get(messageId) ?? null;
    const packed = indexed
      ? presented.filter((row) => row.sourceRef.includes(messageId))
      : [];
    return {
      messageId,
      presentInIndex: Boolean(indexed),
      sourceSystem: indexed ? "gmail" : null,
      sourceRef:
        packed[0]?.sourceRef ?? (indexed ? packedSourceRef(indexed) : null),
      sourceTimestamp: indexed?.sentAt ?? packed[0]?.sourceTimestamp ?? null,
      subjectPresent: Boolean(indexed?.subject?.trim()),
      plaintextAvailable: false,
      plaintextUsed: false,
      candidateTypes: [...new Set(packed.map((row) => row.candidateType))],
      projectTargets: [
        ...new Set(
          packed.map((row) => {
            if (row.proposedTarget.kind === "none") return null;
            if (row.proposedTarget.kind === "person") return row.proposedTarget.personId;
            return row.proposedTarget.projectId;
          }),
        ),
      ],
      candidateStateByType: packed.map(
        (row) => `${row.candidateType}:${row.candidateState}/${row.reviewStatus}`,
      ),
      reviewStatusByType: packed.map((row) => row.reviewStatus),
      associationBasis: [
        ...new Set(packed.flatMap((row) => row.evidenceBasis.ruleIds)),
      ],
      candidateIds: packed.map((row) => row.candidateId),
      openJobCandidates: packed.filter((row) => row.candidateType === "open_job"),
      specRelations: packed
        .map(specRelation)
        .filter((row): row is NonNullable<typeof row> => Boolean(row)),
      candidates: packed,
    };
  });
  return {
    mutationBoundary: proposed.mutationBoundary,
    liveModelCalls: false,
    gmailFetch: false,
    plaintextUsed: false,
    indexOnly: true,
    rows,
    candidates: presented,
  };
}

export function presentIndexedEightProjectAcceptance(input: {
  world: GmailCandidateWorld;
  messages: readonly GmailIndexedMessage[];
  projectIdsByKey: Partial<Record<IndexedEightProjectKey, string | null>>;
  extraMessageIdsByKey?: Partial<Record<IndexedEightProjectKey, readonly string[]>>;
  createdAt?: string;
}): IndexedEightProjectAcceptance {
  const evidence = input.messages.map(evidenceFromIndexed);
  const proposed = proposeGmailCandidates({
    evidence,
    world: input.world,
    createdAt: input.createdAt,
  });
  const presented = proposed.candidates.map(presentCandidate);
  const projects: IndexedProjectAcceptanceRow[] = INDEXED_EIGHT_PROJECT_KEYS.map(
    (projectKey) => {
      const projectId = input.projectIdsByKey[projectKey] ?? null;
      const project = projectId
        ? input.world.projects.find((row) => row.projectId === projectId) ?? null
        : null;
      const knownIds = [
        ...INDEXED_EIGHT_KNOWN_MESSAGE_IDS_BY_PROJECT[projectKey],
        ...(input.extraMessageIdsByKey?.[projectKey] ?? []),
      ];
      const projectMessages = input.messages.filter((message) => {
        if (knownIds.includes(message.messageId)) return true;
        if (project?.gmailThreadId && message.threadId === project.gmailThreadId) {
          return true;
        }
        if (!projectId) return false;
        return presented.some((row) => {
          if (!row.sourceRef.includes(message.messageId)) return false;
          if (row.proposedTarget.kind === "none") return false;
          if (row.proposedTarget.kind === "person") return false;
          return row.proposedTarget.projectId === projectId;
        });
      });
      const emittedCandidates: IndexedEmittedCandidate[] = presented
        .filter((row) => {
          if (projectId) {
            if (row.proposedTarget.kind === "none") return false;
            if (row.proposedTarget.kind === "person") {
              return projectMessages.some((message) =>
                row.sourceRef.includes(message.messageId),
              );
            }
            return row.proposedTarget.projectId === projectId;
          }
          return projectMessages.some((message) =>
            row.sourceRef.includes(message.messageId),
          );
        })
        .map((row) => ({
          candidateId: row.candidateId,
          candidateType: row.candidateType,
          candidateState: row.candidateState,
          reviewStatus: row.reviewStatus,
          associationBasis: [...row.evidenceBasis.ruleIds],
          proposalSummary: proposalSummary(row),
        }));
      const indexedEvidence: IndexedEvidenceHit[] = projectMessages.map((message) => {
        const packed = packedSourceRef(message);
        const related = presented.filter((row) =>
          row.sourceRef.includes(message.messageId),
        );
        return {
          messageId: message.messageId,
          sourceSystem: "gmail",
          sourceRef: packed ?? `gc1|${message.threadId}|${message.messageId}`,
          sourceTimestamp: message.sentAt,
          subjectPresent: Boolean(message.subject?.trim()),
          plaintextAvailable: false,
          hasAttachments: message.hasAttachments,
          associationBasis: [
            ...new Set(related.flatMap((row) => row.evidenceBasis.ruleIds)),
          ],
        };
      });
      const notEmittedBecauseIndexLacksContent =
        indexedEvidence.length === 0
          ? []
          : INDEX_ONLY_EXPECTED_BODY_DEPENDENT_BY_PROJECT[projectKey]
              .filter((expected) => !expectedEmitted(expected, emittedCandidates))
              .map((expected) => ({
                expected,
                reason: INDEX_LIMITATION_BODY_TEXT_NOT_AVAILABLE,
              }));
      return {
        projectKey,
        projectId,
        projectTitle: project?.title ?? null,
        indexedEvidence,
        emittedCandidates,
        notEmittedBecauseIndexLacksContent,
      };
    },
  );
  return {
    indexOnly: true,
    gmailFetch: false,
    plaintextUsed: false,
    liveModelCalls: false,
    mutationBoundary: proposed.mutationBoundary,
    projects,
  };
}
