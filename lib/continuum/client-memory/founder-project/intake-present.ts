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
  GENERIC_NEW_PROJECT_TITLES,
  GIFT_CONTEXT_TOPIC,
  NEW_PROJECT_CONTEXT_TOPIC,
  PROPOSED_SPEC_TOPIC,
  REACTIVATED_COMMERCIAL_WORK_RULE,
  TRANSACTIONAL_CUSTOMER_NOTICE_RULE,
  WAITING_ON_CLIENT_TOPIC,
} from "@/lib/continuum/gmail/candidates/new-project";
import type { GmailCandidateProject } from "@/lib/continuum/gmail/candidates/types";
import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import {
  CUSTOM_LIFECYCLE_STAGE_LABELS,
  REPAIR_LIFECYCLE_STAGE_LABELS,
} from "@/lib/continuum/client-memory/project-lifecycle";
import type { GmailIntakePersonDirectoryRow } from "./gmail-world";
import {
  canonicalProjectForGmailThread,
  knownGmailProjectThreadIds,
} from "./gmail-project-link";
import { confirmedPersonFromThread } from "./identity-gate";

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
  canonicalProjectId: string | null;
  canonicalProjectKind: string | null;
  lifecycleStage: string | null;
  lifecycleLabel: string | null;
  presentation: "proposal" | "current_project";
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

