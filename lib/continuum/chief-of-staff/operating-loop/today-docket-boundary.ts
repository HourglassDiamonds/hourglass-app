/**
 * One authoritative Today docket boundary.
 * Candidate sources may contribute evidence upstream, but Up Next and
 * Watching both render from this normalized, packet-gated docket.
 * Read-model only.
 */

import {
  isClientPersonLabel,
  isRecoverableExternalHumanSender,
  isStudioOrVendorLabel,
  isSupplierOrSystemMailbox,
  isTransactionalNoReplyMail,
  isVendorOrganizationLabel,
  looksLikeHumanPersonName,
  isActionableSystemAlert,
} from "@/lib/continuum/candidates/founder-attention";
import { authorOwnedText } from "@/lib/continuum/gmail/candidates/spec-provenance";
import { extractTypedIdentifiers } from "@/lib/continuum/gmail/identifier-role";
import {
  isPostCompletionObligationText,
  todayLifecycleClass,
} from "@/lib/continuum/candidates/today-lifecycle";
import {
  clientLabelFromHgdSubject,
  composeTodayBriefingPacket,
  isIdentityCleanupText,
  isIdentifierOnlyProse,
  packetHasUnresolvedVendorCommitment,
  remainingIsPrintCheck,
  type TodayBriefingPacket,
} from "./briefing-packet";
import {
  isCurrentClientTurnText,
  isCurrentFounderOwnedObligationText,
  isCurrentInboundAskText,
  isGenericFallbackObligationText,
  isRelationshipPromiseText,
} from "./obligation-currentness";
import { isImmediateCommitmentText } from "./thread-truth";
import {
  renderDeterministicBriefing,
  sanitizeRendered,
  type TodayRenderedBriefing,
} from "./briefing-copy";
import {
  filterCurrentTodayDocketItems,
  isCurrentTodayDocketItem,
} from "./today-final-invariant";
import {
  docketSubject,
  presentDocketBriefing,
  presentUnassignedHeadline,
} from "./docket-present";
import type {
  CosAnomalyItem,
  CosBriefAction,
  CosBriefItem,
  CosDocketItemView,
  CosFounderAttentionItem,
  CosOperatingLoopView,
  CosRecapItem,
  CosTop5Item,
  CosWatchingItem,
} from "./types";

const UNASSIGNED = "Unassigned";
const DIAGNOSTIC_COPY =
  /shop evidence is already (?:tied to|on) this production Project|canonical Project is already in production|I do not see a later (?:shop|vendor)|I will not create a reminder Open Job/i;

export type TodayDocketSeed = {
  id: string;
  origin: CosDocketItemView["origin"];
  subject: string;
  headline: string;
  context: string | null;
  brief: CosBriefItem | null;
  job: CosTop5Item | null;
  decision: CosFounderAttentionItem | null;
  anomaly: CosAnomalyItem | null;
  packet: TodayBriefingPacket | null;
  briefing: TodayRenderedBriefing | null;
  projectId: string | null;
  candidateIds: readonly string[];
  threadId: string | null;
  threadSubject: string | null;
  declined: boolean;
};

export function todayGroupKeysFor(seed: TodayDocketSeed): string[] {
  const keys: string[] = [];
  if (seed.projectId) keys.push(`project:${seed.projectId}`);
  const cad = currentCadOf(seed);
  if (cad) keys.push(`cad:${cad.toUpperCase()}`);
  if (seed.threadId) keys.push(`thread:${seed.threadId}`);
  for (const ref of seed.packet?.sourceRefs ?? []) {
    const trimmed = ref.trim();
    if (trimmed) keys.push(`ref:${trimmed}`);
  }
  return keys;
}

export function currentCadOf(seed: Pick<TodayDocketSeed, "packet" | "threadSubject" | "headline" | "context" | "subject">): string | null {
  const fromPacket = seed.packet?.identifiers.find(
    (row) => row.current && /^C\d{5,}/i.test(row.value),
  )?.value;
  if (fromPacket) return fromPacket.toUpperCase();
  const fromSubject = clientLabelFromHgdSubject(seed.threadSubject)?.cadId;
  if (fromSubject) return fromSubject.toUpperCase();
  const hay = `${seed.threadSubject ?? ""} ${seed.subject} ${seed.headline} ${seed.context ?? ""}`;
  const hit = extractTypedIdentifiers(hay).find((row) => /^C\d{5,}/i.test(row.value));
  return hit?.value.toUpperCase() ?? null;
}

export function clientFirstNameOf(seed: TodayDocketSeed): string | null {
  const fromSubject = clientLabelFromHgdSubject(seed.threadSubject)?.name;
  const hint =
    fromSubject ||
    seed.packet?.displayName ||
    seed.brief?.personLabel ||
    seed.subject.split("/")[0]?.trim() ||
    null;
  if (!hint) return null;
  if (isVendorOrganizationLabel(hint) || isStudioOrVendorLabel(hint)) return null;
  if (!isClientPersonLabel(hint) && hint !== UNASSIGNED) {
    const first = hint.trim().split(/\s+/)[0] ?? "";
    if (!first || first.toLowerCase() === "unassigned") return null;
  }
  const first = hint.trim().split(/\s+/)[0] ?? "";
  if (!first || first.toLowerCase() === "unassigned") return null;
  return first.toLowerCase();
}

