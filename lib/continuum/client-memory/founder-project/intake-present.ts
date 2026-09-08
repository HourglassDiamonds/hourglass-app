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
  EXPLICIT_NEW_PROJECT_RULE,
  GIFT_CONTEXT_TOPIC,
  NEW_PROJECT_CONTEXT_TOPIC,
  PROPOSED_SPEC_TOPIC,
  REACTIVATED_COMMERCIAL_WORK_RULE,
  TRANSACTIONAL_CUSTOMER_NOTICE_RULE,
  WAITING_ON_CLIENT_TOPIC,
} from "@/lib/continuum/gmail/candidates/new-project";
import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import type { GmailIntakePersonDirectoryRow } from "./gmail-world";

export type GmailIntakeCurrentStateKind = "waiting_on_client" | "founder_turn";

export type GmailIntakeWorkStatus =
  | "new_project"
  | "opportunity_reactivated"
  | "payment_received";

export type GmailIntakePersonRoleKind =
  | "original_inquiry"
  | "current_correspondent"
  | "mentioned";

export type GmailIntakePersonRole = {
  displayName: string | null;
  email: string | null;
  personId: string | null;
  role: GmailIntakePersonRoleKind;
};

export type GmailIntakeThreadTurn = {
  threadId: string;
  latestSentAt: string;
  latestDirection: GmailIndexedMessage["direction"];
  latestMessageId: string;
  latestOutboundAt: string | null;
  latestOutboundMessageId: string | null;
};

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
  people: GmailIntakePersonRole[];
  workStatus: GmailIntakeWorkStatus;
  whySurfaced: string;
  canonicalProjectFound: boolean;
  waitingOnClient: string | null;
  currentStateKind: GmailIntakeCurrentStateKind | null;
  currentStateSummary: string | null;
  giftContext: string | null;
  designBasis: string | null;
  proposedSpecs: string[];
  structuredSpecs: Array<{ fieldName: string; proposedValue: string }>;
  attachmentFilenames: string[];
  supportingObservationCount: number;
};

function threadIdOf(row: ContinuumCandidate): string | null {
  return parseGmailCandidateSourceRef(row.sourceRef)?.threadId ?? null;
}

function messageIdOf(row: ContinuumCandidate): string | null {
  return parseGmailCandidateSourceRef(row.sourceRef)?.messageId ?? null;
}

function sentMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function directoryMatchForHash(
  emailHash: string | null,
  directory: readonly GmailIntakePersonDirectoryRow[],
): GmailIntakePersonDirectoryRow | null {
  if (!emailHash) return null;
  const matched = directory.filter((row) => hashEmail(row.email) === emailHash);
  return matched.length === 1 ? matched[0]! : null;
}

function workStatusOf(row: ContinuumCandidate): GmailIntakeWorkStatus {
  const rules = row.evidenceBasis.ruleIds;
  if (rules.includes(TRANSACTIONAL_CUSTOMER_NOTICE_RULE)) return "payment_received";
  if (rules.includes(REACTIVATED_COMMERCIAL_WORK_RULE)) return "opportunity_reactivated";
  if (rules.includes(EXPLICIT_NEW_PROJECT_RULE)) return "new_project";
  return "new_project";
}

export function whySurfacedForStatus(
  status: GmailIntakeWorkStatus,
  canonicalProjectFound = false,
): string {
  if (status === "payment_received") {
    return canonicalProjectFound
      ? "A payment or invoice notice names a customer with related jewelry mail already on a Project."
      : "A payment or invoice notice names a customer with related jewelry mail and no canonical Project.";
  }
  if (status === "opportunity_reactivated") {
    return "A correspondent is asking about price, timeline, or next steps on prior jewelry discussion.";
  }
  return "The thread contains an explicit new custom-piece request.";
}

