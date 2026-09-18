/**
 * Authoritative read-only Today group truth for Gmail-derived groups.
 * Recovers exact thread/message evidence, then hydrates sender, vendor,
 * chronology, and waiting state before moderator/ranking. Does not write
 * Person, Project, or Gmail state.
 */

import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import {
  candidateText,
  classifyTodayCommunication,
  collectTodayEmailHashes,
  collectTodayFounderEmailHashes,
  isClientPersonLabel,
  resolveTodayIdentity,
  type TodayCommunicationClass,
  type TodayGmailIndexedMessage,
  type TodayGmailThreadContext,
  type TodayIdentitySignal,
  type TodayKnownPerson,
  type TodayResolvedIdentity,
} from "@/lib/continuum/candidates/founder-attention";
import { collectExactGmailIds } from "@/lib/continuum/candidates/exact-gmail-ids";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import {
  candidateDirection,
  gmailThreadIdsForGroup,
  indexedMessagesWithInferredDirection,
  indexedThreadForGroup,
  reconcileGroupTruthState,
  type RemainingFounderCommitment,
  type ThreadWaitingKind,
} from "./thread-truth";
import type { CosProjectContext } from "./types";

export type TodayGroupTruthLatest = {
  messageId: string;
  sentAt: string;
  fromEmailHash: string | null;
};

export type TodayGroupTruth = {
  gmailThreadId: string | null;
  sourceMessageIds: readonly string[];
  latestMeaningfulInbound: TodayGroupTruthLatest | null;
  latestMeaningfulOutbound: TodayGroupTruthLatest | null;
  externalSenderHash: string | null;
  personId: string | null;
  personLabel: string | null;
  organizationLabel: string | null;
  sourceClass: TodayCommunicationClass;
  identityKind: TodayResolvedIdentity["kind"];
  staleInboundSatisfied: boolean;
  remainingFounderCommitment: RemainingFounderCommitment | null;
  waitingState: ThreadWaitingKind | null;
  noFounderAction: boolean;
};

const VENDOR_FORTHCOMING =
  /\b(?:updated CAD|CAD as soon as|as soon as (?:it'?s|the (?:CAD|file|STL) is) available|I(?:'ll| will) send (?:you )?(?:the )?(?:updated )?(?:CAD|STL|file))/i;
const VENDOR_ASKS_FOUNDER =
  /\b(can you|could you|please (?:send|confirm|approve|check)|need you to|when you can)\b/i;

function parseMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function haystackOf(row: ContinuumCandidate): string {
  return `${candidateText(row)} ${row.evidenceBasis.matchedText ?? ""}`.trim();
}

function latestIndexed(
  messages: readonly TodayGmailIndexedMessage[] | undefined,
  direction: "inbound" | "outbound",
): TodayGmailIndexedMessage | null {
  if (!messages?.length) return null;
  return (
    [...messages]
      .filter((row) => row.direction === direction)
      .sort((a, b) => parseMs(a.sentAt) - parseMs(b.sentAt))
      .at(-1) ?? null
  );
}

function asLatest(row: TodayGmailIndexedMessage | null): TodayGroupTruthLatest | null {
  if (!row) return null;
  return {
    messageId: row.messageId,
    sentAt: row.sentAt,
    fromEmailHash: row.fromEmailHash?.trim() || null,
  };
}

function inboundHaystack(
  rows: readonly ContinuumCandidate[],
  thread: TodayGmailThreadContext | null | undefined,
  latestInboundAt: string | null,
): string {
  const inboundMs = parseMs(latestInboundAt);
  const latest = rows.filter((row) => {
    if (candidateDirection(row, thread) !== "inbound") return false;
    if (inboundMs <= 0) return true;
    return parseMs(row.sourceTimestamp) >= inboundMs;
  });
  return latest.map(haystackOf).join("\n");
}

export function collectTodayExternalEmailHashes(input: {
  candidates?: readonly ContinuumCandidate[];
  thread?: TodayGmailThreadContext | null;
}): string[] {
  return collectTodayEmailHashes(input);
}

