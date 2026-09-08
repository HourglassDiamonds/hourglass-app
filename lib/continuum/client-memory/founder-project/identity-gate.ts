/**
 * Founder confirmation of Gmail Person association before Project create.
 * Uses shared CandidateStore review. Does not mint or merge Persons.
 */

import {
  effectiveCandidatePayload,
  effectiveCandidateTarget,
} from "@/lib/continuum/candidates/review";
import type {
  CandidateStore,
  ContinuumCandidate,
} from "@/lib/continuum/candidates/types";
import { isStrongGmailIdentityRule } from "@/lib/continuum/gmail/candidates/associate";
import { parseGmailCandidateSourceRef } from "@/lib/continuum/gmail/candidates/source-ref";

export type ConfirmedGmailPerson = {
  personId: string;
  candidateId: string;
  source: "approved-association" | "confirmed-mapping";
};

function threadIdOf(row: ContinuumCandidate): string | null {
  return parseGmailCandidateSourceRef(row.sourceRef)?.threadId ?? null;
}

function personIdOf(row: ContinuumCandidate): string | null {
  const target = effectiveCandidateTarget(row);
  return target.kind === "person" ? target.personId : null;
}

export function confirmedPersonFromThread(
  rows: readonly ContinuumCandidate[],
  threadId: string,
): ConfirmedGmailPerson | null {
  const matches: ConfirmedGmailPerson[] = [];
  for (const row of rows) {
    if (row.candidateType !== "person_association") continue;
    if (row.candidateState === "superseded") continue;
    if (threadIdOf(row) !== threadId) continue;
    const personId = personIdOf(row);
    if (!personId) continue;
    if (row.reviewStatus === "approved") {
      matches.push({
        personId,
        candidateId: row.candidateId,
        source: "approved-association",
      });
      continue;
    }
    if (
      row.reviewStatus === "pending" &&
      isStrongGmailIdentityRule(row.evidenceBasis.ruleIds)
    ) {
      matches.push({
        personId,
        candidateId: row.candidateId,
        source: "confirmed-mapping",
      });
    }
  }
  const ids = [...new Set(matches.map((row) => row.personId))];
  if (ids.length !== 1) return null;
  const approved = matches.find((row) => row.source === "approved-association");
  return approved ?? matches[0] ?? null;
}

export function pendingPersonAssociationOnThread(
  rows: readonly ContinuumCandidate[],
  threadId: string,
): ContinuumCandidate | null {
  const pending = rows.filter((row) => {
    if (row.candidateType !== "person_association") return false;
    if (row.reviewStatus !== "pending") return false;
    if (row.candidateState === "superseded") return false;
    return threadIdOf(row) === threadId;
  });
  return pending[0] ?? null;
}

export type ConfirmGmailPersonInput = {
  candidateId: string;
  personId: string;
  actor: string;
};

export type ConfirmGmailPersonResult =
  | { ok: true; candidate: ContinuumCandidate; personId: string }
  | {
      ok: false;
      reason:
        | "not-found"
        | "not-person-association"
        | "already-reviewed"
        | "person-not-found"
        | "review-unpersisted";
    };

export async function confirmGmailPersonAssociation(input: {
  store: CandidateStore;
  personExists: (personId: string) => Promise<boolean>;
  body: ConfirmGmailPersonInput;
  nowIso?: string;
}): Promise<ConfirmGmailPersonResult> {
  const candidate = await input.store.get(input.body.candidateId);
  if (!candidate) return { ok: false, reason: "not-found" };
  if (candidate.candidateType !== "person_association") {
    return { ok: false, reason: "not-person-association" };
  }
  if (candidate.reviewStatus !== "pending") {
    return { ok: false, reason: "already-reviewed" };
  }
  const personId = input.body.personId.trim();
  if (!personId || !(await input.personExists(personId))) {
    return { ok: false, reason: "person-not-found" };
  }
  const payload = effectiveCandidatePayload(candidate);
  if (payload.kind !== "person_association") {
    return { ok: false, reason: "not-person-association" };
  }
  const now = input.nowIso ?? new Date().toISOString();
  const edited = await input.store.applyReview(
    candidate.candidateId,
    {
      action: "edit",
      payload: {
        kind: "person_association",
        displayName: payload.displayName,
        emailHash: payload.emailHash,
        mintPerson: false,
        mergePersons: false,
      },
      proposedTarget: { kind: "person", personId },
    },
    now,
  );
  if (!edited.ok) return { ok: false, reason: "review-unpersisted" };
  const approved = await input.store.applyReview(
    candidate.candidateId,
    { action: "approve" },
    now,
  );
  if (!approved.ok) return { ok: false, reason: "review-unpersisted" };
  void input.body.actor;
  return { ok: true, candidate: approved.record, personId };
}
