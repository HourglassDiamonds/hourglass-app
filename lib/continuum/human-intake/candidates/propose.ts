/**
 * Human Intake evidence → Continuum Candidates.
 * Read-only over captured source text + known People/Projects.
 * Does not write Persons, specs, lifecycle, Kind, or Open Jobs.
 */

import {
  CANDIDATE_MUTATION_BOUNDARY,
  CANDIDATE_PARSER_HUMAN_INTAKE_V1,
  type CandidateSourceSystem,
  type ContinuumCandidate,
  type ContinuumCandidateDraft,
} from "@/lib/continuum/candidates/types";
import { assignCandidateId, clipMatchedText } from "@/lib/continuum/candidates/identity";
import { validateProjectSpecCorrection } from "@/lib/continuum/client-memory/project-spec/validate";
import { parseHumanIntakeEvidence } from "./parse";
import { packHumanIntakeCandidateSourceRef } from "./source-ref";
import type {
  HumanIntakeEvidence,
  HumanIntakeProject,
  HumanIntakeWorld,
  IntakeParseHit,
} from "./types";

/**
 * Shared Human Evidence mapping entrypoint.
 * Adapter stamps sourceSystem / sourceRef. parse.ts never overwrites them.
 */
export type HumanEvidenceAdapterSource = Extract<
  CandidateSourceSystem,
  "human-intake" | "plaud" | "remarkable"
>;

export type PackHumanEvidenceLocatorRef = (input: {
  start: number;
  end: number;
}) => { ok: true; sourceRef: string } | { ok: false; reason: "identity-too-long" };

export type ProposeParsedHumanEvidenceInput = {
  sourceSystem: HumanEvidenceAdapterSource;
  packSourceRef: PackHumanEvidenceLocatorRef;
  evidence: HumanIntakeEvidence;
  world: HumanIntakeWorld;
  createdAt?: string;
};

export type ProposeHumanIntakeCandidatesInput = {
  evidence: HumanIntakeEvidence;
  world: HumanIntakeWorld;
  createdAt?: string;
};

export type ProposeHumanIntakeCandidatesResult = {
  candidates: ContinuumCandidate[];
  mutationBoundary: typeof CANDIDATE_MUTATION_BOUNDARY;
  liveModelCalls: false;
  parserVersion: typeof CANDIDATE_PARSER_HUMAN_INTAKE_V1;
};

function specFieldValue(
  project: HumanIntakeProject | null,
  fieldName: "finger_size" | "cad_job_number" | "order_number",
): string | null {
  if (!project) return null;
  if (fieldName === "finger_size") return project.fingerSize ?? null;
  if (fieldName === "cad_job_number") return project.cadJobNumber ?? null;
  return project.orderNumber ?? null;
}

function specConflict(current: string | null, proposed: string): boolean {
  const left = (current ?? "").trim().toLowerCase();
  const right = proposed.trim().toLowerCase();
  if (!left) return false;
  return left !== right;
}

function noteTarget(
  personId: string | null,
  projectId: string | null,
): ContinuumCandidateDraft["proposedTarget"] {
  if (personId) return { kind: "person", personId };
  if (projectId) return { kind: "project", projectId };
  return { kind: "none" };
}

function projectOf(
  world: HumanIntakeWorld,
  projectId: string | null,
): HumanIntakeProject | null {
  if (!projectId) return null;
  return world.projects.find((row) => row.projectId === projectId) ?? null;
}

