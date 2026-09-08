/**
 * Founder-facing grouping of Gmail new-project Candidates.
 * Proposals only. Does not write.
 */

import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { parseGmailCandidateSourceRef } from "@/lib/continuum/gmail/candidates/source-ref";
import {
  ATTACHMENT_FILENAME_TOPIC,
  DESIGN_BASIS_TOPIC,
  GIFT_CONTEXT_TOPIC,
  NEW_PROJECT_CONTEXT_TOPIC,
  PROPOSED_SPEC_TOPIC,
  WAITING_ON_CLIENT_TOPIC,
} from "@/lib/continuum/gmail/candidates/new-project";

export type GmailNewProjectIntakeCard = {
  candidateId: string;
  threadId: string;
  title: string;
  personId: string | null;
  personName: string | null;
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

export function presentGmailNewProjectIntake(
  rows: readonly ContinuumCandidate[],
): GmailNewProjectIntakeCard[] {
  const pending = rows.filter(
    (row) => row.reviewStatus === "pending" && row.candidateState !== "superseded",
  );
  const byThread = new Map<string, ContinuumCandidate[]>();
  for (const row of pending) {
    const threadId = threadIdOf(row);
    if (!threadId) continue;
    const list = byThread.get(threadId) ?? [];
    list.push(row);
    byThread.set(threadId, list);
  }
  const cards: GmailNewProjectIntakeCard[] = [];
  for (const [threadId, list] of byThread) {
    const neu = list.find(
      (row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
    );
    if (!neu || neu.payload.kind !== "project_context") continue;
    const person = list.find((row) => row.candidateType === "person_association");
    const personId =
      person?.proposedTarget.kind === "person" ? person.proposedTarget.personId : null;
    const personName =
      person?.payload.kind === "person_association" ? person.payload.displayName : null;
    const waiting = list.find(
      (row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === WAITING_ON_CLIENT_TOPIC,
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
      personId,
      personName,
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
