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
import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import type { GmailIntakePersonDirectoryRow } from "./gmail-world";

export type GmailIntakeCurrentStateKind = "waiting_on_client" | "founder_turn";

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

const GENERIC_NEW_PROJECT_TITLES = new Set([
  "Custom Earrings",
  "Custom Necklace / Pendant",
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
