/**
 * Concierge Executive Moderator V1.
 * Reasons across Gmail Candidates, People, Projects, Open Jobs, and Top 5.
 * Presentation only. Does not write canonical state or send mail.
 *
 * Model: cos-executive-moderator-v1
 */

import { GENERATED_FOUNDER_OPERATING_BRIEF_RULE } from "@/lib/continuum/gmail/candidates/generated-source";
import {
  CONTINUUM_FOUNDER_DISPLAY_NAME,
  CONTINUUM_FOUNDER_TIME_ZONE,
} from "@/lib/continuum/dashboard/compose";
import { isExactStructuredSpecGmailSource, structuredSpecSourceProvenanceOf } from "@/lib/continuum/candidates/spec-provenance";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import {
  candidateProjectId,
  candidateText,
  confirmedPersonId,
  dateHasActionableObligation,
  collapseTodayCandidateGroups,
  groupingKey,
  gmailThreadByMessageId,
  hasCommercialPayload,
  hasRule,
  hasTrustworthyTodaySource,
  isActionableSpecConflict,
  isActionableToday,
  isApproval,
  candidateActionText,
  isClientDesignAnswer,
  isClientPersonLabel,
  isExplicitNewProject,
  isFounderIdentityName,
  isHistoricalRediscovery,
  isMeaningfulTodayActionText,
  isNakedDateText,
  isNakedContextSnippet,
  isNoiseOnlyCandidate,
  isPaymentStateChange,
  isPlatformOrSystemName,
  isStudioOrVendorLabel,
  isTechnicianVisit,
  isVendorOrganizationLabel,
  looksLikeHumanPersonName,
  payloadOf,
  collectTodayVendorEvidence,
  isActionableSystemAlert,
  isCurrentOperationalSystemMail,
  isExpiredOperationalSystemMail,
  isFooterOrTemplateNoise,
  isGeneratedTodayNoise,
  isNonActionableSystemMail,
  stripFooterTemplateNoise,
  type FounderAttentionContext,
  type TodayCommunicationClass,
  type TodayGmailThreadContext,
  type TodayKnownPerson,
} from "@/lib/continuum/candidates/founder-attention";
import { isUnresolvedOpenJobState } from "@/lib/continuum/client-memory/project-jobs/validate";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import {
  CONCIERGE_GMAIL_INTAKE_PATH,
} from "@/lib/continuum/gmail/types";
import {
  conciergeCreateActionPath,
  conciergeProjectPath,
} from "@/lib/continuum/client-memory/read/presentation";
import { currentProjectFocusHref } from "@/lib/continuum/client-memory/open-projects/present";
import {
  associatedGmailThreadsByProject,
  pickClientPerson,
  projectBySupportedAssociation,
  projectIdsByThread,
  resolveProjectAttribution,
  vendorSourcedThread,
  type SupportedThreadProject,
} from "./attribution";
import { gmailEvidenceHrefFor, gmailEvidenceHrefFromSourceRef } from "./evidence";
import { selectOpenEmailSources } from "./email-source";
import {
  isPostCompletionObligationText,
  isProductionExceptionText,
  todayLifecycleClass,
} from "@/lib/continuum/candidates/today-lifecycle";
import { specConflictFromCandidates } from "./founder-actions";
import { authorOwnedText, quotedText } from "@/lib/continuum/gmail/candidates/spec-provenance";
import { isCandidateQuietForToday } from "./quiet";
import { resolveTodayGroupTruth } from "./group-truth";
import { extractInboundObligation } from "./inbound-obligation";
import {
  isCurrentFounderOwnedObligationText,
  isCurrentInboundAskText,
  isGenericFallbackObligationText,
} from "./obligation-currentness";
import {
  candidateDirection,
  indexedThreadForGroup,
  threadIdForGroup,
  type RemainingFounderCommitment,
  type ThreadWaitingKind,
} from "./thread-truth";
import {
  clientLabelFromHgdSubject,
  composeTodayBriefingPacket,
  remainingIsPrintCheck,
  strongerWaitingState,
  textHasVendorCadCommitment,
  type ComposeTodayBriefingPacketInput,
  type TodayBriefingPacket,
} from "./briefing-packet";
import { renderDeterministicBriefing } from "./briefing-copy";
import type {
  CosAnomalyItem,
  CosBriefAction,
  CosBriefItem,
  CosBriefRankClass,
  CosBriefSpeaker,
  CosEvidenceBeat,
  CosFounderAttentionItem,
  CosProjectContext,
  CosProposedAction,
  CosSpecConflictView,
  CosTop5Item,
  CosWatchingItem,
} from "./types";
import {
  BRIEF_RANK_CLASSES,
  COS_BRIEF_LIMIT,
  COS_MODERATOR_MODEL_ID,
} from "./types";

export { COS_BRIEF_LIMIT, COS_MODERATOR_MODEL_ID, BRIEF_RANK_CLASSES };

const CLASS_ORDER: Record<CosBriefRankClass, number> = {
  deadline_risk: 0,
  founder_commitment: 1,
  production_blocker: 2,
  client_reply: 3,
  state_transition: 4,
  new_opportunity: 5,
  follow_up: 6,
  informational: 7,
};

const SPEC_FIELD_LABELS: Record<string, string> = {
  cad_job_number: "CAD job number",
  order_number: "order number",
  finger_size: "finger size",
  metal: "metal",
  center_stone: "center stone",
  diamond_supply_notes: "diamond supply",
};

const BLOCKED_RULES = new Set(["lifecycle", "unread", "email_age"]);

const PRODUCTION_STATUS_MS = 21 * 86_400_000;
const PRODUCTION_STAGES = new Set([
  "production",
  "in_production",
  "manufacturing",
  "bench",
]);

const SHOP_SENT =
  /\b(sent|sending|shipped|moving forward|please proceed|family sapphire|center (?:stone|was sent)|engraving)\b/i;
