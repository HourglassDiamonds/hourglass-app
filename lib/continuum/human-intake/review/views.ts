/**
 * Founder review views for Human Intake candidates.
 * EvidenceBasis is visible. No hidden reasoning.
 */

import { randomUUID } from "node:crypto";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { HumanSource, HumanSourceLink } from "@/lib/continuum/client-memory/human-intake/types";
import { humanIntakeProposedSummary } from "../candidates/present";
import type { HumanIntakeProject, HumanIntakeWorld } from "../candidates/types";
import {
  previewHumanIntakeCandidateApply,
  type HumanIntakeCandidateReviewView,
} from "./preview";
import { effectiveCandidateTarget } from "@/lib/continuum/candidates/review";

export function worldFromSourceLinks(input: {
  links: readonly HumanSourceLink[];
  people: readonly { personId: string; displayName: string }[];
  projects: readonly HumanIntakeProject[];
}): {
  world: HumanIntakeWorld;
  confirmedPersonIds: string[];
  confirmedProjectIds: string[];
} {
  const confirmedPersonIds = input.links
    .filter((row) => row.entityKind === "person" && row.linkStatus === "confirmed")
    .map((row) => row.entityId);
  const confirmedProjectIds = input.links
    .filter((row) => row.entityKind === "project" && row.linkStatus === "confirmed")
    .map((row) => row.entityId);
  return {
    world: { people: input.people, projects: input.projects },
    confirmedPersonIds,
    confirmedProjectIds,
  };
}

export function evidenceFromSource(
  source: HumanSource,
  confirmedPersonIds: readonly string[],
  confirmedProjectIds: readonly string[],
) {
  return {
    sourceId: source.id,
    text: (source.rawText ?? source.parsedText ?? "").trim(),
    capturedAt: source.capturedAt,
    confirmedPersonIds,
    confirmedProjectIds,
  };
}

function personIdOf(row: ContinuumCandidate): string | null {
  const target = effectiveCandidateTarget(row);
  return target.kind === "person" ? target.personId : null;
}

function projectIdOf(row: ContinuumCandidate): string | null {
  const target = effectiveCandidateTarget(row);
  if (target.kind === "project") return target.projectId;
  if (target.kind === "project_spec") return target.projectId;
  if (target.kind === "open_job") return target.projectId;
  return null;
}

export function presentHumanIntakeReviewViews(input: {
  candidates: readonly ContinuumCandidate[];
  personNames: ReadonlyMap<string, string>;
  projectTitles: ReadonlyMap<string, string>;
  personOnProject?: (personId: string, projectId: string) => boolean | null;
}): HumanIntakeCandidateReviewView[] {
  return input.candidates.map((row) => {
    const personId = personIdOf(row);
    const projectId = projectIdOf(row);
    const personOnProject =
      personId && projectId
        ? (input.personOnProject?.(personId, projectId) ?? null)
        : null;
    const preview = previewHumanIntakeCandidateApply({
      candidate: row,
      personName: personId ? input.personNames.get(personId) ?? null : null,
      projectTitle: projectId ? input.projectTitles.get(projectId) ?? null : null,
      personOnProject,
    });
    return {
      candidateId: row.candidateId,
      candidateType: row.candidateType,
      candidateState: row.candidateState,
      reviewStatus: row.reviewStatus,
      lastReviewAction: row.lastReviewAction,
      confidence: row.confidence,
      sourceRef: row.sourceRef,
      sourceSystem: row.sourceSystem,
      summary: humanIntakeProposedSummary(row),
      evidenceRuleIds: row.evidenceBasis.ruleIds,
      matchedText: row.evidenceBasis.matchedText,
      preview,
      personName: personId ? input.personNames.get(personId) ?? null : null,
      projectTitle: projectId ? input.projectTitles.get(projectId) ?? null : null,
      mutationId: randomUUID(),
      payload: row.payload,
      proposedTarget: row.proposedTarget,
      suggestedPersonId: personId,
      suggestedProjectId: projectId,
    };
  });
}