function draftFromHit(
  hit: IntakeParseHit,
  evidence: HumanIntakeEvidence,
  world: HumanIntakeWorld,
  createdAt: string,
  sourceSystem: HumanEvidenceAdapterSource,
  packSourceRef: PackHumanEvidenceLocatorRef,
): ContinuumCandidateDraft | null {
  const packed = packSourceRef({
    start: hit.locator.start,
    end: hit.locator.end,
  });
  if (!packed.ok) return null;
  const sourceTimestamp = evidence.capturedAt?.trim() || createdAt;
  const base = {
    sourceSystem,
    sourceRef: packed.sourceRef,
    sourceTimestamp,
    createdAt,
    canonical: false as const,
    automaticApply: false as const,
    parserVersion: CANDIDATE_PARSER_HUMAN_INTAKE_V1,
    candidateId: "",
  };

  if (hit.kind === "person_association") {
    return {
      ...base,
      candidateType: "person_association",
      proposedTarget: { kind: "person", personId: hit.personId },
      payload: {
        kind: "person_association",
        displayName: hit.displayName,
        emailHash: null,
        mintPerson: false,
        mergePersons: false,
      },
      confidence: hit.confidence,
      evidenceBasis: {
        ruleIds: hit.ruleIds,
        matchedText: clipMatchedText(hit.locator.quote),
      },
      candidateState: "active",
    };
  }

  if (hit.kind === "project_association") {
    return {
      ...base,
      candidateType: "project_association",
      proposedTarget: { kind: "project", projectId: hit.projectId },
      payload: {
        kind: "project_association",
        title: hit.title,
        token: hit.token,
        match: hit.match,
      },
      confidence: hit.confidence,
      evidenceBasis: {
        ruleIds: hit.ruleIds,
        matchedText: clipMatchedText(hit.locator.quote),
      },
      candidateState: "active",
    };
  }

  if (hit.kind === "structured_spec") {
    const validated = validateProjectSpecCorrection(hit.fieldName, hit.proposedValue);
    if (!validated.ok) return null;
    const project = projectOf(world, hit.projectId);
    const current = specFieldValue(project, hit.fieldName);
    if ((current ?? "").trim().toLowerCase() === validated.value.toLowerCase()) {
      return null;
    }
    const conflict = specConflict(current, validated.value);
    return {
      ...base,
      candidateType: "structured_spec",
      proposedTarget: {
        kind: "project_spec",
        projectId: hit.projectId,
        fieldName: hit.fieldName,
      },
      payload: {
        kind: "structured_spec",
        fieldName: hit.fieldName,
        proposedValue: validated.value,
        currentValue: current,
        conflict,
      },
      confidence: conflict ? "ambiguous" : hit.confidence,
      evidenceBasis: {
        ruleIds: conflict
          ? [...hit.ruleIds, "spec_conflict_review_required"]
          : hit.ruleIds,
        matchedText: clipMatchedText(hit.locator.quote),
      },
      candidateState: conflict ? "conflict" : "active",
    };
  }

  if (hit.kind === "note") {
    return {
      ...base,
      candidateType: "note",
      proposedTarget: noteTarget(hit.personId, hit.projectId),
      payload: {
        kind: "note",
        text: hit.text,
        contextLayer: hit.contextLayer,
      },
      confidence: hit.confidence,
      evidenceBasis: {
        ruleIds: hit.ruleIds,
        matchedText: clipMatchedText(hit.locator.quote),
      },
      candidateState: "active",
    };
  }

  if (hit.kind === "open_job") {
    return {
      ...base,
      candidateType: "open_job",
      proposedTarget: { kind: "open_job", projectId: hit.projectId },
      payload: {
        kind: "open_job",
        jobKind: hit.jobKind,
        subject: hit.subject,
        detail: hit.detail,
        waitingOnActor: hit.waitingOnActor,
        dueAt: hit.dueAt,
        createJob: false,
      },
      confidence: hit.confidence,
      evidenceBasis: {
        ruleIds: hit.ruleIds,
        matchedText: clipMatchedText(hit.locator.quote),
      },
      candidateState: "active",
    };
  }

  if (hit.kind === "date") {
    return {
      ...base,
      candidateType: "date",
      proposedTarget: {
        kind: "project",
        projectId: evidence.confirmedProjectIds?.[0] ?? null,
      },
      payload: {
        kind: "date",
        raw: hit.raw,
        isoDate: hit.isoDate,
        precision: hit.precision,
        role: hit.role,
        sourceTimestamp,
        resolutionCalendar: hit.isoDate ? "source-timestamp-utc-date" : null,
      },
      confidence: hit.confidence,
      evidenceBasis: {
        ruleIds: hit.ruleIds,
        matchedText: clipMatchedText(hit.locator.quote),
      },
      candidateState: "active",
    };
  }

  return {
    ...base,
    candidateType: "follow_up",
    proposedTarget: { kind: "project", projectId: hit.projectId },
    payload: {
      kind: "follow_up",
      text: hit.text,
      dueAt: hit.dueAt,
      sourceTimestamp,
    },
    confidence: hit.confidence,
    evidenceBasis: {
      ruleIds: hit.ruleIds,
      matchedText: clipMatchedText(hit.locator.quote),
    },
    candidateState: "active",
  };
}

export function proposeParsedHumanEvidence(
  input: ProposeParsedHumanEvidenceInput,
): ProposeHumanIntakeCandidatesResult {
  const createdAt = input.createdAt ?? new Date(0).toISOString();
  const seen = new Set<string>();
  const candidates: ContinuumCandidate[] = [];
  for (const hit of parseHumanIntakeEvidence(input.evidence, input.world)) {
    const draft = draftFromHit(
      hit,
      input.evidence,
      input.world,
      createdAt,
      input.sourceSystem,
      input.packSourceRef,
    );
    if (!draft) continue;
    const row = assignCandidateId(draft);
    if (seen.has(row.candidateId)) continue;
    seen.add(row.candidateId);
    candidates.push(row);
  }
  return {
    candidates,
    mutationBoundary: CANDIDATE_MUTATION_BOUNDARY,
    liveModelCalls: false,
    parserVersion: CANDIDATE_PARSER_HUMAN_INTAKE_V1,
  };
}

export function proposeHumanIntakeCandidates(
  input: ProposeHumanIntakeCandidatesInput,
): ProposeHumanIntakeCandidatesResult {
  return proposeParsedHumanEvidence({
    sourceSystem: "human-intake",
    packSourceRef: ({ start, end }) =>
      packHumanIntakeCandidateSourceRef({
        sourceId: input.evidence.sourceId,
        start,
        end,
      }),
    evidence: input.evidence,
    world: input.world,
    createdAt: input.createdAt,
  });
}