function peopleForThread(
  list: readonly ContinuumCandidate[],
  directory: readonly GmailIntakePersonDirectoryRow[],
): GmailIntakePersonRole[] {
  const people = list
    .filter(
      (row) =>
        row.candidateType === "person_association" &&
        row.candidateState !== "superseded",
    )
    .sort((a, b) => sentMs(a.sourceTimestamp) - sentMs(b.sourceTimestamp));
  const seen = new Set<string>();
  const roles: GmailIntakePersonRole[] = [];
  for (const row of people) {
    const payload = effectiveCandidatePayload(row);
    const target = effectiveCandidateTarget(row);
    const emailHash =
      payload?.kind === "person_association" ? payload.emailHash : null;
    const key = `${target?.kind === "person" ? target.personId : ""}:${emailHash ?? ""}:${payload?.kind === "person_association" ? payload.displayName : ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const confirmed =
      target?.kind === "person" &&
      target.personId &&
      (row.reviewStatus === "approved" ||
        isStrongGmailIdentityRule(row.evidenceBasis.ruleIds))
        ? target.personId
        : null;
    const possible = directoryMatchForHash(emailHash, directory);
    const confirmedDirectory = confirmed
      ? directory.find((entry) => entry.personId === confirmed) ?? null
      : null;
    roles.push({
      displayName:
        confirmedDirectory?.displayName ??
        (payload?.kind === "person_association" ? payload.displayName : null) ??
        possible?.displayName ??
        null,
      email: confirmedDirectory?.email ?? possible?.email ?? null,
      personId: confirmed,
      role: "mentioned",
    });
  }
  return roles.map((person, roleIndex) => ({
    ...person,
    role:
      roles.length === 1
        ? "current_correspondent"
        : roleIndex === 0
          ? "original_inquiry"
          : roleIndex === roles.length - 1
            ? "current_correspondent"
            : "mentioned",
  }));
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
  const pending = people.filter(
    (row) => row.reviewStatus === "pending" && row.candidateState !== "superseded",
  );
  if (pending.length === 0) return null;
  return [...pending].sort(
    (a, b) => sentMs(b.sourceTimestamp) - sentMs(a.sourceTimestamp),
  )[0]!;
}

const GENERIC_NEW_PROJECT_TITLES = new Set([
  "Custom Earrings",
  "Custom Necklace / Pendant",
  "Custom Engagement Ring",
  "New custom piece",
]);

export function preferredNewProjectTitle(
  rows: readonly ContinuumCandidate[],
): { candidate: ContinuumCandidate; title: string } | null {
  const news = rows.filter(
    (row) =>
      row.reviewStatus === "pending" &&
      row.candidateState !== "superseded" &&
      row.payload.kind === "project_context" &&
      row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
  );
  if (news.length === 0) return null;
  const ranked = [...news].sort((a, b) => {
    const aTitle = a.payload.kind === "project_context" ? a.payload.value : "";
    const bTitle = b.payload.kind === "project_context" ? b.payload.value : "";
    const aGeneric = GENERIC_NEW_PROJECT_TITLES.has(aTitle) ? 1 : 0;
    const bGeneric = GENERIC_NEW_PROJECT_TITLES.has(bTitle) ? 1 : 0;
    if (aGeneric !== bGeneric) return aGeneric - bGeneric;
    return sentMs(b.sourceTimestamp) - sentMs(a.sourceTimestamp);
  });
  const winner = ranked[0]!;
  const title =
    winner.payload.kind === "project_context" ? winner.payload.value : "";
  return { candidate: winner, title };
}

function clientFirstName(name: string | null): string {
  const first = name?.trim().split(/\s+/)[0] ?? "";
  return first || "the client";
}

export function summarizeIntakeWaitingValue(
  value: string | null | undefined,
  clientName: string | null,
): string {
  const who = clientFirstName(clientName);
  const hay = (value ?? "").toLowerCase();
  if (hay.includes("call") && hay.includes("render")) {
    return `Waiting on ${who} — Justin offered either a call or moving directly to a first render.`;
  }
  if (hay.includes("call or first render")) {
    return `Waiting on ${who} — Justin offered either a call or moving directly to a first render.`;
  }
  return `Waiting on ${who} — Justin asked a design question.`;
}

export function founderTurnSummary(clientName: string | null): string {
  const who = clientFirstName(clientName);
  return `Your turn — ${who} replied after Justin's questions.`;
}

function waitingPayloadValue(row: ContinuumCandidate | null): string {
  return row && row.payload.kind === "project_context" ? row.payload.value : "";
}

export function pickWaitingSummaryValue(
  preferred: ContinuumCandidate | null,
  waitings: readonly ContinuumCandidate[],
): string {
  const values = waitings.map((row) => waitingPayloadValue(row));
  const callRender = values.find(
    (value) => /\bcall\b/i.test(value) && /\brender\b/i.test(value),
  );
  if (callRender) return callRender;
  return waitingPayloadValue(preferred) || "design question";
}

export function intakeCurrentState(input: {
  turn: GmailIntakeThreadTurn | null;
  waiting: ContinuumCandidate | null;
  waitings?: readonly ContinuumCandidate[];
  waitingForLatestOutbound: ContinuumCandidate | null;
  clientName: string | null;
}): {
  kind: GmailIntakeCurrentStateKind | null;
  summary: string | null;
  waitingOnClient: string | null;
} {
  const turn = input.turn;
  if (
    turn &&
    turn.latestDirection === "inbound" &&
    turn.latestOutboundAt &&
    sentMs(turn.latestSentAt) > sentMs(turn.latestOutboundAt)
  ) {
    const summary = founderTurnSummary(input.clientName);
    return { kind: "founder_turn", summary, waitingOnClient: null };
  }
  const waiting = input.waitingForLatestOutbound ?? input.waiting;
  const waitings = input.waitings ?? (waiting ? [waiting] : []);
  if (
    turn?.latestDirection === "outbound" ||
    (waiting &&
      (!turn ||
        turn.latestDirection !== "inbound" ||
        sentMs(waiting.sourceTimestamp) >= sentMs(turn.latestSentAt)))
  ) {
    const value = pickWaitingSummaryValue(waiting, waitings);
    const summary = summarizeIntakeWaitingValue(value, input.clientName);
    return { kind: "waiting_on_client", summary, waitingOnClient: summary };
  }
  if (waiting) {
    const value = pickWaitingSummaryValue(waiting, waitings);
    const summary = summarizeIntakeWaitingValue(value, input.clientName);
    return { kind: "waiting_on_client", summary, waitingOnClient: summary };
  }
  return { kind: null, summary: null, waitingOnClient: null };
}

export function newProjectThreadIds(
  rows: readonly ContinuumCandidate[],
): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (
      row.reviewStatus === "pending" &&
      row.candidateState !== "superseded" &&
      row.payload.kind === "project_context" &&
      row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC
    ) {
      const threadId = threadIdOf(row);
      if (threadId) ids.add(threadId);
    }
  }
  return [...ids];
}