const VENDOR_ACK =
  /\b(received|got (?:it|the)|acknowledged|confirmed|in production|we(?:'|’)ll start|started|on the bench)\b/i;
const FOUNDER_OUTBOUND =
  /\b(here is the updated|let me know what you think|i(?:'|’)ll send|i am sending|i(?:'|’)m sending|moving forward|please proceed|just sent)\b/i;
const CLIENT_QUESTION_ASK =
  /\b(can you|could you|what(?:'|’)s next|next steps?|price|timing|eta)\b/i;
const FOUNDER_QUESTION =
  /\b(which|let me know|can you confirm|what do you think|do you (?:want|prefer)|when you can)\b/i;
const DEADLINE_SIGNAL =
  /\b(deadline|travel|needed by|need(?:s)? it by|before (?:the )?(?:trip|wedding|flight))\b/i;
const CHANNEL_META =
  /\b(unsubscribe|noreply|notification|mailbox|newsletter|signature|email subscriptions?|manage (?:email )?preferences|view as webpage|privacy policy)\b/i;

const STOP = new Set([
  "this",
  "that",
  "with",
  "from",
  "have",
  "will",
  "please",
  "could",
  "would",
  "send",
  "make",
  "your",
  "their",
  "the",
  "and",
  "for",
  "was",
  "but",
  "not",
  "you",
  "are",
  "our",
  "she",
  "his",
  "confirm",
  "follow",
  "status",
]);

type BeatKind =
  | "boilerplate"
  | "founder_outbound"
  | "client_reply"
  | "client_request"
  | "client_approval"
  | "vendor_ack"
  | "payment"
  | "spec_conflict"
  | "deadline"
  | "new_project"
  | "commitment"
  | "other";

type InternalBeat = CosEvidenceBeat & {
  kind: BeatKind;
  timestamp: string;
  historical: boolean;
  superseded: boolean;
};

type RankedSituation = {
  id: string;
  disposition: "brief" | "watching" | "suppress";
  rankClass: CosBriefRankClass;
  urgency: number;
  confidence: number;
  novelty: number;
  latestMs: number;
  personName: string | null;
  organizationLabel: string | null;
  communication: TodayCommunicationClass;
  projectId: string | null;
  projectTitle: string | null;
  isCurrent: boolean;
  headline: string;
  explanation: string;
  recommended: string;
  stateLabel: string | null;
  urgencyLabel: string | null;
  watchingTitle: string;
  watchingDetail: string;
  beats: CosEvidenceBeat[];
  candidateIds: readonly string[];
  openJobLabel: string | null;
  projectStateLabel: string | null;
  proposedAction: CosProposedAction | null;
  specConflict?: CosSpecConflictView | null;
  personAssociationCandidateId?: string | null;
  groupedThreadId?: string | null;
  recoveredGmailThreadId?: string | null;
  staleInboundSatisfied?: boolean;
  noFounderAction?: boolean;
  waitingState?: ThreadWaitingKind | null;
  sourceClass?: TodayCommunicationClass;
  threadSubject?: string | null;
  personId?: string | null;
  identityKind?: string | null;
  lifecycleStage?: string | null;
  remainingFounderCommitment?: RemainingFounderCommitment | null;
  declinedCurrentBeat?: boolean;
  vendorContactName?: string | null;
  founderOwnTexts?: readonly string[];
  vendorOwnTexts?: readonly string[];
  quotedTexts?: readonly string[];
  sourceRefs?: readonly string[];
  briefingPacket?: TodayBriefingPacket | null;
};

function identityPeopleFor(
  project: CosProjectContext | null,
  rows: readonly ContinuumCandidate[],
  projects: ReadonlyMap<string, CosProjectContext>,
  knownPerson?: TodayKnownPerson | null,
): { displayName: string; roles: string[]; organizationName: string | null }[] {
  const people: {
    displayName: string;
    roles: string[];
    organizationName: string | null;
  }[] = (project?.people ?? []).map((row) => ({
    displayName: row.displayName,
    roles: row.role ? [row.role] : [],
    organizationName: row.organizationName ?? null,
  }));
  const seen = new Set(people.map((row) => `${row.displayName}:${row.roles.join(",")}`));
  const personIds = new Set<string>();
  for (const row of rows) {
    const target = row.founderEditedTarget ?? row.proposedTarget;
    if (target.kind === "person" && target.personId) personIds.add(target.personId);
  }
  for (const personId of personIds) {
    for (const candidate of projects.values()) {
      const match = candidate.people?.find((row) => row.personId === personId);
      if (!match) continue;
      const key = `${match.displayName}:${match.role ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      people.push({
        displayName: match.displayName,
        roles: match.role ? [match.role] : [],
        organizationName: match.organizationName ?? null,
      });
    }
  }
  if (knownPerson?.displayName.trim()) {
    const key = `${knownPerson.displayName}:${(knownPerson.roles ?? []).join(",")}`;
    if (!seen.has(key)) {
      seen.add(key);
      people.push({
        displayName: knownPerson.displayName,
        roles: [...(knownPerson.roles ?? [])],
        organizationName: knownPerson.organizationName ?? null,
      });
    }
  }
  return people;
}

function nameTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4);
}

function contentTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOP.has(token));
}

function titlesOverlap(personName: string, projectTitle: string): boolean {
  const person = new Set(nameTokens(personName));
  const title = new Set(nameTokens(projectTitle));
  if (person.size === 0 || title.size === 0) return false;
  return [...person].some((token) => title.has(token));
}

function pickVendorName(project: CosProjectContext | null): string {
  const vendor = project?.people?.find(
    (person) =>
      (person.role === "vendor-contact" || isVendorOrganizationLabel(person.displayName)) &&
      !isFounderIdentityName(person.displayName),
  );
  return vendor?.displayName?.trim() || "the shop";
}

function isGenericProjectTitle(title: string | null | undefined): boolean {
  const value = title?.trim() ?? "";
  return !value || /^project$/i.test(value);
}

function displayTitle(
  personName: string | null,
  projectTitle: string | null,
  organizationLabel?: string | null,
): string {
  const trimmedPerson = personName?.trim() || null;
  const person = isClientPersonLabel(trimmedPerson) ? trimmedPerson : null;
  const project = isGenericProjectTitle(projectTitle) ? null : projectTitle?.trim() || null;
  const organization = organizationLabel?.trim() || null;
  if (person && isStudioOrVendorLabel(person)) {
    return project && !isStudioOrVendorLabel(project)
      ? project
      : organization ?? "this work";
  }
  if (project && isStudioOrVendorLabel(project)) {
    return person ?? organization ?? "this work";
  }
  if (person && project) {
    if (project.startsWith(person) || titlesOverlap(person, project)) return project;
    return `${person} — ${project}`;
  }
  return person || project || organization || "this work";
}

function projectStateLabel(stage: string | null | undefined): string | null {
  if (!stage) return null;
  if (PRODUCTION_STAGES.has(stage)) return "Production";
  if (stage === "cad") return "CAD";
  if (stage === "design") return "Design";
  if (stage === "client_approval") return "Client approval";
  if (stage === "discovery") return "Discovery";
  return stage.replaceAll("_", " ");
}

function waitingCopy(
  waiting: ThreadWaitingKind | null,
  person: string | null,
  communication?: TodayCommunicationClass | string | null,
): {
  headline: string;
  explanation: string;
  recommended: string;
  watchingDetail: string;
} {
  const kind =
    waiting ??
    (communication === "vendor" ? "shop" : "client");
  if (kind === "cad") {
    return {
      headline: "awaiting the shop",
      explanation: "You already replied. Current dependency is the updated CAD.",
      recommended: "Wait on the shop.",
      watchingDetail: "Waiting on updated CAD.",
    };
  }
  if (kind === "shop") {
    return {
      headline: "awaiting the shop",
      explanation: "You already replied. Current dependency is the shop.",
      recommended: "Wait on the shop.",
      watchingDetail: "Waiting on the shop.",
    };
  }
  if (kind === "production") {
    return {
      headline: "already in production",
      explanation:
        "You already replied. This is in production; follow-up can wait until the shop is closer.",
      recommended: "No action needed.",
      watchingDetail: "In production. Waiting on the shop.",
    };
  }
  return {
    headline: "waiting on client",
    explanation: "You already replied. Current dependency is the client.",
    recommended: "Wait on the client.",
    watchingDetail: "Waiting on the client.",
  };
}

function isProductionStage(stage: string | null | undefined): boolean {
  return Boolean(stage && PRODUCTION_STAGES.has(stage));
}

function haystack(row: ContinuumCandidate): string {
  return `${candidateText(row)} ${row.evidenceBasis.matchedText ?? ""}`;
}

function briefingTextsFor(
  rows: readonly ContinuumCandidate[],
  thread: TodayGmailThreadContext | null | undefined,
  communication: TodayCommunicationClass,
): {
  founderOwnTexts: string[];
  vendorOwnTexts: string[];
  quotedTexts: string[];
  sourceRefs: string[];
} {
  const founderOwnTexts: string[] = [];
  const vendorOwnTexts: string[] = [];
  const quotedTexts: string[] = [];
  const sourceRefs: string[] = [];
  for (const row of rows) {
    const hay = haystack(row);
    const own = authorOwnedText(hay);
    const quoted = quotedText(hay);
    if (quoted) quotedTexts.push(quoted);
    if (row.sourceRef) sourceRefs.push(row.sourceRef);
    const direction = candidateDirection(row, thread);
    if (direction === "outbound") founderOwnTexts.push(own);
    else if (communication === "vendor" || direction === "inbound") vendorOwnTexts.push(own);
  }
  return { founderOwnTexts, vendorOwnTexts, quotedTexts, sourceRefs };
}

function vendorContactFirstName(
  people: readonly { displayName: string; roles: string[] }[],
): string | null {
  const row = people.find((person) => person.roles.includes("vendor-contact"));
  const name = row?.displayName.trim() || "";
  if (!name) return null;
  return name.split(/\s+/)[0] ?? null;
}

function parseMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function formatEvidenceDay(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CONTINUUM_FOUNDER_TIME_ZONE,
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function clip(text: string, max = 140): string {
  const clean = stripFooterTemplateNoise(text).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function isBoilerplate(row: ContinuumCandidate): boolean {
  if (row.evidenceBasis.ruleIds.some((id) => BLOCKED_RULES.has(id))) return true;
  if (isTechnicianVisit(row)) return true;
  if (isNoiseOnlyCandidate(row) && !hasCommercialPayload(row)) return true;
  const hay = haystack(row);
  if (isFooterOrTemplateNoise(hay) && !hasCommercialPayload(row)) return true;
  if (CHANNEL_META.test(hay) && !hasCommercialPayload(row)) return true;
  const tokens = contentTokens(hay);
  if (tokens.length <= 3 && /\b(thanks|thank you|regards|best)\b/i.test(hay)) {
    return !hasCommercialPayload(row);
  }
  return false;
}

function speakerOf(
  row: ContinuumCandidate,
  fallback: CosBriefSpeaker = "client",
  thread?: TodayGmailThreadContext | null,
): CosBriefSpeaker {
  const direction = candidateDirection(row, thread);
  if (direction === "outbound") return "founder";
  const own = authorOwnedText(haystack(row));
  if (hasRule(row, "explicit_external_commitment")) {
    return "client";
  }
  if (hasRule(row, "explicit_founder_commitment") || FOUNDER_OUTBOUND.test(own)) {
    return "founder";
  }
  if (FOUNDER_QUESTION.test(own) && hasRule(row, "explicit_follow_up")) {
    return "founder";
  }
  if (FOUNDER_QUESTION.test(own) && payloadOf(row).kind === "open_job") {
    const payload = payloadOf(row);
    if (payload.kind === "open_job" && payload.waitingOnActor === "client") return "founder";
  }
  if (
    hasRule(row, "explicit_vendor_waiting") ||
    hasRule(row, "explicit_vendor_commitment") ||
    hasRule(row, "explicit_shop_blocker") ||
    hasRule(row, "vendor_shop_update")
  ) {
    return "vendor";
  }
  if (isPaymentStateChange(row) || hasRule(row, "transactional_customer_notice")) {
    return "system";
  }
  if (
    hasRule(row, "explicit_client_request") ||
    hasRule(row, "explicit_client_approval") ||
    isClientDesignAnswer(row) ||
    isApproval(row)
  ) {
    return "client";
  }
  const payload = payloadOf(row);
  if (payload.kind === "open_job" && payload.waitingOnActor === "vendor") return "vendor";
  if (payload.kind === "open_job" && payload.waitingOnActor === "founder") {
    return FOUNDER_OUTBOUND.test(payload.subject) ? "founder" : "client";
  }
  if (VENDOR_ACK.test(haystack(row))) return "vendor";
  return fallback;
}

function beatKind(
  row: ContinuumCandidate,
  ctx: FounderAttentionContext,
  fallback: CosBriefSpeaker = "client",
  thread?: TodayGmailThreadContext | null,
): BeatKind {
  if (isBoilerplate(row)) return "boilerplate";
  if (
    row.candidateType === "person_association" ||
    row.candidateType === "project_association"
  ) {
    return "other";
  }
  if (isActionableSpecConflict(row, ctx)) return "spec_conflict";
  const payload = payloadOf(row);
  if (payload.kind === "structured_spec") return "other";
  if (isPaymentStateChange(row)) return "payment";
  if (isExplicitNewProject(row)) return "new_project";
  if (isApproval(row)) return "client_approval";
  if (isClientDesignAnswer(row)) return "client_reply";
  if (payload.kind === "date") {
    return dateHasActionableObligation(row) ? "deadline" : "other";
  }
  if (isNoiseOnlyCandidate(row)) return "other";
  if (DEADLINE_SIGNAL.test(haystack(row))) return "deadline";
  const speaker = speakerOf(row, fallback, thread);
  if (speaker === "vendor") {
    if (VENDOR_ACK.test(haystack(row))) return "vendor_ack";
    return "commitment";
  }
  if (speaker === "founder") {
    if (
      hasRule(row, "explicit_founder_commitment") ||
      payload.kind === "open_job"
    ) {
      return "commitment";
    }
    return "founder_outbound";
  }
  if (speaker === "client" && CLIENT_QUESTION_ASK.test(haystack(row))) {
    return "client_request";
  }
  if (speaker === "client") return "client_reply";
  return "other";
}

function counterpart(
  speaker: CosBriefSpeaker,
  personName: string | null,
  vendorName: string,
): string | null {
  const client = isClientPersonLabel(personName) ? personName : null;
  const vendor = vendorName !== "the shop" ? vendorName : null;
  if (speaker === "founder") return vendor || client;
  // Founder identity is never the external Person/counterpart on his own thread.
  if (speaker === "client") return vendor;
  return null;
}

function speakerLabel(speaker: CosBriefSpeaker, personName: string | null, vendorName: string): string {
  if (speaker === "founder") return CONTINUUM_FOUNDER_DISPLAY_NAME;
  if (speaker === "vendor") return vendorName;
  if (speaker === "system") return "Payment";
  return (isClientPersonLabel(personName) ? personName : null) || "the client";
}

function beatsFor(
  row: ContinuumCandidate,
  ctx: FounderAttentionContext,
  personName: string | null,
  vendorName: string,
  fallback: CosBriefSpeaker = "client",
  thread?: TodayGmailThreadContext | null,
): InternalBeat[] {
  const primary = toBeat(row, ctx, personName, vendorName, fallback, thread);
  const supporting = row.evidenceBasis.supportingSourceRefs ?? [];
  if (supporting.length === 0) return [primary];
  const extra: InternalBeat[] = [];
  const seen = new Set<string>();
  if (primary.sourceHref) seen.add(primary.sourceHref);
  for (const sourceRef of supporting) {
    const sourceHref = gmailEvidenceHrefFromSourceRef(sourceRef);
    if (!sourceHref || seen.has(sourceHref)) continue;
    seen.add(sourceHref);
    extra.push({
      ...primary,
      label: `${primary.at} · Source email`,
      sourceHref,
      generatedSource: undefined,
    });
  }
  return extra.length > 0 ? [primary, ...extra] : [primary];
}

function toBeat(
  row: ContinuumCandidate,
  ctx: FounderAttentionContext,
  personName: string | null,
  vendorName: string,
  fallback: CosBriefSpeaker = "client",
  thread?: TodayGmailThreadContext | null,
): InternalBeat {
  const speaker = speakerOf(row, fallback, thread);
  const other = counterpart(speaker, personName, vendorName);
  const from = speakerLabel(speaker, personName, vendorName);
  const label = other ? `${formatEvidenceDay(row.sourceTimestamp)} · ${from} → ${other}` : `${formatEvidenceDay(row.sourceTimestamp)} · ${from}`;
  return {
    at: formatEvidenceDay(row.sourceTimestamp),
    label,
    summary: clip(
      speaker === "founder"
        ? authorOwnedText(row.evidenceBasis.matchedText || candidateText(row)) ||
            authorOwnedText(candidateText(row)) ||
            "You already wrote."
        : authorOwnedText(row.evidenceBasis.matchedText || candidateText(row)) ||
            row.evidenceBasis.matchedText ||
            candidateText(row),
    ),
    speaker,
    sourceHref: gmailEvidenceHrefFor(row),
    candidateId: row.candidateId,
    generatedSource: hasRule(row, GENERATED_FOUNDER_OPERATING_BRIEF_RULE) || undefined,
    kind: beatKind(row, ctx, fallback, thread),
    timestamp: row.sourceTimestamp,
    historical: isHistoricalRediscovery(row, ctx),
    superseded: row.candidateState === "superseded" || row.reviewStatus === "discarded",
  };
}

function materialSpecConflicts(
  rows: readonly ContinuumCandidate[],
  ctx: FounderAttentionContext,
): { fieldName: string; proposed: string; canonical: string | null }[] {
  const fields = new Map<string, { proposed: string; canonical: string | null }>();
  for (const row of rows) {
    if (!isActionableSpecConflict(row, ctx)) continue;
    const payload = payloadOf(row);
    if (payload.kind !== "structured_spec") continue;
    const projectId = candidateProjectId(row);
    const live = projectId
      ? ctx.specByProject?.get(projectId)?.get(payload.fieldName) ?? null
      : null;
    fields.set(payload.fieldName, {
      proposed: payload.proposedValue,
      canonical: live ?? payload.currentValue,
    });
  }
  return [...fields.entries()].map(([fieldName, values]) => ({
    fieldName,
    proposed: values.proposed,
    canonical: values.canonical,
  }));
}

function specCopy(
  conflicts: readonly { fieldName: string; proposed: string; canonical: string | null }[],
): { headline: string; explanation: string; recommended: string } | null {
  if (conflicts.length === 0) return null;
  if (conflicts.length === 1) {
    const row = conflicts[0]!;
    const label = SPEC_FIELD_LABELS[row.fieldName] ?? row.fieldName.replaceAll("_", " ");
    const explanation =
      row.canonical && row.proposed
        ? `${capitalize(label)} differs: approved ${row.canonical} vs latest evidence ${row.proposed}. Older spec notes were superseded.`
        : `${capitalize(label)} differs between the approved Project spec and latest evidence.`;
    return {
      headline: `${capitalize(label)} needs a decision`,
      explanation,
      recommended: `Confirm the current ${label}.`,
    };
  }
  const labels = conflicts.map(
    (row) => SPEC_FIELD_LABELS[row.fieldName] ?? row.fieldName.replaceAll("_", " "),
  );
  return {
    headline: "Spec needs a decision",
    explanation: `${labels.join(" and ")} still differ from the approved Project spec. Older notes were superseded.`,
    recommended: "Confirm the current spec before production continues.",
  };
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function tokenOverlap(left: string, right: string): boolean {
  const a = new Set(contentTokens(left));
  const b = contentTokens(right);
  if (a.size === 0 || b.length === 0) return false;
  const hits = b.filter((token) => a.has(token));
  return hits.length >= 1;
}

function shopish(text: string): boolean {
  return /\b(shop|vendor|stone|sapphire|engraving|production)\b/i.test(text);
}

function representedByTop5(
  projectId: string | null,
  recommended: string,
  headline: string,
  top5: readonly CosTop5Item[],
): boolean {
  if (!projectId) return false;
  const rec = `${headline} ${recommended}`;
  return top5.some((item) => {
    if (item.projectId !== projectId) return false;
    if (tokenOverlap(item.action, rec)) return true;
    return shopish(item.action) && shopish(rec);
  });
}

function openJobLabelFor(
  projectId: string | null,
  jobs: readonly ProjectJob[],
): string | null {
  if (!projectId) return null;
  const open = jobs.filter(
    (job) => job.projectId === projectId && isUnresolvedOpenJobState(job.state),
  );
  if (open.length === 0) return null;
  return open[0]?.subject ?? null;
}

function projectHref(projectId: string, isCurrent: boolean): string {
  if (isCurrent) return currentProjectFocusHref(projectId);
  return conciergeProjectPath(projectId);
}

function confidenceOf(rows: readonly ContinuumCandidate[]): number {
  if (rows.some((row) => row.confidence === "high")) return 2;
  if (rows.some((row) => row.confidence === "medium")) return 1;
  return 0;
}

function noveltyOf(latestMs: number, nowMs: number): number {
  const days = Math.max(0, (nowMs - latestMs) / 86_400_000);
  if (days <= 1) return 3;
  if (days <= 3) return 2;
  if (days <= 7) return 1;
  return 0;
}

function deadlineUrgency(rows: readonly ContinuumCandidate[], nowMs: number): number {
  let best = 0;
  for (const row of rows) {
    const payload = payloadOf(row);
    const iso =
      payload.kind === "date"
        ? dateHasActionableObligation(row)
          ? payload.isoDate
          : null
        : payload.kind === "open_job" || payload.kind === "follow_up"
          ? payload.dueAt
          : null;
    if (!iso) continue;
    const due = parseMs(iso);
    if (!due) continue;
    const days = (due - nowMs) / 86_400_000;
    if (days <= 0) best = Math.max(best, 3);
    else if (days <= 14) best = Math.max(best, 2);
    else if (days <= 45) best = Math.max(best, 1);
  }
  return best;
}

function latestMeaningful(beats: readonly InternalBeat[]): InternalBeat | null {
  const usable = beats.filter(
    (beat) => !beat.superseded && beat.kind !== "boilerplate" && beat.kind !== "other",
  );
  if (usable.length === 0) return null;
  return usable[usable.length - 1] ?? null;
}

function visibleBeats(
  beats: readonly InternalBeat[],
  keepHistorical: boolean,
): CosEvidenceBeat[] {
  return beats
    .filter((beat) => {
      if (beat.superseded || beat.kind === "boilerplate") return false;
      if (beat.historical && !keepHistorical) return false;
      return true;
    })
    .slice(-6)
    .map((beat) => ({
      at: beat.at,
      label: beat.label,
      summary: beat.summary,
      speaker: beat.speaker,
      sourceHref: beat.sourceHref,
      candidateId: beat.candidateId,
      generatedSource: beat.generatedSource === true ? true : undefined,
    }));
}

function actionsFor(input: {
  projectId: string | null;
  isCurrent: boolean;
  personName: string | null;
  gmailHref: string | null;
  recoveredGmailThreadId: string | null;
  createProject: boolean;
  addToTop5: boolean;
  personAssociationCandidateId: string | null;
  communication: TodayCommunicationClass;
  organizationLabel: string | null;
  identityKind?: string | null;
  currentFounderObligation: boolean;
}): CosBriefAction[] {
  const actions: CosBriefAction[] = [];
  if (input.projectId) {
    actions.push({
      kind: "open_project",
      label: "Open project",
      href: projectHref(input.projectId, input.isCurrent),
    });
  }
  if (input.gmailHref) {
    actions.push({
      kind: "open_email",
      label: "Open email",
      href: input.gmailHref,
    });
  }
  if (input.addToTop5 && input.projectId) {
    actions.push({
      kind: "add_to_top5",
      label: "Add to Top 5",
      href: conciergeCreateActionPath(input.projectId),
    });
  }
  const recoverableHumanCommunication = Boolean(
    input.gmailHref || input.recoveredGmailThreadId,
  );
  const clientIdentityGap =
    input.currentFounderObligation &&
    recoverableHumanCommunication &&
    input.communication !== "vendor" &&
    input.communication !== "platform" &&
    input.communication !== "founder" &&
    input.identityKind !== "vendor" &&
    !input.personName &&
    !input.organizationLabel &&
    (input.communication === "client" || input.communication === "unknown") &&
    (input.personAssociationCandidateId || !input.projectId);
  if (clientIdentityGap) {
    const href = input.personAssociationCandidateId
      ? `${CONCIERGE_GMAIL_INTAKE_PATH}?personAssociation=${encodeURIComponent(input.personAssociationCandidateId)}`
      : CONCIERGE_GMAIL_INTAKE_PATH;
    actions.push({
      kind: "confirm_person",
      label: "Confirm person",
      href,
    });
  }
  if (input.createProject) {
    actions.push({
      kind: "create_project",
      label: "Create project",
      href: CONCIERGE_GMAIL_INTAKE_PATH,
    });
  }
  return actions;
}

function pendingPersonAssociationCandidateId(
  rows: readonly ContinuumCandidate[],
): string | null {
  return (
    rows.find((row) => {
      if (row.candidateType !== "person_association") return false;
      if (row.reviewStatus !== "pending") return false;
      if (row.candidateState === "superseded") return false;
      if (hasRule(row, GENERATED_FOUNDER_OPERATING_BRIEF_RULE)) return false;
      const payload = payloadOf(row);
      if (payload.kind === "person_association") {
        if (isFounderIdentityName(payload.displayName)) return false;
        if (isPlatformOrSystemName(payload.displayName)) return false;
        if (isVendorOrganizationLabel(payload.displayName)) return false;
        if (!looksLikeHumanPersonName(payload.displayName)) return false;
      }
      return true;
    })?.candidateId ?? null
  );
}

function situationThreadId(
  key: string,
  rows: readonly ContinuumCandidate[],
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext>,
): string | null {
  return threadIdForGroup(key, rows, threadContext);
}

function vendorEvidenceFromProjects(
  projects: ReadonlyMap<string, CosProjectContext>,
): { directory: string[]; evidenceTexts: string[] } {
  const people: { displayName: string; roles: string[]; organizationName: string | null }[] = [];
  const evidenceTexts: string[] = [];
  for (const project of projects.values()) {
    const title = project.title?.trim() ?? "";
    if (title) evidenceTexts.push(title);
    for (const person of project.people ?? []) {
      people.push({
        displayName: person.displayName,
        roles: person.role ? [person.role] : [],
        organizationName: person.organizationName ?? null,
      });
    }
    for (const spec of project.specs ?? []) {
      if (spec.fieldName === "diamond_supply_notes" && spec.value.trim()) {
        evidenceTexts.push(spec.value);
      }
    }
  }
  return collectTodayVendorEvidence({ people, evidenceTexts });
}

function classifySituation(input: {
  key: string;
  rows: readonly ContinuumCandidate[];
  ctx: FounderAttentionContext;
  projects: ReadonlyMap<string, CosProjectContext>;
  jobs: readonly ProjectJob[];
  top5: readonly CosTop5Item[];
  proposedActions: readonly CosProposedAction[];
  association: ReadonlyMap<string, SupportedThreadProject>;
  projectByThread?: ReadonlyMap<string, string>;
  nowMs: number;
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext>;
  vendorDirectory?: readonly string[];
  evidenceTexts?: readonly string[];
  knownPeople?: readonly TodayKnownPerson[];
  associatedByProject?: ReadonlyMap<string, readonly string[]>;
}): RankedSituation | null {
  const groupedThreadId = situationThreadId(input.key, input.rows, input.threadContext);
  const groupedProjectId = input.key.startsWith("project:")
    ? input.key.slice("project:".length)
    : null;
  const projectId =
    groupedProjectId ??
    input.rows.map(candidateProjectId).find((id): id is string => Boolean(id)) ??
    (groupedThreadId ? (input.projectByThread?.get(groupedThreadId) ?? null) : null) ??
    null;
  const attribution = resolveProjectAttribution(input.rows, projectId, input.projects);
  const project = attribution.projectId
    ? (input.projects.get(attribution.projectId) ?? null)
    : null;
  const vendorName = pickVendorName(project);
  const thread = indexedThreadForGroup(input.key, input.rows, input.threadContext);
  const identityPeople = identityPeopleFor(project, input.rows, input.projects, null);
  if (
    isGeneratedTodayNoise({
      candidates: input.rows,
      thread,
      knownPeople: input.knownPeople,
    }) ||
    isNonActionableSystemMail({
      candidates: input.rows,
      thread,
      nowIso: input.ctx.nowIso,
    }) ||
    isExpiredOperationalSystemMail({
      candidates: input.rows,
      thread,
      nowIso: input.ctx.nowIso,
    })
  ) {
    return null;
  }
  const localEvidence = collectTodayVendorEvidence({
    people: identityPeople,
    evidenceTexts: input.evidenceTexts,
  });
  const vendorDirectory = [
    ...new Set([...(input.vendorDirectory ?? []), ...localEvidence.directory]),
  ];
  const group = resolveTodayGroupTruth({
    key: input.key,
    rows: input.rows,
    threadContext: input.threadContext,
    project,
    jobs: input.jobs,
    knownPeople: input.knownPeople,
    vendorDirectory,
    evidenceTexts: localEvidence.evidenceTexts,
    people: identityPeople,
    nowIso: input.ctx.nowIso,
    associatedThreadIds: attribution.projectId
      ? (input.associatedByProject?.get(attribution.projectId) ?? null)
      : null,
  });
  const person =
    (isClientPersonLabel(attribution.personName) ? attribution.personName : null) ||
    (group.sourceClass === "vendor" ? null : group.personLabel);
  const organizationLabel = group.organizationLabel;
  let communication = group.sourceClass;
  if (!person && group.identityKind === "vendor") communication = "vendor";
  else if (group.sourceClass === "vendor" || group.sourceClass === "platform") {
    communication = group.sourceClass;
  } else if (!person && group.identityKind === "person") communication = "client";
  else if (group.identityKind === "person") communication = "client";
  if (
    isActionableSystemAlert({ candidates: input.rows, thread }) &&
    !person &&
    !organizationLabel
  ) {
    communication = "platform";
  }
  const title = displayTitle(person, attribution.projectTitle, organizationLabel);
  const client = pickClientPerson(project);
  const clientConfirmed = Boolean(
    client &&
      input.rows.some((row) => confirmedPersonId(row) === client.personId),
  );
  const fallbackSpeaker: CosBriefSpeaker =
    communication === "vendor" ||
    (vendorSourcedThread(input.association, input.rows) && !clientConfirmed)
      ? "vendor"
      : communication === "platform"
        ? "system"
        : communication === "founder"
          ? "founder"
          : "client";
  const usable = input.rows.filter(
    (row) => !isCandidateQuietForToday(row, input.ctx.nowIso),
  );
  const sorted = [...usable].sort(
    (a, b) => parseMs(a.sourceTimestamp) - parseMs(b.sourceTimestamp),
  );
  const beats = sorted.flatMap((row) =>
    beatsFor(row, input.ctx, person, vendorName, fallbackSpeaker, thread),
  );
  const production = isProductionStage(project?.lifecycleStage);
  const vendorHandled =
    Boolean(attribution.projectId) &&
    production &&
    vendorSourcedThread(input.association, input.rows);
  const meaningful = latestMeaningful(beats);
  if (!meaningful) {
    if (!vendorHandled || usable.length === 0) return null;
    const latestMs = Math.max(0, ...usable.map((row) => parseMs(row.sourceTimestamp)));
    return {
      id: `brief:${input.key}`,
      disposition: "watching",
      rankClass: "state_transition",
      urgency: 0,
      confidence: confidenceOf(usable),
      novelty: noveltyOf(latestMs, input.nowMs),
      latestMs,
      personName: person,
      organizationLabel,
      communication,
      projectId: attribution.projectId,
      projectTitle: attribution.projectTitle,
      isCurrent: project?.isCurrent ?? false,
      headline: "already in production",
      explanation:
        "Shop evidence is already tied to this production Project. No founder action is required.",
      recommended: "No new action unless you want a status check.",
      stateLabel: projectStateLabel(project?.lifecycleStage),
      urgencyLabel: null,
      watchingTitle: title,
      watchingDetail: "Shop evidence is already on this production Project.",
      beats: [],
      candidateIds: input.rows.map((row) => row.candidateId),
      openJobLabel: openJobLabelFor(attribution.projectId, input.jobs),
      projectStateLabel: projectStateLabel(project?.lifecycleStage),
      proposedAction: null,
      personAssociationCandidateId: pendingPersonAssociationCandidateId(input.rows),
      recoveredGmailThreadId: group.gmailThreadId,
    };
  }

  const conflicts = materialSpecConflicts(usable, input.ctx);
  const spec = specCopy(conflicts);
  const specConflict = (() => {
    if (conflicts.length !== 1) return null;
    const row = conflicts[0]!;
    const matches = sorted.filter((item) => {
      if (!isActionableSpecConflict(item, input.ctx)) return false;
      const payload = payloadOf(item);
      return (
        payload.kind === "structured_spec" &&
        payload.fieldName === row.fieldName &&
        payload.proposedValue === row.proposed
      );
    });
    const real = matches.filter(
      (item) => !hasRule(item, GENERATED_FOUNDER_OPERATING_BRIEF_RULE),
    );
    const candidate = (real.length > 0 ? real : matches).at(-1) ?? null;
    if (!candidate || !row.canonical) return null;
    const generated = hasRule(candidate, GENERATED_FOUNDER_OPERATING_BRIEF_RULE);
    const exact = isExactStructuredSpecGmailSource(candidate);
    return specConflictFromCandidates({
      fieldName: row.fieldName,
      canonicalValue: row.canonical,
      proposedValue: row.proposed,
      candidateId: candidate.candidateId,
      projectId: attribution.projectId,
      sourceHref: exact ? gmailEvidenceHrefFor(candidate) : null,
      sourceGenerated: generated,
      sourceProvenance: structuredSpecSourceProvenanceOf(candidate),
    });
  })();
  const founderSentToShop = beats.some(
    (beat) =>
      !beat.superseded &&
      (beat.speaker === "founder" || beat.kind === "commitment") &&
      SHOP_SENT.test(beat.summary),
  );
  const vendorAckAfterSend = (() => {
    const sendMs = Math.max(
      0,
      ...beats
        .filter((beat) => !beat.superseded && beat.speaker === "founder" && SHOP_SENT.test(beat.summary))
        .map((beat) => parseMs(beat.timestamp)),
    );
    return beats.some(
      (beat) =>
        !beat.superseded &&
        beat.kind === "vendor_ack" &&
        parseMs(beat.timestamp) >= sendMs,
    );
  })();
  const missingVendorAck = production && founderSentToShop && !vendorAckAfterSend;
  const payment = beats.some((beat) => !beat.superseded && beat.kind === "payment");
  const deadlineHits = usable.filter(
    (row) => beatKind(row, input.ctx, fallbackSpeaker, thread) === "deadline",
  );
  const deadlineUrg = deadlineUrgency(deadlineHits, input.nowMs);
  const historical = beats.filter((beat) => beat.historical && !beat.superseded);
  const current = beats.filter((beat) => !beat.historical && !beat.superseded && beat.kind !== "boilerplate");
  const reactivation =
    historical.length > 0 &&
    current.some(
      (beat) =>
        beat.kind === "client_request" ||
        beat.kind === "client_reply" ||
        beat.kind === "new_project" ||
        beat.kind === "commitment",
    );
  const currentOperational = isCurrentOperationalSystemMail({
    candidates: input.rows,
    thread,
    nowIso: input.ctx.nowIso,
  });
  const remaining = group.remainingFounderCommitment;
  const newWork =
    communication !== "vendor" &&
    communication !== "platform" &&
    communication !== "founder" &&
    !attribution.projectId &&
    !group.staleInboundSatisfied &&
    !group.noFounderAction &&
    current.some((beat) => beat.kind === "new_project" || beat.kind === "client_request");
  const founderAsked = beats.some(
    (beat) =>
      !beat.superseded &&
      beat.speaker === "founder" &&
      parseMs(beat.timestamp) < parseMs(meaningful.timestamp) &&
      (CLIENT_QUESTION_ASK.test(beat.summary) || FOUNDER_QUESTION.test(beat.summary)),
  );
  const yourTurn =
    communication !== "vendor" &&
    communication !== "platform" &&
    communication !== "founder" &&
    !group.staleInboundSatisfied &&
    !group.noFounderAction &&
    meaningful.speaker === "client" &&
    !meaningful.historical &&
    (meaningful.kind === "client_reply" ||
      meaningful.kind === "client_request" ||
      meaningful.kind === "client_approval");
  const quietProductionAge =
    production &&
    !missingVendorAck &&
    deadlineUrg === 0 &&
    (vendorAckAfterSend || founderSentToShop) &&
    input.nowMs - parseMs(meaningful.timestamp) >= PRODUCTION_STATUS_MS;
  const founderCommitment =
    Boolean(remaining) ||
    (!group.declinedCurrentBeat &&
      meaningful.kind === "commitment" &&
      meaningful.speaker === "founder" &&
      !input.jobs.some(
        (job) =>
          job.projectId === attribution.projectId &&
          isUnresolvedOpenJobState(job.state) &&
          tokenOverlap(job.subject, meaningful.summary),
      ));
  const handledByFounder =
    (group.staleInboundSatisfied && !remaining) ||
    (meaningful.speaker === "founder" &&
      beats.some(
        (beat) =>
          !beat.superseded &&
          beat.speaker === "client" &&
          parseMs(beat.timestamp) < parseMs(meaningful.timestamp),
      ));
  const awaitingVendor =
    production && vendorAckAfterSend && !missingVendorAck && deadlineUrg === 0;
  const allBoilerplate = beats.every(
    (beat) => beat.kind === "boilerplate" || beat.superseded,
  );
  if (allBoilerplate) return null;
  if (
    group.declinedCurrentBeat &&
    !remaining
  ) {
    return null;
  }

  const commercial =
    spec != null ||
    missingVendorAck ||
    quietProductionAge ||
    payment ||
    yourTurn ||
    founderCommitment ||
    newWork ||
    reactivation ||
    group.staleInboundSatisfied ||
    Boolean(group.waitingState) ||
    group.noFounderAction ||
    currentOperational ||
    isActionableSystemAlert({ candidates: usable, thread }) ||
    usable.some(hasCommercialPayload) ||
    usable.some((row) => isActionableSpecConflict(row, input.ctx));
  if (!commercial) {
    if (!vendorHandled) return null;
    return {
      id: `brief:${input.key}`,
      disposition: "watching",
      rankClass: "state_transition",
      urgency: 0,
      confidence: confidenceOf(usable),
      novelty: noveltyOf(parseMs(meaningful.timestamp), input.nowMs),
      latestMs: parseMs(meaningful.timestamp),
      personName: person,
      organizationLabel,
      communication,
      projectId: attribution.projectId,
      projectTitle: attribution.projectTitle,
      isCurrent: project?.isCurrent ?? false,
      headline: "already in production",
      explanation:
        "Shop evidence is already tied to this production Project. No founder action is required.",
      recommended: "No new action unless you want a status check.",
      stateLabel: projectStateLabel(project?.lifecycleStage),
      urgencyLabel: null,
      watchingTitle: title,
      watchingDetail: "Shop evidence is already on this production Project.",
      beats: visibleBeats(beats, false),
      candidateIds: input.rows.map((row) => row.candidateId),
      openJobLabel: openJobLabelFor(attribution.projectId, input.jobs),
      projectStateLabel: projectStateLabel(project?.lifecycleStage),
      proposedAction: null,
      personAssociationCandidateId: pendingPersonAssociationCandidateId(input.rows),
      recoveredGmailThreadId: group.gmailThreadId,
    };
  }

  let rankClass: CosBriefRankClass = "informational";
  let headline = title;
  let explanation = clip(meaningful.summary, 220);
  let recommended = "Review the latest turn and decide the next step.";
  let disposition: RankedSituation["disposition"] = "brief";
  let watchingTitle = title;
  let watchingDetail = "No founder action needed right now.";
  const stateLabel = projectStateLabel(project?.lifecycleStage);
  let urgencyLabel: string | null = null;
  let urgency = 0;
  const life = todayLifecycleClass(project?.lifecycleStage);
  const exceptionHay = `${meaningful.summary} ${usable.map(haystack).join("\n")}`;
  const productionException =
    missingVendorAck ||
    deadlineUrg > 0 ||
    Boolean(remaining) ||
    isProductionExceptionText(exceptionHay);
  const shopAsk =
    isProductionExceptionText(exceptionHay) &&
    !missingVendorAck &&
    deadlineUrg === 0 &&
    !remaining;
  const postCompletion = isPostCompletionObligationText(exceptionHay);
  const liveSpec = life === "terminal" || (life === "production" && !productionException)
    ? null
    : spec;
  const waitingLocked =
    !remaining &&
    !productionException &&
    (group.noFounderAction ||
      group.staleInboundSatisfied ||
      group.waitingState === "cad" ||
      group.waitingState === "shop" ||
      group.waitingState === "production");

  if (life === "terminal" && !postCompletion && !remaining) {
    return null;
  }

  if (life === "terminal" && postCompletion) {
    const obligation = extractInboundObligation(exceptionHay, person);
    rankClass = "founder_commitment";
    headline = obligation?.headline ?? "Handle the new request.";
    explanation = obligation?.explanation ?? clip(meaningful.summary, 220);
    recommended = obligation?.headline ?? "Handle the new request.";
    urgency = 1;
  } else if (shopAsk) {
    rankClass = "production_blocker";
    headline = "shop needs a decision";
    explanation = clip(meaningful.summary, 220);
    recommended = "Respond to the shop.";
    urgency = 1;
  } else if (
    life === "production" &&
    !productionException &&
    !quietProductionAge &&
    !remaining &&
    !payment &&
    (yourTurn || Boolean(spec))
  ) {
    const wait = waitingCopy("production", person);
    disposition = "watching";
    rankClass = "informational";
    headline = wait.headline;
    explanation = wait.explanation;
    recommended = wait.recommended;
    watchingTitle = title;
    watchingDetail = wait.watchingDetail;
    urgency = 0;
  } else if (waitingLocked) {
    const wait = waitingCopy(
      group.waitingState ?? (life === "production" ? "production" : null),
      person,
      communication,
    );
    disposition = "watching";
    rankClass = "informational";
    headline = wait.headline;
    explanation = wait.explanation;
    recommended = wait.recommended;
    watchingTitle = title;
    watchingDetail = wait.watchingDetail;
    urgency = 0;
  } else if (liveSpec) {
    rankClass = "founder_commitment";
    headline = liveSpec.headline;
    explanation = liveSpec.explanation;
    recommended = liveSpec.recommended;
    urgency = 1;
  } else if (missingVendorAck && deadlineUrg > 0) {
    rankClass = "deadline_risk";
    headline = "production deadline";
    explanation = payment
      ? `Deposit is paid, work was sent to the shop, and the client has an approaching deadline. I do not see a later shop confirmation against that date.`
      : `This is in production and the client has an approaching deadline, but I do not see a later shop confirmation.`;
    recommended = "Confirm production ETA against the deadline.";
    urgencyLabel = "Deadline";
    urgency = deadlineUrg;
  } else if (deadlineUrg > 0 && (payment || production)) {
    rankClass = "deadline_risk";
    headline = "production deadline";
    explanation = payment
      ? `Deposit is paid${founderSentToShop ? ", the center was sent to the shop," : ","} and the client has an approaching travel or delivery deadline.`
      : `Production is underway and the client has an approaching deadline.`;
    recommended = "Confirm production ETA against the deadline.";
    urgencyLabel = "Deadline";
    urgency = deadlineUrg;
  } else if (missingVendorAck) {
    rankClass = "production_blocker";
    headline = "confirm shop status";
    explanation = `You moved this into production${founderSentToShop ? " and sent material or instructions to the shop" : ""}, but I do not see a later vendor confirmation that the work was received or acknowledged.`;
    recommended = "Confirm status with the shop.";
    urgency = 1;
  } else if (remaining) {
    rankClass = "founder_commitment";
    headline = remaining.headline;
    explanation = remaining.explanation;
    recommended = remaining.recommended;
    urgency = 1;
  } else if (group.staleInboundSatisfied && !quietProductionAge) {
    const wait = waitingCopy(group.waitingState, person, communication);
    disposition = "watching";
    rankClass = "informational";
    headline = wait.headline;
    explanation = wait.explanation;
    recommended = wait.recommended;
    watchingTitle = title;
    watchingDetail = wait.watchingDetail;
    urgency = 0;
  } else if (
    communication === "vendor" &&
    (group.waitingState === "cad" || group.waitingState === "shop") &&
    !quietProductionAge
  ) {
    const wait = waitingCopy(group.waitingState, person, communication);
    disposition = "watching";
    rankClass = "informational";
    headline = wait.headline;
    explanation = wait.explanation;
    recommended = wait.recommended;
    watchingTitle = title;
    watchingDetail = wait.watchingDetail;
    urgency = 0;
  } else if (communication === "vendor" && group.noFounderAction && !quietProductionAge) {
    disposition = "suppress";
  } else if (group.noFounderAction && !quietProductionAge) {
    const wait = waitingCopy(group.waitingState, person, communication);
    disposition = "watching";
    rankClass = "informational";
    headline = wait.headline;
    explanation = wait.explanation;
    recommended = wait.recommended;
    watchingTitle = title;
    watchingDetail = wait.watchingDetail;
    urgency = 0;
  } else if (yourTurn) {
    const latestInboundHay = usable
      .filter((row) => parseMs(row.sourceTimestamp) === parseMs(meaningful.timestamp))
      .map((row) => haystack(row))
      .join("\n");
    const obligation =
      extractInboundObligation(meaningful.summary, person) ??
      extractInboundObligation(latestInboundHay, person);
    rankClass = "client_reply";
    headline = obligation?.headline ?? "Your turn";
    explanation =
      obligation?.explanation ??
      (founderAsked
        ? `${person || "The client"} answered after your last question. The latest meaningful turn is theirs.`
        : `${person || "The client"} answered a design question. The latest meaningful turn is theirs.`);
    recommended = obligation?.headline ?? "Send the recap / next step.";
    urgency = 1;
  } else if (newWork) {
    rankClass = "new_opportunity";
    headline = reactivation ? "work is active again" : "close the handoff";
    explanation = reactivation
      ? `Earlier exploratory conversation went quiet. ${person || "The client"} is now asking for next steps, and no canonical Project represents the work yet.`
      : `${person || "The client"} asked for price, timing, or next steps. No canonical Project represents the work yet.`;
    recommended =
      "Send the recap / next step and create the Project if moving forward.";
    urgency = 1;
  } else if (reactivation && attribution.projectId && !group.staleInboundSatisfied) {
    rankClass = "follow_up";
    headline = "work is active again";
    explanation = `Older exploratory notes were quiet. Latest evidence is current again and needs a next step.`;
    recommended = "Send the recap / next step.";
    urgency = 1;
  } else if (founderCommitment) {
    rankClass = "founder_commitment";
    headline = clip(meaningful.summary, 72);
    explanation = `You committed to this, and it is not already on Top 5.`;
    recommended = "Do it, or add it to Top 5.";
    urgency = 1;
  } else if (quietProductionAge) {
    rankClass = "follow_up";
    headline = "confirm shop status";
    explanation =
      "This is already in production, and I do not see a recent shop update. Confirming status is useful; I will not create a reminder Open Job.";
    recommended = "Confirm status with the shop.";
    urgency = 1;
  } else if (payment && production && vendorAckAfterSend) {
    rankClass = "state_transition";
    headline = "already in production";
    explanation = "Payment landed and the shop already has production evidence. The canonical Project is already in production.";
    recommended = "No new action unless you want a status check.";
    disposition = "watching";
    watchingTitle = title;
    watchingDetail = "Payment received. Project is already in production.";
    urgency = 0;
  } else if (handledByFounder) {
    disposition = "watching";
    rankClass = "informational";
    headline = "already answered";
    explanation = `${person || "The client"} replied and you already answered.`;
    recommended = "No action needed.";
    watchingTitle = title;
    watchingDetail = `${person || "The client"} replied and you already answered.`;
  } else if (awaitingVendor) {
    disposition = "watching";
    rankClass = "informational";
    headline = "awaiting the shop";
    explanation = "The shop has the work. Nothing further is needed from you until they turn.";
    recommended = "Wait on the shop.";
    watchingTitle = title;
    watchingDetail = "Awaiting the shop. Project is already in production.";
  } else if (vendorHandled) {
    disposition = "watching";
    watchingTitle = title;
    watchingDetail = "Shop evidence is already on this production Project.";
  } else if (communication === "vendor" && !person) {
    rankClass = "follow_up";
    headline = "shop update";
    explanation = clip(meaningful.summary, 220);
    recommended = "Review the latest shop turn.";
    urgency = 0;
  } else if (isActionableSystemAlert({ candidates: usable, thread }) || currentOperational) {
    rankClass = "follow_up";
    headline = clip(thread?.subject || meaningful.summary, 72);
    explanation = clip(meaningful.summary, 220) || clip(thread?.subject ?? "", 220);
    recommended = currentOperational
      ? "Review this while the window is still open."
      : "Review this alert.";
    urgency = currentOperational ? 0 : 1;
  } else {
    disposition = "suppress";
  }

  if (
    disposition === "brief" &&
    isGenericFallbackObligationText(recommended) &&
    !remaining &&
    !yourTurn &&
    !isCurrentFounderOwnedObligationText(meaningful.summary)
  ) {
    disposition = "suppress";
  }

  if (isNakedDateText(headline) || isNakedDateText(recommended) || isNakedContextSnippet(headline)) {
    if (!remaining) disposition = "suppress";
  }
  if (disposition === "brief" && communication === "platform") {
    if (
      !isActionableSystemAlert({ candidates: usable, thread }) &&
      !currentOperational
    ) {
      disposition = "suppress";
    }
  }

  if (
    disposition === "brief" &&
    representedByTop5(
      attribution.projectId,
      recommended,
      headline,
      input.top5,
    )
  ) {
    disposition = "suppress";
  }

  if (disposition === "brief") {
    const threadByMessageId = gmailThreadByMessageId(input.threadContext);
    const actionText = remaining?.recommended ?? recommended ?? meaningful.summary;
    const hasMeaningfulEvidence =
      spec != null ||
      Boolean(remaining) ||
      rankClass === "production_blocker" ||
      rankClass === "deadline_risk" ||
      usable.some(
        (row) =>
          isMeaningfulTodayActionText(candidateActionText(row)) ||
          isMeaningfulTodayActionText(row.evidenceBasis.matchedText) ||
          isActionableSpecConflict(row, input.ctx) ||
          isApproval(row) ||
          isClientDesignAnswer(row) ||
          row.candidateType === "open_job" ||
          row.candidateType === "follow_up" ||
          hasRule(row, "explicit_follow_up") ||
          hasRule(row, "explicit_founder_commitment") ||
          hasRule(row, "explicit_client_request") ||
          hasRule(row, "explicit_client_approval"),
      );
    const noiseOnly =
      !spec &&
      !remaining &&
      usable.every(
        (row) =>
          isNoiseOnlyCandidate(row) ||
          row.candidateType === "person_association" ||
          row.candidateType === "project_association",
      );
    const actionable = isActionableToday({
      currentFounderObligation: !noiseOnly && (hasMeaningfulEvidence || rankClass !== "informational"),
      trustworthySource: hasTrustworthyTodaySource(input.rows, threadByMessageId),
      actionText,
      hasMeaningfulEvidence,
      noiseOnly,
    });
    if (!actionable) {
      if (group.waitingState || group.staleInboundSatisfied || group.noFounderAction) {
        disposition = "watching";
        watchingTitle = title;
        watchingDetail =
          group.waitingState === "client"
            ? "Waiting on the client."
            : group.waitingState === "cad" || group.waitingState === "shop"
              ? "Awaiting the shop."
              : "No founder action on the current turn.";
      } else {
        disposition = "suppress";
      }
    }
  }

  const proposed =
    input.proposedActions.find((row) =>
      input.rows.some((candidate) => candidate.candidateId === row.candidateId),
    ) ?? null;
  const latestMs = parseMs(meaningful.timestamp);
  const evidence = visibleBeats(
    beats,
    (newWork || reactivation) &&
      !missingVendorAck &&
      spec == null &&
      !yourTurn,
  );
  const briefingTexts = briefingTextsFor(usable, thread, communication);

  return {
    id: `brief:${input.key}`,
    disposition,
    rankClass,
    urgency,
    confidence: confidenceOf(usable),
    novelty: noveltyOf(latestMs, input.nowMs),
    latestMs,
    personName: person,
    organizationLabel,
    communication,
    projectId: attribution.projectId,
    projectTitle: attribution.projectTitle,
    isCurrent: project?.isCurrent ?? false,
    headline,
    explanation,
    recommended,
    stateLabel,
    urgencyLabel,
    watchingTitle,
    watchingDetail,
    beats: evidence,
    candidateIds: input.rows.map((row) => row.candidateId),
    openJobLabel: openJobLabelFor(attribution.projectId, input.jobs),
    projectStateLabel: projectStateLabel(project?.lifecycleStage),
    proposedAction: proposed,
    specConflict: disposition === "brief" && liveSpec ? specConflict : null,
    personAssociationCandidateId: pendingPersonAssociationCandidateId(input.rows),
    groupedThreadId,
    recoveredGmailThreadId: group.gmailThreadId,
    staleInboundSatisfied: group.staleInboundSatisfied,
    noFounderAction: group.noFounderAction,
    waitingState: group.waitingState,
    sourceClass: group.sourceClass,
    threadSubject: thread?.subject ?? null,
    personId: group.personId,
    identityKind: group.identityKind,
    lifecycleStage: project?.lifecycleStage ?? null,
    remainingFounderCommitment: remaining,
    declinedCurrentBeat: group.declinedCurrentBeat,
    vendorContactName: vendorContactFirstName(identityPeople),
    founderOwnTexts: briefingTexts.founderOwnTexts,
    vendorOwnTexts: briefingTexts.vendorOwnTexts,
    quotedTexts: briefingTexts.quotedTexts,
    sourceRefs: briefingTexts.sourceRefs,
  };
}

function compareSituations(a: RankedSituation, b: RankedSituation): number {
  const classDelta = CLASS_ORDER[a.rankClass] - CLASS_ORDER[b.rankClass];
  if (classDelta !== 0) return classDelta;
  if (b.urgency !== a.urgency) return b.urgency - a.urgency;
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  if (b.novelty !== a.novelty) return b.novelty - a.novelty;
  if (b.latestMs !== a.latestMs) return b.latestMs - a.latestMs;
  return a.id.localeCompare(b.id);
}

function briefingInputFromSituation(item: RankedSituation): ComposeTodayBriefingPacketInput {
  return {
    itemId: item.id,
    displayNameHint: item.personName,
    organizationLabel: item.organizationLabel,
    vendorContactName: item.vendorContactName ?? null,
    communication: item.communication,
    identityKind: item.identityKind ?? null,
    projectName: item.projectTitle,
    projectId: item.projectId,
    personId: item.personId ?? null,
    threadSubject: item.threadSubject ?? null,
    lifecycle: item.lifecycleStage ?? null,
    remainingFounderCommitment: item.remainingFounderCommitment ?? null,
    waitingState: item.waitingState ?? null,
    noFounderAction: item.noFounderAction ?? false,
    staleInboundSatisfied: item.staleInboundSatisfied ?? false,
    declinedCurrentBeat: item.declinedCurrentBeat ?? false,
    openJobProven: Boolean(item.openJobLabel),
    evidence: item.beats,
    founderOwnTexts: item.founderOwnTexts ?? [],
    vendorOwnTexts: item.vendorOwnTexts ?? [],
    quotedTexts: item.quotedTexts ?? [],
    sourceRefs: item.sourceRefs ?? [],
  };
}

function withBriefingDisposition(item: RankedSituation): RankedSituation {
  const packet = composeTodayBriefingPacket(briefingInputFromSituation(item));
  if (!packet) {
    if (item.declinedCurrentBeat) {
      return { ...item, disposition: "suppress", briefingPacket: null };
    }
    return { ...item, briefingPacket: null };
  }
  if (item.specConflict) {
    return {
      ...item,
      disposition: "brief",
      briefingPacket: {
        ...packet,
        ballHolder: "founder",
        unresolvedFounderObligation:
          packet.unresolvedFounderObligation ?? `Confirm the ${item.specConflict.fieldLabel}.`,
      },
    };
  }
  if (
    packet.ballHolder === "founder" &&
    (packet.briefingKind === "founder_print_check" ||
      (isCurrentInboundAskText(packet.unresolvedFounderObligation) && packet.briefingKind !== "vendor_cad_wait")) &&
    item.disposition !== "brief"
  ) {
    return {
      ...item,
      disposition: "brief",
      rankClass:
        packet.briefingKind === "founder_print_check" ? "founder_commitment" : item.rankClass,
      briefingPacket: packet,
    };
  }
  if (
    (packet.ballHolder === "vendor_shop" ||
      packet.ballHolder === "client" ||
      packet.ballHolder === "scheduled_future") &&
    item.disposition !== "brief"
  ) {
    return {
      ...item,
      disposition: "watching",
      briefingPacket: packet,
    };
  }
  return { ...item, briefingPacket: packet };
}

function presentWatching(item: RankedSituation): CosWatchingItem {
  const packet = item.briefingPacket ?? composeTodayBriefingPacket(briefingInputFromSituation(item));
  const briefing = packet ? renderDeterministicBriefing(packet) : null;
  const title = briefing
    ? [briefing.displayName, briefing.projectName]
        .filter((row, index, all) => row && all.indexOf(row) === index)
        .join(" / ")
    : item.watchingTitle;
  return {
    id: item.id,
    title,
    detail: briefing?.stand ?? item.watchingDetail,
    projectId: item.projectId,
    candidateIds: item.candidateIds,
    briefingPacket: packet,
    briefing,
  };
}

function presentBrief(
  item: RankedSituation,
  rank: number,
  projects: ReadonlyMap<string, CosProjectContext>,
): CosBriefItem {
  const projectContext = item.projectId ? projects.get(item.projectId) : undefined;
  const canonicalGmailThreadId = projectContext?.gmailThreadId?.trim() || null;
  const emailSources = selectOpenEmailSources({
    beats: item.beats,
    specCandidateId: item.specConflict?.candidateId ?? null,
    conflictMode: Boolean(item.specConflict),
    conflictSourceHref: item.specConflict?.sourceHref ?? null,
    canonicalThreadId: canonicalGmailThreadId,
  });
  const gmailHref = emailSources.length === 1 ? emailSources[0]!.href : null;
  const projectId = item.projectId;
  const createProject = !projectId && item.rankClass === "new_opportunity";
  const addToTop5 =
    Boolean(projectId) &&
    (item.rankClass === "founder_commitment" ||
      item.rankClass === "production_blocker" ||
      item.rankClass === "deadline_risk" ||
      item.rankClass === "client_reply" ||
      item.rankClass === "follow_up");
  const packet = item.briefingPacket ?? composeTodayBriefingPacket(briefingInputFromSituation(item));
  const briefing =
    packet &&
    !item.specConflict &&
    (packet.ballHolder === "founder" ||
      packet.ballHolder === "vendor_shop" ||
      packet.ballHolder === "client")
      ? renderDeterministicBriefing(packet)
      : packet
        ? renderDeterministicBriefing(packet)
        : null;
  return {
    id: item.id,
    rank,
    rankClass: item.rankClass,
    personLabel: item.personName,
    organizationLabel: item.organizationLabel,
    projectTitle: item.projectTitle,
    projectId: item.projectId,
    canonicalGmailThreadId,
    recoveredGmailThreadId: item.recoveredGmailThreadId ?? item.groupedThreadId ?? null,
    threadSubject: item.threadSubject ?? null,
    headline: item.headline,
    explanation: item.explanation,
    recommended: item.recommended,
    stateLabel: item.stateLabel,
    urgencyLabel: item.urgencyLabel,
    actions: actionsFor({
      projectId: item.projectId,
      isCurrent: item.isCurrent,
      personName: item.personName,
      gmailHref,
      recoveredGmailThreadId: item.recoveredGmailThreadId ?? item.groupedThreadId ?? null,
      createProject,
      addToTop5,
      personAssociationCandidateId: item.personAssociationCandidateId ?? null,
      communication: item.communication,
      organizationLabel: item.organizationLabel,
      identityKind: item.identityKind ?? null,
      currentFounderObligation:
        !item.staleInboundSatisfied &&
        !item.noFounderAction &&
        (item.rankClass === "client_reply" ||
          item.rankClass === "new_opportunity" ||
          item.rankClass === "founder_commitment" ||
          item.rankClass === "deadline_risk" ||
          item.rankClass === "production_blocker" ||
          item.rankClass === "follow_up"),
    }),
    evidence: item.beats,
    openJobLabel: item.openJobLabel,
    projectStateLabel: item.projectStateLabel,
    candidateIds: item.candidateIds,
    proposedAction: item.proposedAction,
    specConflict: item.specConflict ?? null,
    sourceClass: item.sourceClass ?? item.communication,
    staleInboundSatisfied: item.staleInboundSatisfied ?? false,
    noFounderAction: item.noFounderAction ?? false,
    waitingState: item.waitingState ?? null,
    lifecycleStage: projectContext?.lifecycleStage ?? null,
    briefingPacket: packet,
    briefing,
  };
}

function situationCad(item: RankedSituation): string | null {
  const fromSubject = clientLabelFromHgdSubject(item.threadSubject)?.cadId;
  if (fromSubject) return fromSubject.toUpperCase();
  const fromPacket = item.briefingPacket?.identifiers.find(
    (row) => row.current && /^C\d{5,}/i.test(row.value),
  )?.value;
  return fromPacket?.toUpperCase() ?? null;
}

function situationClientName(item: RankedSituation): string | null {
  const fromSubject = clientLabelFromHgdSubject(item.threadSubject)?.name;
  const hint = fromSubject || item.personName || item.briefingPacket?.displayName;
  if (!hint || isVendorOrganizationLabel(hint) || isStudioOrVendorLabel(hint)) return null;
  return hint.trim().split(/\s+/)[0]?.toLowerCase() ?? null;
}

function situationKeys(item: RankedSituation): string[] {
  const keys: string[] = [];
  if (item.projectId) keys.push(`project:${item.projectId}`);
  const cad = situationCad(item);
  if (cad) keys.push(`cad:${cad}`);
  if (item.recoveredGmailThreadId) keys.push(`thread:${item.recoveredGmailThreadId}`);
  if (item.groupedThreadId) keys.push(`thread:${item.groupedThreadId}`);
  for (const id of item.candidateIds) keys.push(`candidate:${id}`);
  return keys;
}

function strongerSituation(a: RankedSituation, b: RankedSituation): RankedSituation {
  const score = (item: RankedSituation): number => {
    const packet = item.briefingPacket;
    if (packet?.briefingKind === "founder_print_check") return 80;
    if (remainingIsPrintCheck(item.remainingFounderCommitment)) return 80;
    if (packet?.briefingKind === "vendor_cad_wait") return 60;
    if (packet?.ballHolder === "vendor_shop") return 50;
    if (packet?.ballHolder === "founder" && packet.unresolvedFounderObligation) return 45;
    if (item.disposition === "brief") return 15;
    return 10;
  };
  return score(a) >= score(b) ? a : b;
}

function mergeSituationPair(a: RankedSituation, b: RankedSituation): RankedSituation {
  const primary = strongerSituation(a, b);
  const secondary = primary === a ? b : a;
  const client =
    clientLabelFromHgdSubject(primary.threadSubject ?? secondary.threadSubject)?.name ||
    primary.personName ||
    secondary.personName;
  const vendorOwnTexts = [...(primary.vendorOwnTexts ?? []), ...(secondary.vendorOwnTexts ?? [])];
  const waitingState = strongerWaitingState(primary.waitingState, secondary.waitingState);
  const vendorCommitted =
    textHasVendorCadCommitment(vendorOwnTexts.join("\n")) ||
    waitingState === "cad" ||
    waitingState === "shop" ||
    waitingState === "production";
  const remaining =
    vendorCommitted &&
    !remainingIsPrintCheck(primary.remainingFounderCommitment) &&
    !remainingIsPrintCheck(secondary.remainingFounderCommitment)
      ? null
      : primary.remainingFounderCommitment ?? secondary.remainingFounderCommitment;
  return {
    ...primary,
    personName: client && !isVendorOrganizationLabel(client) ? client : primary.personName,
    projectId: primary.projectId || secondary.projectId,
    projectTitle: primary.projectTitle || secondary.projectTitle,
    candidateIds: [...new Set([...primary.candidateIds, ...secondary.candidateIds])],
    beats: [...primary.beats, ...secondary.beats],
    threadSubject: primary.threadSubject || secondary.threadSubject,
    recoveredGmailThreadId: primary.recoveredGmailThreadId || secondary.recoveredGmailThreadId,
    waitingState,
    remainingFounderCommitment: remaining,
    vendorContactName: primary.vendorContactName || secondary.vendorContactName,
    organizationLabel: primary.organizationLabel || secondary.organizationLabel,
    founderOwnTexts: [...(primary.founderOwnTexts ?? []), ...(secondary.founderOwnTexts ?? [])],
    vendorOwnTexts,
    quotedTexts: [...(primary.quotedTexts ?? []), ...(secondary.quotedTexts ?? [])],
    sourceRefs: [...(primary.sourceRefs ?? []), ...(secondary.sourceRefs ?? [])],
  };
}

function mergeRankedSituations(items: readonly RankedSituation[]): RankedSituation[] {
  const list = [...items];
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
  const byKey = new Map<string, number>();
  for (let index = 0; index < list.length; index++) {
    for (const key of situationKeys(list[index]!)) {
      const prior = byKey.get(key);
      if (prior == null) byKey.set(key, index);
      else union(prior, index);
    }
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const cadA = situationCad(list[i]!);
      const cadB = situationCad(list[j]!);
      const nameA = situationClientName(list[i]!);
      const nameB = situationClientName(list[j]!);
      if (list[i]!.projectId && list[j]!.projectId && list[i]!.projectId !== list[j]!.projectId) {
        continue;
      }
      if (cadA && cadB && cadA !== cadB) continue;
      if (cadA && cadB && cadA === cadB) union(i, j);
      else if ((cadA || cadB) && nameA && nameB && nameA === nameB) union(i, j);
    }
  }
  const grouped = new Map<number, RankedSituation>();
  for (let index = 0; index < list.length; index++) {
    const root = find(index);
    const current = grouped.get(root);
    grouped.set(root, current ? mergeSituationPair(current, list[index]!) : list[index]!);
  }
  return [...grouped.values()];
}

export type ComposeConciergeBriefInput = {
  candidates: readonly ContinuumCandidate[];
  jobs: readonly ProjectJob[];
  projects: ReadonlyMap<string, CosProjectContext>;
  nowIso: string;
  top5: readonly CosTop5Item[];
  proposedActions?: readonly CosProposedAction[];
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext>;
  vendorDirectory?: readonly string[];
  evidenceTexts?: readonly string[];
  knownPeople?: readonly TodayKnownPerson[];
};

export function composeConciergeBrief(input: ComposeConciergeBriefInput): {
  brief: CosBriefItem[];
  watching: CosWatchingItem[];
} {
  const specByProject = new Map<string, ReadonlyMap<string, string>>();
  const lifecycleByProject = new Map<string, string | null>();
  for (const [projectId, project] of input.projects) {
    if (project.specs && project.specs.length > 0) {
      specByProject.set(
        projectId,
        new Map(project.specs.map((row) => [row.fieldName, row.value])),
      );
    }
    lifecycleByProject.set(projectId, project.lifecycleStage ?? null);
  }
  const ctx: FounderAttentionContext = {
    jobs: input.jobs,
    nowIso: input.nowIso,
    top5Ids: new Set(input.top5.map((row) => row.id)),
    currentProjectIds: new Set(
      [...input.projects.values()].filter((row) => row.isCurrent).map((row) => row.projectId),
    ),
    specByProject,
    lifecycleByProject,
  };
  const association = projectBySupportedAssociation(
    input.candidates,
    input.projects,
    input.threadContext,
  );
  const projectByThread = projectIdsByThread(association, input.projects);
  const associatedByProject = associatedGmailThreadsByProject(
    association,
    input.projects,
  );
  const threadByMessageId = gmailThreadByMessageId(input.threadContext);
  const projectVendor = vendorEvidenceFromProjects(input.projects);
  const vendorDirectory = [
    ...new Set([...(input.vendorDirectory ?? []), ...projectVendor.directory]),
  ];
  const evidenceTexts = [
    ...new Set([...(input.evidenceTexts ?? []), ...projectVendor.evidenceTexts]),
  ];
  const groups = new Map<string, ContinuumCandidate[]>();
  for (const row of input.candidates) {
    if (isCandidateQuietForToday(row, input.nowIso)) continue;
    const key = groupingKey(row, projectByThread, threadByMessageId);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const collapsed = collapseTodayCandidateGroups(groups, threadByMessageId);
  const nowMs = parseMs(input.nowIso);
  const situations: RankedSituation[] = [];
  for (const [key, rows] of collapsed) {
    const situation = classifySituation({
      key,
      rows,
      ctx,
      projects: input.projects,
      jobs: input.jobs,
      top5: input.top5,
      proposedActions: input.proposedActions ?? [],
      association,
      projectByThread,
      nowMs,
      threadContext: input.threadContext,
      vendorDirectory,
      evidenceTexts,
      knownPeople: input.knownPeople,
      associatedByProject,
    });
    if (situation) situations.push(withBriefingDisposition(situation));
  }

  const merged = mergeRankedSituations(situations).map(withBriefingDisposition);

  const briefSource = merged
    .filter((row) => row.disposition === "brief")
    .sort(compareSituations);
  const watching = merged
    .filter((row) => row.disposition === "watching")
    .sort(compareSituations)
    .map((row) => presentWatching(row));

  return {
    brief: briefSource.map((row, index) => presentBrief(row, index + 1, input.projects)),
    watching,
  };
}

function coveredByBrief(
  projectId: string | null,
  candidateIds: readonly string[],
  brief: readonly CosBriefItem[],
  watching: readonly CosWatchingItem[],
): boolean {
  if (projectId) {
    if (brief.some((row) => row.projectId === projectId)) return true;
    if (watching.some((row) => row.projectId === projectId)) return true;
  }
  const ids = new Set(candidateIds);
  if (ids.size === 0) return false;
  if (brief.some((row) => row.candidateIds.some((id) => ids.has(id)))) return true;
  return watching.some((row) => (row.candidateIds ?? []).some((id) => ids.has(id)));
}

export function uncoveredFallbackAttention(input: {
  brief: readonly CosBriefItem[];
  watching: readonly CosWatchingItem[];
  needsYourDecision: readonly CosFounderAttentionItem[];
  worthKnowing: readonly CosFounderAttentionItem[];
  anomalies: readonly CosAnomalyItem[];
}): {
  needsYourDecision: readonly CosFounderAttentionItem[];
  worthKnowing: readonly CosFounderAttentionItem[];
  anomalies: readonly CosAnomalyItem[];
} {
  return {
    needsYourDecision: input.needsYourDecision.filter(
      (row) =>
        Boolean(row.recap) ||
        Boolean(row.proposedAction) ||
        !coveredByBrief(row.projectId, row.candidateIds, input.brief, input.watching),
    ),
    worthKnowing: input.worthKnowing.filter(
      (row) => !coveredByBrief(row.projectId, row.candidateIds, input.brief, input.watching),
    ),
    anomalies: input.anomalies,
  };
}
