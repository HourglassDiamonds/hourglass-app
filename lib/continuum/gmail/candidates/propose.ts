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
import { historicalQuotedIdentifiers } from "../identifier-role";
import {
  ATTACHMENT_FILENAME_TOPIC,
  extractCustomerEmails,
  extractCustomerLabel,
  extractNewProject,
  extractNewProjectContexts,
  looksTransactionalCustomerNotice,
  NEW_PROJECT_CONTEXT_TOPIC,
} from "./new-project";
import {
  isGeneratedFounderOperatingMail,
  withGeneratedFounderOperatingBriefRule,
} from "./generated-source";
import { packGmailCandidateSourceRef } from "./source-ref";
import {
  attachStructuredSpecProvenance,
  authorOwnedHaystack,
  quotedText,
  QUOTED_HISTORICAL_EVIDENCE_RULE,
} from "./spec-provenance";
import { attachObservedSupportingGmailProvenance } from "./supporting-source";
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
  supportingThreadIds?: readonly string[];
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
  supportingThreadIds: ReadonlySet<string>,
): ContinuumCandidateDraft[] {
  const packed = packGmailCandidateSourceRef({
    threadId: evidence.indexed.threadId,
    messageId: evidence.indexed.messageId,
  });
  if (!packed.ok) return [];

  const sourceRef = packed.sourceRef;
  const sourceTimestamp = evidence.indexed.sentAt;
  const haystack = haystackOf(evidence.indexed.subject, evidence.plaintext ?? null);
  const ownHaystack = authorOwnedHaystack(
    evidence.indexed.subject,
    evidence.plaintext ?? null,
  );
  const personHit = resolvePersonHit({
    fromEmailHash: evidence.fromEmailHash ?? evidence.indexed.fromEmailHash,
    threadId: evidence.indexed.threadId,
    people: world.people,
    internalEmailHashes: world.internalEmailHashes,
    confirmedParticipantMappings: world.confirmedParticipantMappings,
    confirmedSourceLinks: world.confirmedSourceLinks,
    founderConfirmedEmailIdentities: world.founderConfirmedEmailIdentities,
  });
  const newProjectHits = extractNewProject(ownHaystack);
  const projectHits = resolveProjectHits({
    threadId: evidence.indexed.threadId,
    haystack: ownHaystack,
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
  const quotedHay = quotedText(evidence.plaintext ?? null);
  for (const project of specProjects) {
    const ownSpecs = extractStructuredSpecs(ownHaystack, project);
    const ownSpecKeys = new Set(
      ownSpecs.map((hit) => `${hit.fieldName}:${hit.proposedValue.trim().toLowerCase()}`),
    );
    for (const spec of ownSpecs) {
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
    for (const spec of extractStructuredSpecs(quotedHay, project)) {
      const key = `${spec.fieldName}:${spec.proposedValue.trim().toLowerCase()}`;
      if (ownSpecKeys.has(key)) continue;
      drafts.push({
        ...base,
        candidateId: "",
        candidateType: "project_context",
        proposedTarget: { kind: "none" },
        payload: {
          kind: "project_context",
          topic: `historical_quoted_${spec.fieldName}`,
          value: spec.proposedValue,
        },
        confidence: "low",
        evidenceBasis: {
          ruleIds: [QUOTED_HISTORICAL_EVIDENCE_RULE, ...spec.ruleIds],
          matchedText: spec.matchedText,
        },
        candidateState: "active",
      });
    }
  }

  const uniqueProjectIds = new Set(
    projectHits.map((hit) => hit.project.projectId),
  );
  const primaryProject =
    uniqueProjectIds.size === 1 ? projectHits[0]!.project : null;
  const exactThreadProject = projectHits.some(
    (hit) =>
      hit.match === "exact" && hit.ruleIds.includes("exact_gmail_thread"),
  );
  const linkedThread = (world.linkedGmailThreadIds ?? []).includes(
    evidence.indexed.threadId,
  );

  const supporting = supportingThreadIds.has(evidence.indexed.threadId);
  if (!exactThreadProject && !linkedThread && !supporting) {
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
      for (const ctx of extractNewProjectContexts(ownHaystack)) {
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

  for (const ctx of extractProjectContext(ownHaystack)) {
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

  for (const hit of historicalQuotedIdentifiers(
    ownHaystack,
    quotedText(evidence.plaintext ?? null),
  )) {
    const topic =
      hit.role === "cadId"
        ? "historical_cad_job_number"
        : hit.role === "repairJobId"
          ? "historical_repair_job_id"
          : hit.role === "productionJobId"
            ? "historical_production_job_id"
            : hit.role === "vendorOrderId"
              ? "historical_vendor_order_id"
              : "historical_workshop_job_id";
    drafts.push({
      ...base,
      candidateId: "",
      candidateType: "project_context",
      proposedTarget: { kind: "none" },
      payload: {
        kind: "project_context",
        topic,
        value: hit.value,
      },
      confidence: "low",
      evidenceBasis: {
        ruleIds: ["historical_quoted_identifier", `exact_${hit.role}`],
        matchedText: hit.value,
      },
      candidateState: "active",
    });
  }

  for (const note of extractNotes(ownHaystack)) {
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
  for (const note of extractNotes(quotedHay)) {
    drafts.push({
      ...base,
      candidateId: "",
      candidateType: "project_context",
      proposedTarget: { kind: "none" },
      payload: {
        kind: "project_context",
        topic: "historical_quoted_note",
        value: note.text,
      },
      confidence: "low",
      evidenceBasis: {
        ruleIds: [QUOTED_HISTORICAL_EVIDENCE_RULE, ...note.ruleIds],
        matchedText: note.matchedText,
      },
      candidateState: "active",
    });
  }

  const role = senderRole(
    personHit.person ?? personHit.possiblePerson,
    evidence.indexed.direction,
  );
  for (const job of extractOpenJobs(ownHaystack, evidence.indexed.direction, role)) {
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

  for (const date of extractDates(ownHaystack, sourceTimestamp)) {
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

  const generated = isGeneratedFounderOperatingMail(
    evidence.fromEmailHash ?? evidence.indexed.fromEmailHash,
    world.generatedEmailHashes,
  );
  if (!generated) return drafts;
  return drafts.map((draft) => ({
    ...draft,
    evidenceBasis: {
      ...draft.evidenceBasis,
      ruleIds: withGeneratedFounderOperatingBriefRule(draft.evidenceBasis.ruleIds, true),
    },
  }));
}

export function proposeGmailCandidates(
  input: ProposeGmailCandidatesInput,
): ProposeGmailCandidatesResult {
  const createdAt = input.createdAt ?? new Date(0).toISOString();
  const supportingThreadIds = new Set(input.supportingThreadIds ?? []);
  const drafts: ContinuumCandidateDraft[] = [];
  for (const evidence of input.evidence) {
    drafts.push(
      ...draftsFromEvidence(evidence, input.world, createdAt, supportingThreadIds),
    );
  }
  const reconciled = reconcileThreadCandidates({
    drafts,
    evidence: input.evidence,
    createdAt,
    linkedGmailThreadIds: input.world.linkedGmailThreadIds,
    supportingThreadIds: [...supportingThreadIds],
    internalEmailHashes: input.world.internalEmailHashes,
  });
  return {
    candidates: attachObservedSupportingGmailProvenance(
      assignReconciledCandidates(
        attachStructuredSpecProvenance(reconciled, input.evidence),
      ),
    ),
    mutationBoundary: CANDIDATE_MUTATION_BOUNDARY,
    liveModelCalls: false,
    parserVersion: CANDIDATE_PARSER_GMAIL_V1,
  };
}
