/**
 * CalendarEventEvidence → Continuum Candidates.
 * Proposal-only. canonical:false automaticApply:false reviewStatus:pending.
 * Does not write Persons, specs, lifecycle, Kind, or Open Jobs.
 */

import {
  CANDIDATE_MUTATION_BOUNDARY,
  CANDIDATE_PARSER_GOOGLE_CALENDAR_V1,
  type ContinuumCandidate,
  type ContinuumCandidateDraft,
} from "@/lib/continuum/candidates/types";
import { assignCandidateId } from "@/lib/continuum/candidates/identity";
import { CALENDAR_SOURCE_SYSTEM } from "../types";
import { analyzeCalendarEventAssociation } from "./associate";
import type {
  CalendarAssociationWorld,
  CalendarPersonAssociationHit,
  CalendarProjectAssociationHit,
} from "./types";
import type { CalendarEventEvidence } from "../types";

export type ProposeCalendarAssociationInput = {
  evidence: readonly CalendarEventEvidence[];
  world: CalendarAssociationWorld;
  createdAt?: string;
};

export type ProposeCalendarAssociationResult = {
  candidates: ContinuumCandidate[];
  mutationBoundary: typeof CANDIDATE_MUTATION_BOUNDARY;
  liveModelCalls: false;
  parserVersion: typeof CANDIDATE_PARSER_GOOGLE_CALENDAR_V1;
};

function personDraft(
  hit: CalendarPersonAssociationHit,
  sourceRef: string,
  sourceTimestamp: string,
  createdAt: string,
): ContinuumCandidateDraft {
  return {
    candidateId: "",
    sourceSystem: CALENDAR_SOURCE_SYSTEM,
    sourceRef,
    sourceTimestamp,
    createdAt,
    canonical: false,
    automaticApply: false,
    parserVersion: CANDIDATE_PARSER_GOOGLE_CALENDAR_V1,
    candidateType: "person_association",
    proposedTarget: { kind: "person", personId: hit.personId },
    payload: {
      kind: "person_association",
      displayName: hit.displayName,
      emailHash: hit.emailHash,
      mintPerson: false,
      mergePersons: false,
    },
    confidence: hit.confidence,
    evidenceBasis: {
      ruleIds: hit.ruleIds,
      matchedText: hit.matchedText,
    },
    candidateState: "active",
  };
}

function projectDraft(
  hit: CalendarProjectAssociationHit,
  sourceRef: string,
  sourceTimestamp: string,
  createdAt: string,
): ContinuumCandidateDraft {
  return {
    candidateId: "",
    sourceSystem: CALENDAR_SOURCE_SYSTEM,
    sourceRef,
    sourceTimestamp,
    createdAt,
    canonical: false,
    automaticApply: false,
    parserVersion: CANDIDATE_PARSER_GOOGLE_CALENDAR_V1,
    candidateType: "project_association",
    proposedTarget: { kind: "project", projectId: hit.projectId },
    payload: {
      kind: "project_association",
      title: hit.title,
      token: hit.token,
      match: hit.match,
    },
    confidence: hit.match === "exact" ? "high" : "ambiguous",
    evidenceBasis: {
      ruleIds: hit.ruleIds,
      matchedText: hit.matchedText,
    },
    candidateState: "active",
  };
}

export function proposeCalendarAssociationCandidates(
  input: ProposeCalendarAssociationInput,
): ProposeCalendarAssociationResult {
  const createdAt = input.createdAt ?? new Date(0).toISOString();
  const seen = new Set<string>();
  const candidates: ContinuumCandidate[] = [];
  for (const evidence of input.evidence) {
    const analysis = analyzeCalendarEventAssociation(evidence, input.world);
    if (!analysis.sourceRef || analysis.skipped) continue;
    const sourceTimestamp = evidence.start_at;
    for (const hit of analysis.personHits) {
      const row = assignCandidateId(
        personDraft(hit, analysis.sourceRef, sourceTimestamp, createdAt),
      );
      if (seen.has(row.candidateId)) continue;
      seen.add(row.candidateId);
      candidates.push(row);
    }
    for (const hit of analysis.projectHits) {
      const row = assignCandidateId(
        projectDraft(hit, analysis.sourceRef, sourceTimestamp, createdAt),
      );
      if (seen.has(row.candidateId)) continue;
      seen.add(row.candidateId);
      candidates.push(row);
    }
  }
  return {
    candidates,
    mutationBoundary: CANDIDATE_MUTATION_BOUNDARY,
    liveModelCalls: false,
    parserVersion: CANDIDATE_PARSER_GOOGLE_CALENDAR_V1,
  };
}
