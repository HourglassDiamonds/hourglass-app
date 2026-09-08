/**
 * Gmail evidence → Continuum Candidates.
 * Read-only over indexed metadata + optional in-memory plaintext.
 * Does not fetch Gmail, write Persons, specs, lifecycle, Kind, or Open Jobs.
 */

import {
  CANDIDATE_MUTATION_BOUNDARY,
  CANDIDATE_PARSER_GMAIL_V1,
  type ContinuumCandidate,
  type ContinuumCandidateDraft,
} from "@/lib/continuum/candidates/types";
import { GMAIL_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/gmail/types";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { resolvePersonHit, resolveProjectHits } from "./associate";
import {
  extractDates,
  extractNotes,
  extractOpenJobs,
  extractProjectContext,
  extractStructuredSpecs,
  haystackOf,
} from "./parse";
import {
  ATTACHMENT_FILENAME_TOPIC,
  extractCustomerEmails,
  extractCustomerLabel,
  extractNewProject,
  extractNewProjectContexts,
  looksTransactionalCustomerNotice,
  NEW_PROJECT_CONTEXT_TOPIC,
} from "./new-project";
import { packGmailCandidateSourceRef } from "./source-ref";
import {
  assignReconciledCandidates,
  reconcileThreadCandidates,
} from "./thread-reconcile";
import type {
  GmailCandidateEvidence,
  GmailCandidatePerson,
  GmailCandidateWorld,
} from "./types";

export type ProposeGmailCandidatesInput = {
  evidence: readonly GmailCandidateEvidence[];
  world: GmailCandidateWorld;
  createdAt?: string;
};

export type ProposeGmailCandidatesResult = {
  candidates: ContinuumCandidate[];
  mutationBoundary: typeof CANDIDATE_MUTATION_BOUNDARY;
  liveModelCalls: false;
  parserVersion: typeof CANDIDATE_PARSER_GMAIL_V1;
};

function senderRole(
  person: GmailCandidatePerson | null,
  direction: GmailCandidateEvidence["indexed"]["direction"],
): "client" | "vendor-contact" | "founder" | "unknown" {
  if (direction === "outbound") return "founder";
  if (person?.role === "vendor-contact") return "vendor-contact";
  if (person?.role === "client" || person?.role === "prospect") return "client";
  return "unknown";
}

function draftsFromEvidence(
  evidence: GmailCandidateEvidence,
  world: GmailCandidateWorld,
  createdAt: string,
): ContinuumCandidateDraft[] {
  const packed = packGmailCandidateSourceRef({
    threadId: evidence.indexed.threadId,
    messageId: evidence.indexed.messageId,
  });
  if (!packed.ok) return [];

  const sourceRef = packed.sourceRef;
  const sourceTimestamp = evidence.indexed.sentAt;
  const haystack = haystackOf(evidence.indexed.subject, evidence.plaintext ?? null);
  const personHit = resolvePersonHit({
    fromEmailHash: evidence.fromEmailHash ?? evidence.indexed.fromEmailHash,
    threadId: evidence.indexed.threadId,
    people: world.people,
    internalEmailHashes: world.internalEmailHashes,
    confirmedParticipantMappings: world.confirmedParticipantMappings,
    confirmedSourceLinks: world.confirmedSourceLinks,
    founderConfirmedEmailIdentities: world.founderConfirmedEmailIdentities,
  });
  const newProjectHits = extractNewProject(haystack);
  const projectHits = resolveProjectHits({
    threadId: evidence.indexed.threadId,
    haystack,
    person: newProjectHits.length > 0 ? null : personHit.person,
    projects: world.projects,
  });

  const drafts: ContinuumCandidateDraft[] = [];
  const base = {
    sourceSystem: GMAIL_SOURCE_SYSTEM,
    sourceRef,
    sourceTimestamp,
    createdAt,
    canonical: false as const,
    automaticApply: false as const,
    parserVersion: CANDIDATE_PARSER_GMAIL_V1,
  };

  const transactional = looksTransactionalCustomerNotice(haystack);
  if (
    !personHit.internal &&
    personHit.emailHash &&
    !transactional &&
    evidence.indexed.direction === "inbound"
  ) {
    drafts.push({
      ...base,
      candidateId: "",
      candidateType: "person_association",
      proposedTarget: {
        kind: "person",
        personId: personHit.person?.personId ?? null,
      },
      payload: {
        kind: "person_association",
        displayName:
          personHit.person?.displayName ?? personHit.possiblePerson?.displayName ?? null,
        emailHash: personHit.emailHash,
        mintPerson: false,
        mergePersons: false,
      },
      confidence: personHit.collisionPersonIds.length
        ? "ambiguous"
        : personHit.person
          ? "high"
          : personHit.possiblePerson
            ? "medium"
            : "low",
      evidenceBasis: {
        ruleIds: personHit.ruleIds,
        matchedText: null,
      },
      candidateState: "active",
    });
  }

  if (transactional) {
    const customerLabel = extractCustomerLabel(haystack);
    const seenHashes = new Set<string>();
    for (const email of extractCustomerEmails(haystack)) {
      const emailHash = hashEmail(email);
      if (!emailHash || seenHashes.has(emailHash)) continue;
      seenHashes.add(emailHash);
      const customerHit = resolvePersonHit({
        fromEmailHash: emailHash,
        threadId: evidence.indexed.threadId,
        people: world.people,
        internalEmailHashes: world.internalEmailHashes,
        confirmedParticipantMappings: world.confirmedParticipantMappings,
        confirmedSourceLinks: world.confirmedSourceLinks,
        founderConfirmedEmailIdentities: world.founderConfirmedEmailIdentities,
      });
      if (customerHit.internal) continue;
      drafts.push({
        ...base,
        candidateId: "",
        candidateType: "person_association",
        proposedTarget: {
          kind: "person",
          personId: customerHit.person?.personId ?? null,
        },
        payload: {
          kind: "person_association",
          displayName:
            customerHit.person?.displayName ??
            customerHit.possiblePerson?.displayName ??
            customerLabel,
          emailHash,
          mintPerson: false,
          mergePersons: false,
        },
        confidence: customerHit.person
          ? "high"
          : customerHit.possiblePerson
            ? "medium"
            : "low",
        evidenceBasis: {
          ruleIds: customerHit.ruleIds,
          matchedText: customerLabel,
        },
        candidateState: "active",
      });
    }
  }

  for (const hit of projectHits) {
    drafts.push({
      ...base,
      candidateId: "",
      candidateType: "project_association",
      proposedTarget: { kind: "project", projectId: hit.project.projectId },
      payload: {
        kind: "project_association",
        title: hit.project.title,
        token: hit.token,
        match: hit.match,
      },
      confidence: hit.match === "exact" ? "high" : "ambiguous",
      evidenceBasis: {
        ruleIds: hit.ruleIds,
        matchedText: hit.token,
      },
      candidateState: "active",
    });
  }

  const specProjects =
    projectHits.length > 0 ? projectHits.map((row) => row.project) : [null];
  for (const project of specProjects) {
    for (const spec of extractStructuredSpecs(haystack, project)) {
      drafts.push({
        ...base,
        candidateId: "",
        candidateType: "structured_spec",
        proposedTarget: {
          kind: "project_spec",
          projectId: project?.projectId ?? null,
          fieldName: spec.fieldName,
        },
        payload: {
          kind: "structured_spec",
          fieldName: spec.fieldName,
          proposedValue: spec.proposedValue,
          currentValue: spec.currentValue,
          conflict: spec.conflict,
        },
        confidence: spec.conflict ? "ambiguous" : project ? "high" : "medium",
        evidenceBasis: {
          ruleIds: spec.conflict
            ? [...spec.ruleIds, "spec_conflict_review_required"]
            : spec.ruleIds,
          matchedText: spec.matchedText,
        },
        candidateState: spec.conflict ? "conflict" : "active",
      });
    }
  }

  const primaryProject = projectHits.length === 1 ? projectHits[0]!.project : null;
  const exactThreadProject = projectHits.some(
    (hit) =>
      hit.match === "exact" && hit.ruleIds.includes("exact_gmail_thread"),
  );

  if (!exactThreadProject) {
    for (const hit of newProjectHits) {
      drafts.push({
        ...base,
        candidateId: "",
        candidateType: "project_context",
        proposedTarget: { kind: "project", projectId: null },
        payload: {
          kind: "project_context",
          topic: NEW_PROJECT_CONTEXT_TOPIC,
          value: hit.title,
        },
        confidence: personHit.person ? "high" : "medium",
        evidenceBasis: { ruleIds: hit.ruleIds, matchedText: hit.matchedText },
        candidateState: "active",
      });
      for (const ctx of extractNewProjectContexts(haystack)) {
        drafts.push({
          ...base,
          candidateId: "",
          candidateType: "project_context",
          proposedTarget: { kind: "project", projectId: null },
          payload: {
            kind: "project_context",
            topic: ctx.topic,
            value: ctx.value,
          },
          confidence: "medium",
          evidenceBasis: { ruleIds: ctx.ruleIds, matchedText: ctx.matchedText },
          candidateState: "active",
        });
      }
      for (const attachment of evidence.attachments ?? []) {
        const filename = attachment.filename?.trim();
        if (!filename) continue;
        drafts.push({
          ...base,
          candidateId: "",
          candidateType: "project_context",
          proposedTarget: { kind: "project", projectId: null },
          payload: {
            kind: "project_context",
            topic: ATTACHMENT_FILENAME_TOPIC,
            value: filename,
          },
          confidence: "high",
          evidenceBasis: {
            ruleIds: ["attachment_filename_only"],
            matchedText: filename.slice(0, 80),
          },
          candidateState: "active",
        });
      }
    }
  }

  for (const ctx of extractProjectContext(haystack)) {
    drafts.push({
      ...base,
      candidateId: "",
      candidateType: "project_context",
      proposedTarget: {
        kind: "project",
        projectId: primaryProject?.projectId ?? null,
      },
      payload: {
        kind: "project_context",
        topic: ctx.topic,
        value: ctx.value,
      },
      confidence: primaryProject ? "medium" : "low",
      evidenceBasis: { ruleIds: ctx.ruleIds, matchedText: ctx.matchedText },
      candidateState: "active",
    });
  }

  for (const note of extractNotes(haystack)) {
    drafts.push({
      ...base,
      candidateId: "",
      candidateType: "note",
      proposedTarget: {
        kind: "project",
        projectId: primaryProject?.projectId ?? null,
      },
      payload: {
        kind: "note",
        text: note.text,
        contextLayer: "client",
      },
      confidence: "medium",
      evidenceBasis: { ruleIds: note.ruleIds, matchedText: note.matchedText },
      candidateState: "active",
    });
  }

  const role = senderRole(
    personHit.person ?? personHit.possiblePerson,
    evidence.indexed.direction,
  );
  for (const job of extractOpenJobs(haystack, evidence.indexed.direction, role)) {
    drafts.push({
      ...base,
      candidateId: "",
      candidateType: "open_job",
      proposedTarget: {
        kind: "open_job",
        projectId: primaryProject?.projectId ?? null,
      },
      payload: {
        kind: "open_job",
        jobKind: job.jobKind,
        subject: job.subject,
        detail: job.matchedText,
        waitingOnActor: job.waitingOnActor,
        dueAt: null,
        createJob: false,
      },
      confidence: "medium",
      evidenceBasis: { ruleIds: job.ruleIds, matchedText: job.matchedText },
      candidateState: "active",
    });
  }

  for (const date of extractDates(haystack, sourceTimestamp)) {
    if (date.followUp) {
      drafts.push({
        ...base,
        candidateId: "",
        candidateType: "follow_up",
        proposedTarget: {
          kind: "project",
          projectId: primaryProject?.projectId ?? null,
        },
        payload: {
          kind: "follow_up",
          text: date.matchedText,
          dueAt: date.isoDate,
          sourceTimestamp,
        },
        confidence: date.isoDate ? "medium" : "low",
        evidenceBasis: { ruleIds: date.ruleIds, matchedText: date.matchedText },
        candidateState: "active",
      });
    } else {
      drafts.push({
        ...base,
        candidateId: "",
        candidateType: "date",
        proposedTarget: {
          kind: "project",
          projectId: primaryProject?.projectId ?? null,
        },
        payload: {
          kind: "date",
          raw: date.raw,
          isoDate: date.isoDate,
          precision: date.precision,
          role: date.role,
          sourceTimestamp,
          resolutionCalendar: date.isoDate ? "source-timestamp-utc-date" : null,
        },
        confidence: date.isoDate ? "high" : "ambiguous",
        evidenceBasis: { ruleIds: date.ruleIds, matchedText: date.matchedText },
        candidateState: "active",
      });
    }
  }

  return drafts;
}

export function proposeGmailCandidates(
  input: ProposeGmailCandidatesInput,
): ProposeGmailCandidatesResult {
  const createdAt = input.createdAt ?? new Date(0).toISOString();
  const drafts: ContinuumCandidateDraft[] = [];
  for (const evidence of input.evidence) {
    drafts.push(...draftsFromEvidence(evidence, input.world, createdAt));
  }
  const reconciled = reconcileThreadCandidates({
    drafts,
    evidence: input.evidence,
    createdAt,
  });
  return {
    candidates: assignReconciledCandidates(reconciled),
    mutationBoundary: CANDIDATE_MUTATION_BOUNDARY,
    liveModelCalls: false,
    parserVersion: CANDIDATE_PARSER_GMAIL_V1,
  };
}