function receivedAmountFromCandidates(
  list: readonly ContinuumCandidate[],
): string | null {
  for (const row of list) {
    if (!row.evidenceBasis.ruleIds.includes(TRANSACTIONAL_CUSTOMER_NOTICE_RULE)) {
      continue;
    }
    const match = (row.evidenceBasis.matchedText ?? "").match(
      /\$[\d,]+(?:\.\d{2})?/,
    );
    if (match) return match[0];
  }
  return null;
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
  extras?: { receivedAmount?: string | null },
): string {
  if (status === "payment_received") {
    const amount = extras?.receivedAmount?.trim() ?? "";
    const prefix = amount ? `${amount} received. ` : "";
    return canonicalProjectFound
      ? `${prefix}A payment or invoice notice names a customer with related jewelry mail already on a Project.`
      : `${prefix}A payment or invoice notice names a customer with related jewelry mail and no canonical Project.`;
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
  return [...pending].sort((a, b) => {
    const sent = sentMs(b.sourceTimestamp) - sentMs(a.sourceTimestamp);
    if (sent !== 0) return sent;
    const aName =
      a.payload.kind === "person_association" ? (a.payload.displayName ?? "") : "";
    const bName =
      b.payload.kind === "person_association" ? (b.payload.displayName ?? "") : "";
    return bName.length - aName.length;
  })[0]!;
}

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
  const transactional = news.filter((row) =>
    row.evidenceBasis.ruleIds.includes(TRANSACTIONAL_CUSTOMER_NOTICE_RULE),
  );
  const pool = transactional.length > 0 ? transactional : news;
  const ranked = [...pool].sort((a, b) => {
    const created = sentMs(b.createdAt) - sentMs(a.createdAt);
    if (created !== 0) return created;
    const aTitle = a.payload.kind === "project_context" ? a.payload.value : "";
    const bTitle = b.payload.kind === "project_context" ? b.payload.value : "";
    const aGeneric = GENERIC_NEW_PROJECT_TITLES.has(aTitle) ? 1 : 0;
    const bGeneric = GENERIC_NEW_PROJECT_TITLES.has(bTitle) ? 1 : 0;
    if (aGeneric !== bGeneric) {
      return transactional.length > 0 ? bGeneric - aGeneric : aGeneric - bGeneric;
    }
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
  projects: readonly GmailCandidateProject[] = [],
): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (
      row.payload.kind === "project_context" &&
      row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC &&
      row.reviewStatus !== "discarded"
    ) {
      const threadId = threadIdOf(row);
      if (threadId) ids.add(threadId);
    }
  }
  for (const threadId of knownGmailProjectThreadIds(rows, projects)) {
    ids.add(threadId);
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

function noisyStructuredSpec(spec: { fieldName: string; proposedValue: string }): boolean {
  const value = spec.proposedValue.trim();
  if (!value) return true;
  if (
    spec.fieldName === "diamond_supply_notes" &&
    /\b(to|from|subject|cc|bcc)\s*:/i.test(value)
  ) {
    return true;
  }
  return false;
}

function lifecycleLabelOf(
  stage: string | null,
  projectKind: string | null,
): string | null {
  if (!stage) return null;
  if (projectKind === "custom_new_jewelry" && stage in CUSTOM_LIFECYCLE_STAGE_LABELS) {
    return CUSTOM_LIFECYCLE_STAGE_LABELS[stage as keyof typeof CUSTOM_LIFECYCLE_STAGE_LABELS];
  }
  if (projectKind === "repair_service" && stage in REPAIR_LIFECYCLE_STAGE_LABELS) {
    return REPAIR_LIFECYCLE_STAGE_LABELS[stage as keyof typeof REPAIR_LIFECYCLE_STAGE_LABELS];
  }
  return stage;
}

function exactAssociationProjectId(list: readonly ContinuumCandidate[]): string | null {
  const ids = [
    ...new Set(
      list.flatMap((row) => {
        if (row.candidateType !== "project_association") return [];
        if (row.candidateState === "superseded") return [];
        if (!row.evidenceBasis.ruleIds.includes("exact_gmail_thread")) return [];
        const target = effectiveCandidateTarget(row);
        if (target.kind !== "project" || !target.projectId) return [];
        return [target.projectId];
      }),
    ),
  ];
  return ids.length === 1 ? ids[0]! : null;
}

function personHintForThread(
  rows: readonly ContinuumCandidate[],
  threadId: string,
  directory: readonly GmailIntakePersonDirectoryRow[],
): string | null {
  const confirmed = confirmedPersonFromThread(rows, threadId);
  if (confirmed) return confirmed.personId;
  const list = rows.filter((row) => threadIdOf(row) === threadId);
  const person = pickPersonAssociation(list);
  const payload = person ? effectiveCandidatePayload(person) : null;
  const emailHash =
    payload?.kind === "person_association" ? payload.emailHash : null;
  return directoryMatchForHash(emailHash, directory)?.personId ?? null;
}

function approvedNewProjectOnThread(
  list: readonly ContinuumCandidate[],
): ContinuumCandidate | null {
  const approved = list.filter(
    (row) =>
      row.reviewStatus === "approved" &&
      row.payload.kind === "project_context" &&
      row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
  );
  if (approved.length === 0) return null;
  return [...approved].sort(
    (a, b) => sentMs(b.sourceTimestamp) - sentMs(a.sourceTimestamp),
  )[0]!;
}

function mergeIntakeCards(
  current: GmailNewProjectIntakeCard,
  incoming: GmailNewProjectIntakeCard,
): GmailNewProjectIntakeCard {
  const people = [...current.people];
  const seen = new Set(
    people.map((row) => `${row.personId ?? ""}:${row.email ?? ""}:${row.displayName ?? ""}`),
  );
  for (const person of incoming.people) {
    const key = `${person.personId ?? ""}:${person.email ?? ""}:${person.displayName ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    people.push(person);
  }
  const workStatus =
    current.workStatus === "payment_received" || incoming.workStatus === "payment_received"
      ? "payment_received"
      : current.workStatus === "opportunity_reactivated" ||
          incoming.workStatus === "opportunity_reactivated"
        ? "opportunity_reactivated"
        : current.workStatus;
  const specific =
    !GENERIC_NEW_PROJECT_TITLES.has(current.title) ? current : incoming;
  return {
    ...specific,
    people,
    workStatus,
    whySurfaced:
      workStatus === "payment_received"
        ? current.workStatus === "payment_received"
          ? current.whySurfaced
          : incoming.whySurfaced
        : whySurfacedForStatus(workStatus, specific.canonicalProjectFound),
    supportingObservationCount:
      current.supportingObservationCount + incoming.supportingObservationCount,
    proposedSpecs: [...new Set([...current.proposedSpecs, ...incoming.proposedSpecs])],
    structuredSpecs: [
      ...new Map(
        [...current.structuredSpecs, ...incoming.structuredSpecs].map((row) => [
          `${row.fieldName}:${row.proposedValue}`,
          row,
        ]),
      ).values(),
    ],
    attachmentFilenames: [
      ...new Set([...current.attachmentFilenames, ...incoming.attachmentFilenames]),
    ],
    identityConfirmed: current.identityConfirmed || incoming.identityConfirmed,
    personId: current.personId ?? incoming.personId,
    personName: current.personName ?? incoming.personName,
    personEmail: current.personEmail ?? incoming.personEmail,
  };
}

export function presentGmailNewProjectIntake(
  rows: readonly ContinuumCandidate[],
  directory: readonly GmailIntakePersonDirectoryRow[] = [],
  turns: readonly GmailIntakeThreadTurn[] = [],
  projects: readonly GmailCandidateProject[] = [],
): GmailNewProjectIntakeCard[] {
  const turnByThread = new Map(turns.map((row) => [row.threadId, row]));
  const threadIds = newProjectThreadIds(rows, projects);
  const cards: GmailNewProjectIntakeCard[] = [];
  for (const threadId of threadIds) {
    const list = rows.filter((row) => threadIdOf(row) === threadId);
    const preferred = preferredNewProjectTitle(list);
    const approved = approvedNewProjectOnThread(list);
    const personHint = personHintForThread(rows, threadId, directory);
    const paymentNotice = list.some(
      (row) =>
        row.reviewStatus === "pending" &&
        row.candidateState !== "superseded" &&
        row.evidenceBasis.ruleIds.includes(TRANSACTIONAL_CUSTOMER_NOTICE_RULE),
    );
    const linked = canonicalProjectForGmailThread({
      threadId,
      candidates: rows,
      projects,
      personIdHint: personHint,
      allowUnscopedExactTitle: !paymentNotice,
    });
    const associationId = exactAssociationProjectId(list);
    const associatedProject = associationId
      ? projects.find((row) => row.projectId === associationId) ?? null
      : null;
    const canonical =
      linked ??
      (associatedProject
        ? {
            projectId: associatedProject.projectId,
            title: associatedProject.title,
            projectKind: associatedProject.projectKind ?? null,
            lifecycleStage: associatedProject.lifecycleStage ?? null,
            link: "exact_gmail_thread" as const,
          }
        : associationId
          ? {
              projectId: associationId,
              title: preferred?.title ?? "Current project",
              projectKind: null,
              lifecycleStage: null,
              link: "exact_gmail_thread" as const,
            }
          : null);
    if (!canonical && !preferred) continue;
    const anchor = preferred?.candidate ?? approved;
    if (!anchor) continue;
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
    const projectPersonId =
      canonical && canonical.projectId
        ? projects.find((row) => row.projectId === canonical.projectId)?.personIds
        : null;
    const uniqueProjectPersonId =
      projectPersonId && projectPersonId.length === 1 ? projectPersonId[0]! : null;
    const displayPersonId = confirmedPersonId ?? (canonical ? uniqueProjectPersonId : null);
    const confirmedDirectory = displayPersonId
      ? directory.find((row) => row.personId === displayPersonId) ?? null
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
      if (noisyStructuredSpec(spec)) continue;
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
      if (row.candidateId === anchor.candidateId) return false;
      if (row.candidateType === "person_association") return false;
      return true;
    }).length;
    const workStatus = workStatusOf(anchor);
    const canonicalProjectFound = Boolean(canonical);
    const presentation = canonical ? "current_project" : "proposal";
    const people = peopleForThread(list, directory);
    cards.push({
      candidateId: anchor.candidateId,
      threadId,
      title: canonical?.title ?? preferred?.title ?? "",
      personId: displayPersonId,
      personName:
        confirmedDirectory?.displayName ??
        (personPayload?.kind === "person_association" && confirmedPersonId
          ? personPayload.displayName
          : null),
      personEmail: confirmedDirectory?.email ?? null,
      identityConfirmed: Boolean(confirmedPersonId || (canonical && displayPersonId)),
      personAssociationCandidateId: person?.candidateId ?? null,
      possiblePersonId: displayPersonId ? null : possible?.personId ?? null,
      possiblePersonName:
        displayPersonId
          ? null
          : possible?.displayName ??
            (personPayload?.kind === "person_association" ? personPayload.displayName : null),
      possiblePersonEmail: displayPersonId ? null : possible?.email ?? null,
      people,
      workStatus,
      whySurfaced: whySurfacedForStatus(workStatus, canonicalProjectFound, {
        receivedAmount: receivedAmountFromCandidates(list),
      }),
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
      canonicalProjectId: canonical?.projectId ?? null,
      canonicalProjectKind: canonical?.projectKind ?? null,
      lifecycleStage: canonical?.lifecycleStage ?? null,
      lifecycleLabel: lifecycleLabelOf(
        canonical?.lifecycleStage ?? null,
        canonical?.projectKind ?? null,
      ),
      presentation,
    });
  }
  const merged = new Map<string, GmailNewProjectIntakeCard>();
  for (const card of cards) {
    const key = card.canonicalProjectId ?? `thread:${card.threadId}`;
    const existing = merged.get(key);
    merged.set(key, existing ? mergeIntakeCards(existing, card) : card);
  }
  return [...merged.values()].sort((a, b) =>
    a.title.localeCompare(b.title, "en", { sensitivity: "base" }),
  );
}