function threadSubjectOf(
  item: CosBriefItem,
  loop?: CosOperatingLoopView,
): string | null {
  if (item.threadSubject) return item.threadSubject;
  const threadId = item.recoveredGmailThreadId ?? item.canonicalGmailThreadId ?? null;
  if (!threadId || !loop?.threadContext) return null;
  return loop.threadContext.get(threadId)?.subject ?? null;
}

function recoverableSenderName(
  item: CosBriefItem,
  loop?: CosOperatingLoopView,
): string | null {
  const threadId = item.recoveredGmailThreadId ?? item.canonicalGmailThreadId ?? null;
  const thread = threadId && loop?.threadContext ? loop.threadContext.get(threadId) ?? null : null;
  const name = thread?.fromDisplayName?.trim() || null;
  if (!name || name === UNASSIGNED) return null;
  if (isVendorOrganizationLabel(name) || isStudioOrVendorLabel(name)) return null;
  if (isSupplierOrSystemMailbox(thread?.fromEmail)) return null;
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  if (!looksLikeHumanPersonName(name) && !isClientPersonLabel(name)) return null;
  return name;
}

function overlayRecoverableSender(
  packet: TodayBriefingPacket | null,
  sender: string | null,
): TodayBriefingPacket | null {
  if (!packet || !sender) return packet;
  if (packet.entityType === "vendor") return packet;
  if (packet.displayName !== UNASSIGNED && packet.entityType !== "unknown") return packet;
  return { ...packet, displayName: sender, entityType: "client" };
}

function remainingFromRecommended(
  item: Pick<CosBriefItem, "recommended" | "explanation" | "noFounderAction" | "waitingState">,
): RemainingFounderCommitmentInput | null {
  if (item.noFounderAction || item.waitingState) return null;
  const recommended = item.recommended.trim();
  if (!recommended) return null;
  if (isIdentityCleanupText(recommended)) return null;
  if (isGenericFallbackObligationText(recommended)) return null;
  if (/^wait on (?:the )?(?:shop|client|vendor)/i.test(recommended)) return null;
  if (!isCurrentFounderOwnedObligationText(recommended)) return null;
  return {
    matchedText: recommended,
    headline: recommended,
    explanation: item.explanation,
    recommended,
  };
}

type RemainingFounderCommitmentInput = {
  matchedText: string;
  headline: string;
  explanation: string;
  recommended: string;
};

function remainingFromEvidence(
  item: Pick<CosBriefItem, "recommended" | "explanation" | "evidence">,
): RemainingFounderCommitmentInput | null {
  for (const beat of item.evidence) {
    if (beat.generatedSource) continue;
    if (isIdentityCleanupText(beat.summary) || isIdentifierOnlyProse(beat.summary)) continue;
    if (isGenericFallbackObligationText(beat.summary)) continue;
    if (beat.speaker === "founder") {
      if (!isImmediateCommitmentText(beat.summary) && !isCurrentInboundAskText(beat.summary)) {
        continue;
      }
    } else if (!isCurrentClientTurnText(beat.summary)) {
      continue;
    }
    const recommended = isGenericFallbackObligationText(item.recommended)
      ? beat.summary
      : item.recommended || beat.summary;
    return {
      matchedText: beat.summary,
      headline: recommended,
      explanation: item.explanation,
      recommended,
    };
  }
  return null;
}

