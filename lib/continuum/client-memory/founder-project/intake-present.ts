/**
 * Founder-facing grouping of Gmail new-project Candidates.
 * Proposals only. Does not write.
 */

import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import {
  effectiveCandidatePayload,
  effectiveCandidateTarget,
} from "@/lib/continuum/candidates/review";
import { parseGmailCandidateSourceRef } from "@/lib/continuum/gmail/candidates/source-ref";
import { isStrongGmailIdentityRule } from "@/lib/continuum/gmail/candidates/associate";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import {
  ATTACHMENT_FILENAME_TOPIC,
  DESIGN_BASIS_TOPIC,
  GIFT_CONTEXT_TOPIC,
  NEW_PROJECT_CONTEXT_TOPIC,
  PROPOSED_SPEC_TOPIC,
  WAITING_ON_CLIENT_TOPIC,
} from "@/lib/continuum/gmail/candidates/new-project";
import type { GmailIntakePersonDirectoryRow } from "./gmail-world";

export type GmailNewProjectIntakeCard = {
  candidateId: string;
  threadId: string;
  title: string;
  personId: string | null;
  personName: string | null;
  personEmail: string | null;
  identityConfirmed: boolean;
  personAssociationCandidateId: string | null;
  possiblePersonId: string | null;
  possiblePersonName: string | null;
  possiblePersonEmail: string | null;
  waitingOnClient: string | null;
  giftContext: string | null;
  designBasis: string | null;
  proposedSpecs: string[];
  structuredSpecs: Array<{ fieldName: string; proposedValue: string }>;
  attachmentFilenames: string[];
};

function threadIdOf(row: ContinuumCandidate): string | null {
  return parseGmailCandidateSourceRef(row.sourceRef)?.threadId ?? null;
}

function directoryMatchForHash(
  emailHash: string | null,
  directory: readonly GmailIntakePersonDirectoryRow[],
): GmailIntakePersonDirectoryRow | null {
  if (!emailHash) return null;
  const matched = directory.filter((row) => hashEmail(row.email) === emailHash);
  return matched.length === 1 ? matched[0]! : null;
}

function pickPersonAssociation(
  list: readonly ContinuumCandidate[],
): ContinuumCandidate | null {
  const people = list.filter((row) => row.candidateType === "person_association");
  const approved = people.find(
    (row) => row.reviewStatus === "approved" && row.candidateState !== "superseded",
  );
  if (approved) return approved;
  const strong = people.find(
    (row) =>
      row.reviewStatus === "pending" &&
      row.candidateState !== "superseded" &&
      isStrongGmailIdentityRule(row.evidenceBasis.ruleIds),
  );
  if (strong) return strong;
  return (
    people.find(
      (row) => row.reviewStatus === "pending" && row.candidateState !== "superseded",
    ) ?? null
  );
}

export function presentGmailNewProjectIntake(
  rows: readonly ContinuumCandidate[],
  directory: readonly GmailIntakePersonDirectoryRow[] = [],
): GmailNewProjectIntakeCard[] {
  const pendingNew = rows.filter(
    (row) =>
      row.reviewStatus === "pending" &&
      row.candidateState !== "superseded" &&
      row.payload.kind === "project_context" &&
      row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
  );
  const cards: GmailNewProjectIntakeCard[] = [];
  const seenThreads = new Set<string>();
  for (const neu of pendingNew) {
    if (neu.payload.kind !== "project_context") continue;
    const threadId = threadIdOf(neu);
    if (!threadId || seenThreads.has(threadId)) continue;
    seenThreads.add(threadId);
    const list = rows.filter((row) => threadIdOf(row) === threadId);
    const person = pickPersonAssociation(list);
    const personTarget = person ? effectiveCandidateTarget(person) : null;
    const personPayload = person ? effectiveCandidatePayload(person) : null;
    const confirmedPersonId =
      personTarget?.kind === "person" &&
      personTarget.personId &&
      (person?.reviewStatus === "approved" ||
        isStrongGmailIdentityRule(person?.evidenceBasis.ruleIds ?? []))
        ? personTarget.personId
        : null;
    const emailHash =
      personPayload?.kind === "person_association" ? personPayload.emailHash : null;
    const possible = directoryMatchForHash(emailHash, directory);
    const confirmedDirectory = confirmedPersonId
      ? directory.find((row) => row.personId === confirmedPersonId) ?? null
      : null;
    const waiting = list.find(
      (row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === WAITING_ON_CLIENT_TOPIC &&
        row.reviewStatus === "pending" &&
        row.candidateState !== "superseded",
    );
    const gift = list.find(
      (row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === GIFT_CONTEXT_TOPIC,
    );
    const basis = list.find(
      (row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === DESIGN_BASIS_TOPIC,
    );
    cards.push({
      candidateId: neu.candidateId,
      threadId,
      title: neu.payload.value,
      personId: confirmedPersonId,
      personName:
        confirmedDirectory?.displayName ??
        (personPayload?.kind === "person_association" && confirmedPersonId
          ? personPayload.displayName
          : null),
      personEmail: confirmedDirectory?.email ?? null,
      identityConfirmed: Boolean(confirmedPersonId),
      personAssociationCandidateId: person?.candidateId ?? null,
      possiblePersonId: confirmedPersonId ? null : possible?.personId ?? null,
      possiblePersonName:
        confirmedPersonId
          ? null
          : possible?.displayName ??
            (personPayload?.kind === "person_association" ? personPayload.displayName : null),
      possiblePersonEmail: confirmedPersonId ? null : possible?.email ?? null,
      waitingOnClient:
        waiting && waiting.payload.kind === "project_context" ? waiting.payload.value : null,
      giftContext: gift && gift.payload.kind === "project_context" ? gift.payload.value : null,
      designBasis: basis && basis.payload.kind === "project_context" ? basis.payload.value : null,
      proposedSpecs: list.flatMap((row) =>
        row.payload.kind === "project_context" && row.payload.topic === PROPOSED_SPEC_TOPIC
          ? [row.payload.value]
          : [],
      ),
      structuredSpecs: list.flatMap((row) =>
        row.payload.kind === "structured_spec"
          ? [{ fieldName: row.payload.fieldName, proposedValue: row.payload.proposedValue }]
          : [],
      ),
      attachmentFilenames: list.flatMap((row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === ATTACHMENT_FILENAME_TOPIC
          ? [row.payload.value]
          : [],
      ),
    });
  }
  return cards.sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }));
}
