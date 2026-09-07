/**
 * PLAUD / reMarkable source adapters → frozen #17 ContinuumCandidate.
 * Shared #18 parser is parseHumanIntakeEvidence via proposeParsedHumanEvidence.
 * Adapters stamp sourceSystem / sourceRef. Parser does not overwrite them.
 * Founder review is the shared #19 path — adapters never invoke it.
 */

import { CANDIDATE_MUTATION_BOUNDARY } from "@/lib/continuum/candidates/types";
import type {
  CandidateSourceSystem,
  CandidateStore,
  ContinuumCandidate,
} from "@/lib/continuum/candidates/types";
import { CANDIDATE_PARSER_HUMAN_INTAKE_V1 } from "@/lib/continuum/candidates/types";
import { logicalProposalKey } from "@/lib/continuum/candidates/identity";
import { provenanceClassForCommunication } from "@/lib/continuum/client-memory/human-intake/provenance";
import type {
  HumanCommunicationType,
  HumanProvenanceClass,
  HumanSource,
} from "@/lib/continuum/client-memory/human-intake/types";
import {
  proposeParsedHumanEvidence,
  type HumanEvidenceAdapterSource,
} from "@/lib/continuum/human-intake/candidates/propose";
import type { HumanIntakeWorld } from "@/lib/continuum/human-intake/candidates/types";
import {
  humanEvidenceSourceRefPrefix,
  packHumanEvidenceSourceRef,
  parseHumanEvidenceSourceRef,
} from "./human-evidence-source-ref";

export type HumanEvidenceSourceSystem = Extract<
  HumanEvidenceAdapterSource,
  "plaud" | "remarkable"
>;

export type HumanEvidenceTextOrigin =
  | "source-text"
  | "associated-text"
  | "none";

export type NormalizedHumanEvidence = {
  sourceSystem: HumanEvidenceSourceSystem;
  sourceRef: string;
  sourceId: string;
  sourceTimestamp: string;
  text: string;
  textOrigin: HumanEvidenceTextOrigin;
  personId: string | null;
  projectId: string | null;
  capturedAt: string | null;
  reportedCommunicationType: HumanCommunicationType;
  provenanceClass: HumanProvenanceClass;
  originalFileName: string | null;
  contentSha256: string;
};

export type ProposeHumanEvidenceResult = {
  candidates: ContinuumCandidate[];
  mutationBoundary: typeof CANDIDATE_MUTATION_BOUNDARY;
  liveModelCalls: false;
  parserVersion: typeof CANDIDATE_PARSER_HUMAN_INTAKE_V1;
  status: "proposed" | "empty-text" | "identity-too-long";
};

export type IngestHumanEvidenceResult = ProposeHumanEvidenceResult & {
  insertedIds: string[];
  duplicateIds: string[];
};

function isHumanEvidenceSourceSystem(
  value: HumanSource["sourceType"],
): value is HumanEvidenceSourceSystem {
  return value === "plaud" || value === "remarkable";
}

function textOriginOf(source: HumanSource): HumanEvidenceTextOrigin {
  if (!source.rawText?.trim()) return "none";
  if (source.sourceType === "remarkable") return "associated-text";
  return "source-text";
}

export function normalizeHumanSourceEvidence(input: {
  source: HumanSource;
  personId?: string | null;
  projectId?: string | null;
}):
  | { ok: true; evidence: NormalizedHumanEvidence }
  | { ok: false; reason: "invalid-source-type" | "identity-too-long" } {
  if (!isHumanEvidenceSourceSystem(input.source.sourceType)) {
    return { ok: false, reason: "invalid-source-type" };
  }
  const packed = packHumanEvidenceSourceRef({ sourceId: input.source.id });
  if (!packed.ok) return { ok: false, reason: "identity-too-long" };
  const sourceTimestamp =
    input.source.capturedAt ?? input.source.ingestedAt;
  return {
    ok: true,
    evidence: {
      sourceSystem: input.source.sourceType,
      sourceRef: packed.sourceRef,
      sourceId: input.source.id,
      sourceTimestamp,
      text: input.source.rawText ?? "",
      textOrigin: textOriginOf(input.source),
      personId: input.personId ?? null,
      projectId: input.projectId ?? null,
      capturedAt: input.source.capturedAt,
      reportedCommunicationType: input.source.reportedCommunicationType,
      provenanceClass: provenanceClassForCommunication(
        input.source.reportedCommunicationType,
      ),
      originalFileName: input.source.originalFileName,
      contentSha256: input.source.contentSha256,
    },
  };
}