export function resolveTodayGroupTruth(input: {
  key: string;
  rows: readonly ContinuumCandidate[];
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext> | null;
  project?: CosProjectContext | null;
  jobs?: readonly ProjectJob[] | null;
  knownPeople?: readonly TodayKnownPerson[];
  vendorDirectory?: readonly string[];
  evidenceTexts?: readonly string[];
  people?: readonly TodayIdentitySignal[];
  nowIso?: string;
}): TodayGroupTruth {
  const threadIds = gmailThreadIdsForGroup(input.key, input.rows, input.threadContext);
  const thread = indexedThreadForGroup(input.key, input.rows, input.threadContext);
  const collected = collectExactGmailIds(input.rows);
  const founderEmailHashes = collectTodayFounderEmailHashes(input.knownPeople);
  const inferredMessages = indexedMessagesWithInferredDirection(
    thread?.messages,
    new Set(founderEmailHashes),
  );
  const latestInbound = latestIndexed(inferredMessages, "inbound");
  const latestOutbound = latestIndexed(inferredMessages, "outbound");
  const externalSenderHash =
    latestInbound?.fromEmailHash?.trim() ||
    collectTodayExternalEmailHashes({ candidates: input.rows, thread })[0] ||
    null;
  const identityHashes = collectTodayExternalEmailHashes({
    candidates: input.rows,
    thread,
  });
  const identity = resolveTodayIdentity({
    emailHashes: identityHashes,
    knownPeople: input.knownPeople,
    candidates: input.rows,
    people: input.people,
    thread,
    vendorDirectory: input.vendorDirectory,
    evidenceTexts: input.evidenceTexts,
  });
  let sourceClass = classifyTodayCommunication({
    candidates: input.rows,
    people: input.people,
    thread,
    vendorDirectory: input.vendorDirectory,
    evidenceTexts: input.evidenceTexts,
    knownPeople: input.knownPeople,
    nowIso: input.nowIso,
  });
  const storedClient = (input.people ?? []).some(
    (person) =>
      (person.roles ?? []).includes("client") &&
      isClientPersonLabel(person.displayName),
  );
  if (
    (identity.kind === "vendor" || identity.organizationLabel) &&
    !storedClient &&
    sourceClass !== "platform"
  ) {
    sourceClass = "vendor";
  } else if (
    identity.kind === "person" &&
    isClientPersonLabel(identity.personLabel) &&
    sourceClass !== "vendor"
  ) {
    sourceClass = "client";
  }
  const chronology = reconcileGroupTruthState({
    key: input.key,
    rows: input.rows,
    threadContext: input.threadContext,
    project: input.project,
    jobs: input.jobs,
    founderEmailHashes,
  });
  const inboundText = inboundHaystack(input.rows, thread, chronology.latestInboundAt);
  const forthcoming = VENDOR_FORTHCOMING.test(inboundText);
  const asksFounder = VENDOR_ASKS_FOUNDER.test(inboundText);
  const vendor = sourceClass === "vendor";
  let waitingState = chronology.waiting;
  if (!chronology.remainingCommitment && vendor && forthcoming) {
    waitingState = "cad";
  }
  const vendorSettled =
    vendor &&
    !chronology.remainingCommitment &&
    !forthcoming &&
    !asksFounder &&
    chronology.clientRepliedAfterOutbound;
  const noFounderAction =
    !chronology.remainingCommitment &&
    (chronology.staleInboundSatisfied ||
      (vendor && forthcoming) ||
      vendorSettled);
  return {
    gmailThreadId: threadIds[0] ?? null,
    sourceMessageIds: collected.messageIds,
    latestMeaningfulInbound: asLatest(latestInbound),
    latestMeaningfulOutbound: asLatest(latestOutbound),
    externalSenderHash,
    personId: identity.personId,
    personLabel: identity.personLabel,
    organizationLabel: identity.organizationLabel,
    sourceClass,
    identityKind: identity.kind,
    staleInboundSatisfied: chronology.staleInboundSatisfied,
    remainingFounderCommitment: chronology.remainingCommitment,
    waitingState,
    noFounderAction,
  };
}