export function equivalentPacketFromBrief(
  item: CosBriefItem,
  loop?: CosOperatingLoopView,
): TodayBriefingPacket | null {
  const threadSubject = threadSubjectOf(item, loop);
  const threadId = item.recoveredGmailThreadId ?? item.canonicalGmailThreadId ?? null;
  const thread = threadId && loop?.threadContext ? loop.threadContext.get(threadId) ?? null : null;
  const sender = recoverableSenderName(item, loop);
  let remaining = remainingFromRecommended(item) ?? remainingFromEvidence(item);
  if (
    (isSupplierOrSystemMailbox(thread?.fromEmail) ||
      isTransactionalNoReplyMail({
        subject: threadSubject ?? thread?.subject,
        fromEmail: thread?.fromEmail,
        fromDisplayName: thread?.fromDisplayName,
        texts: [item.recommended, item.explanation],
      })) &&
    !isActionableSystemAlert({ thread })
  ) {
    remaining = null;
  }
  const hint =
    item.personLabel ||
    item.organizationLabel ||
    item.projectTitle ||
    sender ||
    UNASSIGNED;
  const founderOwnedRemaining = Boolean(remaining && /I(?:'ll| will)\b/i.test(remaining.matchedText));
  const inboundAskRemaining = Boolean(
    remaining &&
      isCurrentClientTurnText(remaining.matchedText) &&
      !isImmediateCommitmentText(remaining.matchedText),
  );
  if (item.briefingPacket) {
    if (
      remaining &&
      (inboundAskRemaining ||
        (item.briefingPacket.briefingKind !== "vendor_cad_wait" &&
          ((item.briefingPacket.ballHolder === "unknown" &&
            !item.noFounderAction &&
            !item.waitingState) ||
            founderOwnedRemaining)))
    ) {
      return overlayRecoverableSender(
        composeTodayBriefingPacket({
        itemId: item.id,
        displayNameHint: hint,
        organizationLabel: item.organizationLabel ?? null,
        communication: item.sourceClass ?? null,
        projectName: item.projectTitle,
        projectId: item.projectId,
        personId: item.briefingPacket.personId,
        threadSubject,
        lifecycle: item.lifecycleStage ?? null,
        remainingFounderCommitment: remaining,
        waitingState: item.waitingState ?? null,
        noFounderAction: false,
        staleInboundSatisfied: item.staleInboundSatisfied ?? false,
        evidence: item.evidence,
        founderOwnTexts: item.evidence
          .filter((beat) => beat.speaker === "founder")
          .map((beat) => authorOwnedText(beat.summary)),
        vendorOwnTexts: item.evidence
          .filter((beat) => beat.speaker === "vendor")
          .map((beat) => authorOwnedText(beat.summary)),
      }) ?? item.briefingPacket,
        sender,
      );
    }
    return overlayRecoverableSender(item.briefingPacket, sender);
  }
  return overlayRecoverableSender(
    composeTodayBriefingPacket({
    itemId: item.id,
    displayNameHint: hint,
    organizationLabel: item.organizationLabel ?? null,
    communication: item.sourceClass ?? null,
    projectName: item.projectTitle,
    projectId: item.projectId,
    personId: null,
    threadSubject,
    lifecycle: item.lifecycleStage ?? null,
    remainingFounderCommitment: remaining,
    waitingState: item.waitingState ?? null,
    noFounderAction: item.noFounderAction ?? false,
    staleInboundSatisfied: item.staleInboundSatisfied ?? false,
    evidence: item.evidence,
    founderOwnTexts: item.evidence
      .filter((beat) => beat.speaker === "founder")
      .map((beat) => authorOwnedText(beat.summary)),
    vendorOwnTexts: item.evidence
      .filter((beat) => beat.speaker === "vendor")
      .map((beat) => authorOwnedText(beat.summary)),
  }),
    sender,
  );
}

export function equivalentPacketFromJob(item: CosTop5Item, loop: CosOperatingLoopView): TodayBriefingPacket | null {
  const lifecycle = loop.lifecycleByProject?.get(item.projectId) ?? null;
  const waitingState =
    /SHOP/i.test(item.ownership) ? "shop" : /CLIENT/i.test(item.ownership) ? "client" : null;
  return composeTodayBriefingPacket({
    itemId: item.id,
    displayNameHint: item.clientLabel || item.projectTitle,
    organizationLabel: null,
    communication: /SHOP/i.test(item.ownership) ? "vendor" : "client",
    projectName: item.projectTitle,
    projectId: item.projectId,
    personId: null,
    threadSubject: null,
    lifecycle,
    remainingFounderCommitment:
      /YOUR TURN|founder/i.test(item.ownership) && isCurrentFounderOwnedObligationText(item.action)
        ? {
            matchedText: item.action,
            headline: item.action,
            explanation: item.why,
            recommended: item.action,
          }
        : null,
    waitingState,
    noFounderAction: !/YOUR TURN|founder/i.test(item.ownership),
    staleInboundSatisfied: false,
    openJobProven: true,
    evidence: [],
  });
}

export function equivalentPacketFromWatching(item: CosWatchingItem): TodayBriefingPacket | null {
  if (item.briefingPacket) return item.briefingPacket;
  return composeTodayBriefingPacket({
    itemId: item.id,
    displayNameHint: item.title || null,
    organizationLabel: null,
    communication: null,
    projectName: null,
    projectId: item.projectId,
    personId: null,
    threadSubject: null,
    lifecycle: null,
    remainingFounderCommitment: null,
    waitingState: "shop",
    noFounderAction: true,
    staleInboundSatisfied: true,
    evidence: [],
  });
}

export function quotedInboundCannotBeFounderState(packet: TodayBriefingPacket): boolean {
  const founder = packet.latestMeaningfulFounderAction?.summary ?? "";
  const own = authorOwnedText(founder);
  if (!own) return /i(?:'|’)ll send/i.test(founder);
  return own !== founder.replace(/\s+/g, " ").trim() && /i(?:'|’)ll send/i.test(founder) && !/i(?:'|’)ll send/i.test(own);
}

export function isClosedBeatPacket(packet: TodayBriefingPacket | null, declined: boolean): boolean {
  if (declined && !packet?.unresolvedFounderObligation) return true;
  return packet == null;
}

export function isContextlessVendorCard(packet: TodayBriefingPacket): boolean {
  if (packet.ballHolder === "founder") return false;
  if (packet.briefingKind === "vendor_cad_wait") return false;
  if (packet.projectId) return false;
  if (packet.identifiers.some((row) => row.current)) return false;
  const fromSubject = clientLabelFromHgdSubject(
    packet.projectName ? `HGD x ${packet.displayName}` : null,
  );
  if (fromSubject) return false;
  return (
    packet.entityType === "vendor" &&
    Boolean(packet.organizationLabel) &&
    (isVendorOrganizationLabel(packet.displayName) ||
      packet.displayName === packet.organizationLabel)
  );
}

export function isStaleLifecycleOnly(
  seed: TodayDocketSeed,
  loop: CosOperatingLoopView,
): boolean {
  const packet = seed.packet;
  if (!packet) return true;
  if (packet.unresolvedFounderObligation) return false;
  if (packet.briefingKind === "founder_print_check") return false;
  if (packet.briefingKind === "vendor_cad_wait") return false;
  if (seed.brief?.waitingState) return false;
  if (packet.externalCommitment) return false;
  const stage =
    packet.lifecycle ??
    seed.brief?.lifecycleStage ??
    (seed.projectId ? (loop.lifecycleByProject?.get(seed.projectId) ?? null) : null);
  const life = todayLifecycleClass(stage);
  const hay = `${seed.headline} ${seed.context ?? ""} ${packet.nextExpectedEvent ?? ""}`;
  if (life === "terminal") return !isPostCompletionObligationText(hay);
  if (life !== "production") return false;
  if (isPostCompletionObligationText(hay)) return false;
  const hasCurrentWait =
    packet.nextExpectedEvent != null && packet.briefingKind !== "generic";
  if (hasCurrentWait) return false;
  return true;
}

export function hasRealFounderOwnedObligation(packet: TodayBriefingPacket | null | undefined): boolean {
  if (!packet) return false;
  if (packet.briefingKind === "founder_print_check") return true;
  if (packet.ballHolder !== "founder") return false;
  const text = packet.unresolvedFounderObligation ?? packet.candidateNextAction ?? "";
  if (!text || isIdentityCleanupText(text)) return false;
  if (isGenericFallbackObligationText(text)) return false;
  if (isRelationshipPromiseText(text) && !isImmediateCommitmentText(text)) return false;
  return (
    isCurrentFounderOwnedObligationText(text) ||
    isCurrentClientTurnText(text) ||
    remainingIsPrintCheck({
      matchedText: text,
      headline: text,
      explanation: text,
      recommended: text,
    })
  );
}

function identityIsNecessaryToExecute(seed: TodayDocketSeed, packet: TodayBriefingPacket): boolean {
  if (packet.personId) return false;
  if (packet.entityType === "vendor" || packet.entityType === "project") return false;
  if (clientLabelFromHgdSubject(seed.threadSubject)) return false;
  if (seed.brief?.personLabel && isClientPersonLabel(seed.brief.personLabel)) return false;
  const name = packet.displayName.trim();
  if (name && name !== UNASSIGNED && (isClientPersonLabel(name) || looksLikeHumanPersonName(name))) {
    return false;
  }
  return packet.entityType === "unknown" || name === UNASSIGNED || !name;
}

function isIdentityCleanupOnly(seed: TodayDocketSeed, packet: TodayBriefingPacket): boolean {
  if (hasRealFounderOwnedObligation(packet)) return false;
  if (packet.briefingKind === "vendor_cad_wait" || packet.ballHolder === "vendor_shop") return false;
  if (packet.ballHolder === "client" && (packet.projectId || currentCadOf(seed))) return false;
  const hay = `${seed.headline} ${seed.context ?? ""} ${packet.unresolvedFounderObligation ?? ""} ${packet.candidateNextAction ?? ""}`;
  if (isIdentityCleanupText(hay)) return true;
  if (
    packet.entityType === "unknown" &&
    packet.ballHolder === "founder" &&
    !packet.projectId &&
    !currentCadOf(seed)
  ) {
    return true;
  }
  return false;
}

export function allowConfirmPerson(
  seed: TodayDocketSeed,
  loop: CosOperatingLoopView,
): boolean {
  const packet = seed.packet;
  if (!packet) return false;
  if (!hasRealFounderOwnedObligation(packet)) return false;
  if (!identityIsNecessaryToExecute(seed, packet)) return false;
  if (packet.entityType === "vendor") return false;
  if (packet.personId) return false;
  if (seed.brief?.sourceClass === "vendor" || seed.brief?.sourceClass === "platform") {
    return false;
  }
  if (isVendorOrganizationLabel(seed.subject) || isVendorOrganizationLabel(packet.displayName)) {
    return false;
  }
  const threadId = seed.threadId;
  const thread = threadId ? loop.threadContext?.get(threadId) ?? null : null;
  if (isSupplierOrSystemMailbox(thread?.fromEmail)) return false;
  if (isTransactionalNoReplyMail({
    subject: seed.threadSubject ?? thread?.subject,
    fromEmail: thread?.fromEmail,
    fromDisplayName: thread?.fromDisplayName,
    texts: [seed.headline, seed.context, packet.unresolvedFounderObligation],
  })) {
    return false;
  }
  if (thread && !isRecoverableExternalHumanSender({ thread })) return false;
  const hgd = clientLabelFromHgdSubject(seed.threadSubject ?? thread?.subject);
  if (hgd) return false;
  return true;
}

export function founderFacingHay(text: string): string {
  return text.replace(DIAGNOSTIC_COPY, "").replace(/\s{2,}/g, " ").trim();
}

function watchingTitleFrom(packet: TodayBriefingPacket, briefing: TodayRenderedBriefing): string {
  const name = briefing.displayName;
  const project = briefing.projectName;
  if (project && project !== name) return `${name} / ${project}`;
  return name;
}

function seedFromBrief(item: CosBriefItem, loop: CosOperatingLoopView): TodayDocketSeed {
  const packet = equivalentPacketFromBrief(item, loop);
  const briefing = packet ? renderDeterministicBriefing(packet) : item.briefing ?? null;
  const threadId = item.recoveredGmailThreadId ?? item.canonicalGmailThreadId ?? null;
  return {
    id: item.id,
    origin: "brief",
    subject: item.personLabel || item.projectTitle || item.organizationLabel || UNASSIGNED,
    headline: item.recommended,
    context: item.explanation,
    brief: item,
    job: null,
    decision: null,
    anomaly: null,
    packet,
    briefing,
    projectId: item.projectId,
    candidateIds: item.candidateIds,
    threadId,
    threadSubject: threadSubjectOf(item, loop),
    declined: false,
  };
}

function seedFromWatching(item: CosWatchingItem): TodayDocketSeed {
  const packet = equivalentPacketFromWatching(item);
  const briefing = packet ? renderDeterministicBriefing(packet) : item.briefing ?? null;
  return {
    id: item.id,
    origin: "brief",
    subject: item.title,
    headline: item.detail,
    context: item.detail,
    brief: null,
    job: null,
    decision: null,
    anomaly: null,
    packet,
    briefing,
    projectId: item.projectId,
    candidateIds: item.candidateIds ?? [],
    threadId: null,
    threadSubject: null,
    declined: packet == null,
  };
}

function seedFromJob(item: CosTop5Item, loop: CosOperatingLoopView): TodayDocketSeed {
  const packet = equivalentPacketFromJob(item, loop);
  const briefing = packet ? renderDeterministicBriefing(packet) : null;
  return {
    id: item.id,
    origin: "open_job",
    subject: item.clientLabel || item.projectTitle,
    headline: item.action,
    context: item.why,
    brief: null,
    job: item,
    decision: null,
    anomaly: null,
    packet,
    briefing,
    projectId: item.projectId,
    candidateIds: [],
    threadId: null,
    threadSubject: null,
    declined: false,
  };
}

function seedFromDecision(item: CosFounderAttentionItem): TodayDocketSeed {
  const packet = composeTodayBriefingPacket({
    itemId: item.id,
    displayNameHint: item.title || item.projectTitle || UNASSIGNED,
    organizationLabel: null,
    communication: null,
    projectName: item.projectTitle,
    projectId: item.projectId,
    personId: null,
    threadSubject: null,
    lifecycle: null,
    remainingFounderCommitment: {
      matchedText: item.headline,
      headline: item.headline,
      explanation: item.detail ?? item.headline,
      recommended: item.headline,
    },
    waitingState: null,
    noFounderAction: false,
    staleInboundSatisfied: false,
    evidence: [],
  });
  return {
    id: item.id,
    origin: "decision",
    subject: item.title || item.projectTitle || UNASSIGNED,
    headline: item.headline,
    context: item.detail,
    brief: null,
    job: null,
    decision: item,
    anomaly: null,
    packet,
    briefing: packet ? renderDeterministicBriefing(packet) : null,
    projectId: item.projectId,
    candidateIds: item.candidateIds,
    threadId: null,
    threadSubject: null,
    declined: false,
  };
}

function seedFromRecap(item: CosRecapItem): TodayDocketSeed {
  const packet = composeTodayBriefingPacket({
    itemId: item.id,
    displayNameHint: item.projectTitle || item.sourceLabel || UNASSIGNED,
    organizationLabel: null,
    communication: null,
    projectName: item.projectTitle,
    projectId: item.projectId,
    personId: null,
    threadSubject: null,
    lifecycle: null,
    remainingFounderCommitment: {
      matchedText: item.question,
      headline: item.question,
      explanation: item.question,
      recommended: item.question,
    },
    waitingState: null,
    noFounderAction: false,
    staleInboundSatisfied: false,
    evidence: [],
  });
  return {
    id: item.id,
    origin: "decision",
    subject: item.projectTitle || item.sourceLabel || UNASSIGNED,
    headline: item.question,
    context: item.matchedText,
    brief: null,
    job: null,
    decision: null,
    anomaly: null,
    packet,
    briefing: packet ? renderDeterministicBriefing(packet) : null,
    projectId: item.projectId,
    candidateIds: [],
    threadId: null,
    threadSubject: null,
    declined: false,
  };
}

function seedFromAnomaly(item: CosAnomalyItem): TodayDocketSeed {
  const packet = composeTodayBriefingPacket({
    itemId: item.id,
    displayNameHint: item.sourceLabel || UNASSIGNED,
    organizationLabel: null,
    communication: null,
    projectName: null,
    projectId: item.projectId,
    personId: null,
    threadSubject: null,
    lifecycle: null,
    remainingFounderCommitment: {
      matchedText: item.headline,
      headline: item.headline,
      explanation: item.detail,
      recommended: item.headline,
    },
    waitingState: null,
    noFounderAction: false,
    staleInboundSatisfied: false,
    evidence: [],
  });
  return {
    id: item.id,
    origin: "anomaly",
    subject: item.sourceLabel || UNASSIGNED,
    headline: item.headline,
    context: item.detail,
    brief: null,
    job: null,
    decision: null,
    anomaly: item,
    packet,
    briefing: packet ? renderDeterministicBriefing(packet) : null,
    projectId: item.projectId,
    candidateIds: item.candidateIds ?? [],
    threadId: null,
    threadSubject: null,
    declined: false,
  };
}

function collectSeeds(loop: CosOperatingLoopView): TodayDocketSeed[] {
  const seeds: TodayDocketSeed[] = [];
  for (const item of loop.brief) seeds.push(seedFromBrief(item, loop));
  for (const item of loop.watching) seeds.push(seedFromWatching(item));
  for (const item of loop.top5) seeds.push(seedFromJob(item, loop));
  for (const item of loop.needsYourDecision) {
    if (!item.recap && !item.proposedAction) continue;
    seeds.push(seedFromDecision(item));
  }
  for (const item of loop.recap) seeds.push(seedFromRecap(item));
  for (const item of loop.anomalies) seeds.push(seedFromAnomaly(item));
  return seeds;
}

function keepSeed(seed: TodayDocketSeed, loop: CosOperatingLoopView): boolean {
  if (isClosedBeatPacket(seed.packet, seed.declined)) return false;
  const packet = seed.packet!;
  if (!seed.brief && !seed.job && !seed.decision && !seed.anomaly) {
    if (!seed.candidateIds.length && !seed.projectId && !currentCadOf(seed)) return false;
  }
  const thread = seed.threadId ? loop.threadContext?.get(seed.threadId) ?? null : null;
  const systemAlert = isActionableSystemAlert({ thread });
  if (
    packet.ballHolder === "unknown" &&
    !packet.unresolvedFounderObligation &&
    packet.briefingKind === "generic" &&
    !systemAlert
  ) {
    return false;
  }
  const threadHay = [
    seed.headline,
    seed.context,
    packet.unresolvedFounderObligation,
    packet.candidateNextAction,
    ...(seed.brief?.evidence.map((beat) => beat.summary) ?? []),
  ];
  if (
    !systemAlert &&
    isTransactionalNoReplyMail({
      subject: seed.threadSubject ?? thread?.subject,
      fromEmail: thread?.fromEmail,
      fromDisplayName: thread?.fromDisplayName,
      texts: threadHay,
    })
  ) {
    return false;
  }
  if (
    !systemAlert &&
    isSupplierOrSystemMailbox(thread?.fromEmail) &&
    !hasRealFounderOwnedObligation(packet)
  ) {
    return false;
  }
  if (isIdentityCleanupOnly(seed, packet)) return false;
  if (seed.origin === "anomaly" && !hasRealFounderOwnedObligation(packet)) return false;
  if (quotedInboundCannotBeFounderState(packet) && packet.ballHolder !== "founder") {
    return false;
  }
  if (seed.declined && !packet.unresolvedFounderObligation) return false;
  if (isContextlessVendorCard(packet)) return false;
  if (isStaleLifecycleOnly(seed, loop)) return false;
  if (DIAGNOSTIC_COPY.test(`${seed.headline} ${seed.context ?? ""}`) && !packet.unresolvedFounderObligation) {
    if (packet.briefingKind === "generic" && packet.ballHolder !== "founder") return false;
  }
  return true;
}

function seedScore(seed: TodayDocketSeed): number {
  const packet = seed.packet;
  if (!packet) return 0;
  if (packet.briefingKind === "founder_print_check") return 80;
  if (
    hasRealFounderOwnedObligation(packet) &&
    remainingIsPrintCheck({
      matchedText: packet.unresolvedFounderObligation ?? "",
      headline: packet.unresolvedFounderObligation ?? "",
      explanation: "",
      recommended: packet.candidateNextAction ?? "",
    })
  ) {
    return 80;
  }
  if (packet.briefingKind === "vendor_cad_wait") return 60;
  if (packet.ballHolder === "vendor_shop") return 50;
  if (hasRealFounderOwnedObligation(packet)) return 45;
  if (packet.ballHolder === "client") return 30;
  if (seed.origin === "brief") return 20;
  return 10;
}

function strongerSeed(a: TodayDocketSeed, b: TodayDocketSeed): TodayDocketSeed {
  const left = seedScore(a);
  const right = seedScore(b);
  if (left !== right) return left >= right ? a : b;
  const cadA = Boolean(currentCadOf(a));
  const cadB = Boolean(currentCadOf(b));
  if (cadA !== cadB) return cadA ? a : b;
  if (a.origin === "brief" && b.origin !== "brief") return a;
  if (b.origin === "brief" && a.origin !== "brief") return b;
  return a;
}

function mergeSeeds(left: TodayDocketSeed, right: TodayDocketSeed): TodayDocketSeed {
  const primary = strongerSeed(left, right);
  const secondary = primary === left ? right : left;
  const clientName =
    clientLabelFromHgdSubject(primary.threadSubject ?? secondary.threadSubject)?.name ||
    (primary.packet && !isVendorOrganizationLabel(primary.packet.displayName)
      ? primary.packet.displayName
      : secondary.packet && !isVendorOrganizationLabel(secondary.packet.displayName)
        ? secondary.packet.displayName
        : primary.packet?.displayName);
  let packet = primary.packet;
  const vendorPacket =
    packetHasUnresolvedVendorCommitment(secondary.packet) && !packetHasUnresolvedVendorCommitment(packet)
      ? secondary.packet
      : packetHasUnresolvedVendorCommitment(packet)
        ? packet
        : null;
  if (
    vendorPacket &&
    packet &&
    packet.briefingKind !== "founder_print_check" &&
    !remainingIsPrintCheck({
      matchedText: packet.unresolvedFounderObligation ?? "",
      headline: packet.unresolvedFounderObligation ?? "",
      explanation: "",
      recommended: packet.candidateNextAction ?? "",
    })
  ) {
    packet = {
      ...vendorPacket,
      displayName:
        clientName && !isVendorOrganizationLabel(clientName) ? clientName : vendorPacket.displayName,
      entityType:
        clientName && !isVendorOrganizationLabel(clientName) ? "client" : vendorPacket.entityType,
    };
  } else if (
    packet &&
    secondary.packet?.briefingKind === "vendor_cad_wait" &&
    packet.briefingKind !== "founder_print_check" &&
    !remainingIsPrintCheck({
      matchedText: packet.unresolvedFounderObligation ?? "",
      headline: packet.unresolvedFounderObligation ?? "",
      explanation: "",
      recommended: packet.candidateNextAction ?? "",
    })
  ) {
    packet = secondary.packet;
  }
  if (packet && clientName && isVendorOrganizationLabel(packet.displayName)) {
    packet = { ...packet, displayName: clientName, entityType: "client" };
  }
  const briefing = packet ? renderDeterministicBriefing(packet) : primary.briefing;
  const recapHeadline =
    /actually sent|can't tell whether this was/i.test(secondary.headline)
      ? secondary.headline
      : primary.headline;
  return {
    ...primary,
    packet,
    briefing,
    headline: recapHeadline,
    context: recapHeadline !== primary.headline ? secondary.context ?? primary.context : primary.context,
    projectId: primary.projectId || secondary.projectId,
    candidateIds: [...new Set([...primary.candidateIds, ...secondary.candidateIds])],
    threadId: primary.threadId || secondary.threadId,
    threadSubject: primary.threadSubject || secondary.threadSubject,
    brief: primary.brief ?? secondary.brief,
    job: primary.job ?? secondary.job,
    decision: primary.decision ?? secondary.decision,
    anomaly: primary.anomaly ?? secondary.anomaly,
  };
}

function sameClientCadPair(a: TodayDocketSeed, b: TodayDocketSeed): boolean {
  const cadA = currentCadOf(a);
  const cadB = currentCadOf(b);
  if (cadA && cadB) return cadA === cadB;
  if (!cadA && !cadB) return false;
  const nameA = clientFirstNameOf(a);
  const nameB = clientFirstNameOf(b);
  if (!nameA || !nameB || nameA !== nameB) return false;
  return true;
}

export function dedupeTodaySeeds(seeds: readonly TodayDocketSeed[]): TodayDocketSeed[] {
  const list = [...seeds];
  const parent = list.map((_, index) => index);
  const find = (index: number): number => {
    const current = parent[index]!;
    if (current === index) return index;
    parent[index] = find(current);
    return parent[index]!;
  };
  const union = (left: number, right: number) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };
  const indexByKey = new Map<string, number>();
  for (let index = 0; index < list.length; index++) {
    for (const key of todayGroupKeysFor(list[index]!)) {
      const prior = indexByKey.get(key);
      if (prior == null) indexByKey.set(key, index);
      else union(prior, index);
    }
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (sameClientCadPair(list[i]!, list[j]!)) union(i, j);
    }
  }
  const grouped = new Map<number, TodayDocketSeed>();
  for (let index = 0; index < list.length; index++) {
    const root = find(index);
    const current = grouped.get(root);
    grouped.set(root, current ? mergeSeeds(current, list[index]!) : list[index]!);
  }
  return [...grouped.values()];
}

function laneOf(seed: TodayDocketSeed): "up_next" | "watching" {
  const packet = seed.packet;
  if (!packet) return "watching";
  if (isIdentityCleanupText(seed.headline) && !hasRealFounderOwnedObligation(packet)) {
    return "watching";
  }
  if (packet.briefingKind === "founder_print_check") return "up_next";
  if (hasRealFounderOwnedObligation(packet)) return "up_next";
  return "watching";
}

function stripConfirmPerson(brief: CosBriefItem | null, allowed: boolean): CosBriefItem | null {
  if (!brief) return brief;
  if (allowed) return brief;
  const actions = brief.actions.filter((action: CosBriefAction) => action.kind !== "confirm_person");
  if (actions.length === brief.actions.length) return brief;
  return { ...brief, actions };
}

function toDocketItem(seed: TodayDocketSeed, loop: CosOperatingLoopView): CosDocketItemView {
  const packet = seed.packet!;
  const briefing = seed.briefing
    ? sanitizeRendered(
        {
          ...seed.briefing,
          headline: founderFacingHay(seed.briefing.headline),
          stand: founderFacingHay(seed.briefing.stand),
          nextBody: founderFacingHay(seed.briefing.nextBody),
        },
        packet,
      )
    : null;
  const spec = seed.brief?.specConflict;
  const unassigned =
    packet.entityType === "unknown" &&
    !packet.projectName &&
    !packet.identifiers.some((row) => row.current) &&
    !clientLabelFromHgdSubject(seed.threadSubject);
  const useCosOverlay =
    Boolean(briefing) &&
    !spec &&
    !unassigned &&
    packet.briefingKind !== "generic";
  const presented = presentDocketBriefing({
    subject: unassigned ? UNASSIGNED : seed.subject,
    headline: seed.headline,
    context: seed.context,
    origin: seed.origin,
    staleInboundSatisfied: seed.brief?.staleInboundSatisfied,
    noFounderAction: seed.brief?.noFounderAction,
  });
  const packetTitle = watchingTitleFrom(packet, briefing ?? renderDeterministicBriefing(packet));
  const subject = unassigned
    ? UNASSIGNED
    : packetTitle ||
      (seed.brief
        ? docketSubject(seed.brief.personLabel, seed.brief.projectTitle, seed.brief.organizationLabel)
        : seed.subject);
  const headline = unassigned
    ? presentUnassignedHeadline(
        presented.headline,
        (seed.brief?.evidence ?? [])
          .filter((beat) => beat.generatedSource !== true)
          .map((beat) => beat.summary),
      )
    : spec
      ? presented.headline
      : useCosOverlay
        ? briefing!.headline
        : presented.headline;
  const allowedConfirm = allowConfirmPerson(seed, loop);
  return {
    id: seed.id,
    lane: "live_work",
    origin: seed.origin,
    subject,
    headline,
    context: spec || unassigned ? presented.context : useCosOverlay ? briefing!.stand : presented.context,
    job: seed.job,
    brief: stripConfirmPerson(seed.brief, allowedConfirm),
    decision: seed.decision,
    anomaly: seed.anomaly,
    briefing: useCosOverlay ? briefing : null,
    briefingPacket: packet,
  };
}

function toWatchingItem(seed: TodayDocketSeed): CosWatchingItem {
  const packet = seed.packet!;
  const briefing = seed.briefing
    ? sanitizeRendered(
        {
          ...seed.briefing,
          headline: founderFacingHay(seed.briefing.headline),
          stand: founderFacingHay(seed.briefing.stand),
          nextBody: founderFacingHay(seed.briefing.nextBody),
        },
        packet,
      )
    : null;
  return {
    id: seed.id,
    title: briefing ? watchingTitleFrom(packet, briefing) : seed.subject,
    detail: founderFacingHay(briefing?.stand ?? seed.context ?? seed.headline),
    projectId: seed.projectId,
    candidateIds: seed.candidateIds,
    briefingPacket: packet,
    briefing,
  };
}

export function finalizeTodayDocket(loop: CosOperatingLoopView): {
  upNext: CosDocketItemView[];
  watching: CosWatchingItem[];
} {
  const kept = dedupeTodaySeeds(collectSeeds(loop).filter((seed) => keepSeed(seed, loop)));
  const upNextSeeds: TodayDocketSeed[] = [];
  const watchingSeeds: TodayDocketSeed[] = [];
  for (const seed of kept) {
    if (laneOf(seed) === "up_next") upNextSeeds.push(seed);
    else watchingSeeds.push(seed);
  }
  upNextSeeds.sort((left, right) => seedScore(right) - seedScore(left));
  const upNext = filterCurrentTodayDocketItems(
    upNextSeeds.map((seed) => toDocketItem(seed, loop)),
    loop,
  ).filter((item) =>
    isCurrentTodayDocketItem(item, {
      lifecycleByProject: loop.lifecycleByProject,
      lifecycleByGmailThread: loop.lifecycleByGmailThread,
      associatedGmailThreadsByProject: loop.associatedGmailThreadsByProject,
      threadContext: loop.threadContext,
      founderEmailHashes: loop.founderEmailHashes,
    }),
  );
  const watching = watchingSeeds
    .map(toWatchingItem)
    .filter((item) => item.briefingPacket != null)
    .filter((item) => !DIAGNOSTIC_COPY.test(item.detail));
  return { upNext, watching };
}

function whySeedSurvived(seed: TodayDocketSeed): string {
  const packet = seed.packet;
  if (!packet) return "no packet";
  if (packet.briefingKind === "founder_print_check") return "founder print/check obligation";
  if (hasRealFounderOwnedObligation(packet)) return "founder-owned current action";
  if (packetHasUnresolvedVendorCommitment(packet)) return "unresolved vendor commitment";
  if (packet.ballHolder === "client") return "client holds the current turn";
  if (seed.origin === "open_job") return "recorded open job";
  return "current work loop";
}

export type TodayDocketRankRow = {
  displayName: string;
  projectOrCad: string | null;
  lane: "up_next" | "queued" | "watching";
  rank: number;
  ballHolder: string | null;
  founderObligation: string | null;
  whySurvived: string;
  groupKey: string;
};

export function inspectFinalizedTodayDocket(
  loop: CosOperatingLoopView,
  visibleLimit = 3,
): TodayDocketRankRow[] {
  const kept = dedupeTodaySeeds(collectSeeds(loop).filter((seed) => keepSeed(seed, loop)));
  const upNextSeeds = kept
    .filter((seed) => laneOf(seed) === "up_next")
    .sort((left, right) => seedScore(right) - seedScore(left));
  const watchingSeeds = kept.filter((seed) => laneOf(seed) !== "up_next");
  const rowOf = (seed: TodayDocketSeed, lane: TodayDocketRankRow["lane"], rank: number): TodayDocketRankRow => {
    const packet = seed.packet;
    return {
      displayName: packet?.displayName ?? seed.subject,
      projectOrCad: packet?.projectName ?? currentCadOf(seed),
      lane,
      rank,
      ballHolder: packet?.ballHolder ?? null,
      founderObligation: packet?.unresolvedFounderObligation ?? packet?.candidateNextAction ?? null,
      whySurvived: whySeedSurvived(seed),
      groupKey: todayGroupKeysFor(seed)[0] ?? seed.id,
    };
  };
  return [
    ...upNextSeeds.map((seed, index) =>
      rowOf(seed, index < visibleLimit ? "up_next" : "queued", index + 1),
    ),
    ...watchingSeeds.map((seed, index) =>
      rowOf(seed, "watching", upNextSeeds.length + index + 1),
    ),
  ];
}