export function proposeHumanEvidenceCandidates(input: {
  evidence: NormalizedHumanEvidence;
  world?: HumanIntakeWorld;
  createdAt?: string;
}): ProposeHumanEvidenceResult {
  const base = {
    mutationBoundary: CANDIDATE_MUTATION_BOUNDARY,
    liveModelCalls: false as const,
    parserVersion: CANDIDATE_PARSER_HUMAN_INTAKE_V1,
  };
  if (input.evidence.textOrigin === "none" || !input.evidence.text.trim()) {
    return {
      ...base,
      candidates: [],
      status: "empty-text",
    };
  }
  const proposed = proposeParsedHumanEvidence({
    sourceSystem: input.evidence.sourceSystem,
    packSourceRef: ({ start, end }) =>
      packHumanEvidenceSourceRef({
        sourceId: input.evidence.sourceId,
        start,
        end,
      }),
    evidence: {
      sourceId: input.evidence.sourceId,
      text: input.evidence.text,
      capturedAt: input.evidence.capturedAt,
      confirmedPersonIds: input.evidence.personId
        ? [input.evidence.personId]
        : [],
      confirmedProjectIds: input.evidence.projectId
        ? [input.evidence.projectId]
        : [],
    },
    world: input.world ?? { people: [], projects: [] },
    createdAt: input.createdAt ?? input.evidence.sourceTimestamp,
  });
  return {
    ...proposed,
    status: "proposed",
  };
}

type CandidateStoreWithSourceQuery = CandidateStore & {
  listBySourceRefPrefix(
    sourceSystem: CandidateSourceSystem,
    sourceRefPrefix: string,
  ): Promise<ContinuumCandidate[]>;
};

function hasSourceRefPrefixQuery(
  store: CandidateStore,
): store is CandidateStoreWithSourceQuery {
  return (
    typeof (store as CandidateStoreWithSourceQuery).listBySourceRefPrefix ===
    "function"
  );
}

export async function listHumanEvidenceCandidatesForSource(
  store: CandidateStore,
  sourceSystem: HumanEvidenceSourceSystem,
  sourceId: string,
): Promise<ContinuumCandidate[]> {
  const prefix = humanEvidenceSourceRefPrefix(sourceId);
  if (hasSourceRefPrefixQuery(store)) {
    return store.listBySourceRefPrefix(sourceSystem, prefix);
  }
  return (await store.list()).filter(
    (row) =>
      row.sourceSystem === sourceSystem &&
      parseHumanEvidenceSourceRef(row.sourceRef)?.sourceId === sourceId,
  );
}

function sourceMs(row: ContinuumCandidate): number {
  const ms = Date.parse(row.sourceTimestamp);
  return Number.isFinite(ms) ? ms : 0;
}

function evidenceState(
  row: ContinuumCandidate,
): ContinuumCandidate["candidateState"] {
  if (row.candidateState === "conflict") return "conflict";
  return "active";
}

export async function applyHumanEvidenceCandidateLineage(
  store: CandidateStore,
  sourceSystem: HumanEvidenceSourceSystem,
  sourceId: string,
): Promise<void> {
  const rows = await listHumanEvidenceCandidatesForSource(
    store,
    sourceSystem,
    sourceId,
  );
  const groups = new Map<string, ContinuumCandidate[]>();
  for (const row of rows) {
    const key = logicalProposalKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => {
      const delta = sourceMs(a) - sourceMs(b);
      if (delta !== 0) return delta;
      return a.candidateId.localeCompare(b.candidateId);
    });
    const newest = sorted[sorted.length - 1]!;
    const previous = sorted[sorted.length - 2] ?? null;
    await store.replace({
      ...newest,
      candidateState: evidenceState(newest),
      supersedesCandidateId: previous?.candidateId ?? null,
      supersededByCandidateId: null,
    });
    for (const row of sorted) {
      if (row.candidateId === newest.candidateId) continue;
      await store.replace({
        ...row,
        candidateState: "superseded",
        supersededByCandidateId: newest.candidateId,
        supersedesCandidateId: row.supersedesCandidateId,
      });
    }
  }
}

export async function ingestHumanEvidenceCandidates(
  store: CandidateStore,
  input: {
    source: HumanSource;
    world?: HumanIntakeWorld;
    personId?: string | null;
    projectId?: string | null;
    createdAt?: string;
  },
): Promise<IngestHumanEvidenceResult> {
  const normalized = normalizeHumanSourceEvidence({
    source: input.source,
    personId: input.personId,
    projectId: input.projectId,
  });
  if (!normalized.ok) {
    return {
      candidates: [],
      mutationBoundary: CANDIDATE_MUTATION_BOUNDARY,
      liveModelCalls: false,
      parserVersion: CANDIDATE_PARSER_HUMAN_INTAKE_V1,
      status: "identity-too-long",
      insertedIds: [],
      duplicateIds: [],
    };
  }
  const proposed = proposeHumanEvidenceCandidates({
    evidence: normalized.evidence,
    world: input.world,
    createdAt: input.createdAt,
  });
  const insertedIds: string[] = [];
  const duplicateIds: string[] = [];
  for (const row of proposed.candidates) {
    const result = await store.put(row);
    if (result.status === "inserted") insertedIds.push(result.record.candidateId);
    else duplicateIds.push(result.record.candidateId);
  }
  if (proposed.status === "proposed") {
    await applyHumanEvidenceCandidateLineage(
      store,
      normalized.evidence.sourceSystem,
      normalized.evidence.sourceId,
    );
  }
  return {
    ...proposed,
    candidates: await listHumanEvidenceCandidatesForSource(
      store,
      normalized.evidence.sourceSystem,
      normalized.evidence.sourceId,
    ),
    insertedIds,
    duplicateIds,
  };
}