export async function latestGmailIntakeTurns(
  index: {
    listMessagesByThread(threadId: string): Promise<GmailIndexedMessage[]>;
  },
  threadIds: readonly string[],
): Promise<GmailIntakeThreadTurn[]> {
  const out: GmailIntakeThreadTurn[] = [];
  for (const threadId of threadIds) {
    let rows: GmailIndexedMessage[] = [];
    try {
      rows = await index.listMessagesByThread(threadId);
    } catch {
      continue;
    }
    if (rows.length === 0) continue;
    const sorted = [...rows].sort((a, b) => sentMs(a.sentAt) - sentMs(b.sentAt));
    const latest = sorted[sorted.length - 1]!;
    const latestOutbound = [...sorted]
      .reverse()
      .find((row) => row.direction === "outbound");
    out.push({
      threadId,
      latestSentAt: latest.sentAt,
      latestDirection: latest.direction,
      latestMessageId: latest.messageId,
      latestOutboundAt: latestOutbound?.sentAt ?? null,
      latestOutboundMessageId: latestOutbound?.messageId ?? null,
    });
  }
  return out;
}

export function presentGmailNewProjectIntake(
  rows: readonly ContinuumCandidate[],
  directory: readonly GmailIntakePersonDirectoryRow[] = [],
  turns: readonly GmailIntakeThreadTurn[] = [],
): GmailNewProjectIntakeCard[] {
  const turnByThread = new Map(turns.map((row) => [row.threadId, row]));
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
    const threadId = threadIdOf(neu);
    if (!threadId || seenThreads.has(threadId)) continue;
    seenThreads.add(threadId);
    const list = rows.filter((row) => threadIdOf(row) === threadId);
    const preferred = preferredNewProjectTitle(list);
    if (!preferred) continue;
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
    const clientName =
      confirmedDirectory?.displayName ??
      (confirmedPersonId && personPayload?.kind === "person_association"
        ? personPayload.displayName
        : possible?.displayName ??
          (personPayload?.kind === "person_association" ? personPayload.displayName : null));
    const waitings = list.filter(
      (row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === WAITING_ON_CLIENT_TOPIC &&
        row.reviewStatus === "pending" &&
        row.candidateState !== "superseded",
    );
    const turn = turnByThread.get(threadId) ?? null;
    const waitingForLatestOutbound =
      waitings.find(
        (row) =>
          turn?.latestOutboundMessageId &&
          messageIdOf(row) === turn.latestOutboundMessageId,
      ) ??
      [...waitings].sort(
        (a, b) => sentMs(b.sourceTimestamp) - sentMs(a.sourceTimestamp),
      )[0] ??
      null;
    const waiting = waitingForLatestOutbound;
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
    const proposedSpecs = [
      ...new Set(
        list.flatMap((row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === PROPOSED_SPEC_TOPIC
            ? [row.payload.value]
            : [],
        ),
      ),
    ];
    const structuredSpecs = list.flatMap((row) =>
      row.payload.kind === "structured_spec"
        ? [{ fieldName: row.payload.fieldName, proposedValue: row.payload.proposedValue }]
        : [],
    );
    const uniqueStructured = new Map<string, { fieldName: string; proposedValue: string }>();
    for (const spec of structuredSpecs) {
      uniqueStructured.set(`${spec.fieldName}:${spec.proposedValue}`, spec);
    }
    const attachmentFilenames = [
      ...new Set(
        list.flatMap((row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === ATTACHMENT_FILENAME_TOPIC
            ? [row.payload.value]
            : [],
        ),
      ),
    ];
    const state = intakeCurrentState({
      turn,
      waiting,
      waitings,
      waitingForLatestOutbound,
      clientName,
    });
    const supportingObservationCount = list.filter((row) => {
      if (row.candidateId === preferred.candidate.candidateId) return false;
      if (row.candidateType === "person_association") return false;
      return true;
    }).length;
    const workStatus = workStatusOf(preferred.candidate);
    const canonicalProjectFound = list.some(
      (row) =>
        row.candidateType === "project_association" &&
        row.candidateState !== "superseded" &&
        row.evidenceBasis.ruleIds.includes("exact_gmail_thread"),
    );
    const people = peopleForThread(list, directory);
    cards.push({
      candidateId: preferred.candidate.candidateId,
      threadId,
      title: preferred.title,
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
      people,
      workStatus,
      whySurfaced: whySurfacedForStatus(workStatus, canonicalProjectFound),
      canonicalProjectFound,
      waitingOnClient: state.waitingOnClient,
      currentStateKind: state.kind,
      currentStateSummary: state.summary,
      giftContext: gift && gift.payload.kind === "project_context" ? gift.payload.value : null,
      designBasis: basis && basis.payload.kind === "project_context" ? basis.payload.value : null,
      proposedSpecs,
      structuredSpecs: [...uniqueStructured.values()],
      attachmentFilenames,
      supportingObservationCount,
    });
  }
  return cards.sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }));
}
