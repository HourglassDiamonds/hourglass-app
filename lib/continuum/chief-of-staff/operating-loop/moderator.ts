/**
 * Concierge Executive Moderator V1.
 * Reasons across Gmail Candidates, People, Projects, Open Jobs, and Top 5.
 * Presentation only. Does not write canonical state or send mail.
 *
 * Model: cos-executive-moderator-v1
 */

import {
  CONTINUUM_FOUNDER_DISPLAY_NAME,
  CONTINUUM_FOUNDER_TIME_ZONE,
} from "@/lib/continuum/dashboard/compose";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import {
  candidateProjectId,
  candidateText,
  confirmedPersonId,
  groupingKey,
  hasCommercialPayload,
  hasRule,
  isActionableSpecConflict,
  isApproval,
  isClientDesignAnswer,
  isExplicitNewProject,
  isHistoricalRediscovery,
  isPaymentStateChange,
  isStudioOrVendorLabel,
  isTechnicianVisit,
  payloadOf,
  type FounderAttentionContext,
} from "@/lib/continuum/candidates/founder-attention";
import { isUnresolvedOpenJobState } from "@/lib/continuum/client-memory/project-jobs/validate";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import {
  CONCIERGE_GMAIL_INTAKE_PATH,
} from "@/lib/continuum/gmail/types";
import {
  CONCIERGE_HOME_PATH,
  conciergeCreateActionPath,
  conciergeProjectPath,
} from "@/lib/continuum/client-memory/read/presentation";
import { currentProjectToggleId } from "@/lib/continuum/client-memory/open-projects/present";
import {
  pickClientPerson,
  projectBySupportedAssociation,
  projectIdsByThread,
  resolveProjectAttribution,
  vendorSourcedThread,
  type SupportedThreadProject,
} from "./attribution";
import { gmailThreadHrefFor } from "./evidence";
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
  /\b(i(?:'|’)ll send|i am sending|i(?:'|’)m sending|moving forward|please proceed|just sent)\b/i;
const CLIENT_QUESTION_ASK =
  /\b(can you|could you|what(?:'|’)s next|next steps?|price|timing|eta)\b/i;
const FOUNDER_QUESTION =
  /\b(which|let me know|can you confirm|what do you think|do you (?:want|prefer)|when you can)\b/i;
const DEADLINE_SIGNAL =
  /\b(deadline|travel|needed by|need(?:s)? it by|before (?:the )?(?:trip|wedding|flight))\b/i;
const CHANNEL_META =
  /\b(unsubscribe|noreply|notification|mailbox|newsletter|signature)\b/i;

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
};

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
      person.role === "vendor-contact" &&
      !isStudioOrVendorLabel(person.displayName),
  );
  return vendor?.displayName?.trim() || "the shop";
}

function displayTitle(personName: string | null, projectTitle: string | null): string {
  const person = personName?.trim() || null;
  const project = projectTitle?.trim() || null;
  if (person && isStudioOrVendorLabel(person)) {
    return project && !isStudioOrVendorLabel(project) ? project : "this work";
  }
  if (project && isStudioOrVendorLabel(project)) return person ?? "this work";
  if (person && project) {
    if (project.startsWith(person) || titlesOverlap(person, project)) return project;
    return `${person} — ${project}`;
  }
  return person || project || "this work";
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

function isProductionStage(stage: string | null | undefined): boolean {
  return Boolean(stage && PRODUCTION_STAGES.has(stage));
}

function haystack(row: ContinuumCandidate): string {
  return `${candidateText(row)} ${row.evidenceBasis.matchedText ?? ""}`;
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
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function isBoilerplate(row: ContinuumCandidate): boolean {
  if (row.evidenceBasis.ruleIds.some((id) => BLOCKED_RULES.has(id))) return true;
  if (isTechnicianVisit(row)) return true;
  const hay = haystack(row);
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
): CosBriefSpeaker {
  if (hasRule(row, "explicit_founder_commitment") || FOUNDER_OUTBOUND.test(haystack(row))) {
    return "founder";
  }
  if (FOUNDER_QUESTION.test(haystack(row)) && hasRule(row, "explicit_follow_up")) {
    return "founder";
  }
  if (FOUNDER_QUESTION.test(haystack(row)) && payloadOf(row).kind === "open_job") {
    const payload = payloadOf(row);
    if (payload.kind === "open_job" && payload.waitingOnActor === "client") return "founder";
  }
  if (
    hasRule(row, "explicit_vendor_waiting") ||
    hasRule(row, "explicit_vendor_commitment")
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
  if (payload.kind === "date" && payload.role === "deadline") return "deadline";
  if (DEADLINE_SIGNAL.test(haystack(row))) return "deadline";
  const speaker = speakerOf(row, fallback);
  if (speaker === "vendor" && VENDOR_ACK.test(haystack(row))) return "vendor_ack";
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
  if (speaker === "founder") return vendorName !== "the shop" || personName ? vendorName : personName;
  if (speaker === "client") return CONTINUUM_FOUNDER_DISPLAY_NAME;
  if (speaker === "vendor") return CONTINUUM_FOUNDER_DISPLAY_NAME;
  return null;
}

function speakerLabel(speaker: CosBriefSpeaker, personName: string | null, vendorName: string): string {
  if (speaker === "founder") return CONTINUUM_FOUNDER_DISPLAY_NAME;
  if (speaker === "vendor") return vendorName;
  if (speaker === "system") return "Payment";
  return personName || "the client";
}

function toBeat(
  row: ContinuumCandidate,
  ctx: FounderAttentionContext,
  personName: string | null,
  vendorName: string,
  fallback: CosBriefSpeaker = "client",
): InternalBeat {
  const speaker = speakerOf(row, fallback);
  const other = counterpart(speaker, personName, vendorName);
  const from = speakerLabel(speaker, personName, vendorName);
  const label = other ? `${formatEvidenceDay(row.sourceTimestamp)} · ${from} → ${other}` : `${formatEvidenceDay(row.sourceTimestamp)} · ${from}`;
  return {
    at: formatEvidenceDay(row.sourceTimestamp),
    label,
    summary: clip(row.evidenceBasis.matchedText || candidateText(row)),
    speaker,
    sourceHref: gmailThreadHrefFor(row),
    candidateId: row.candidateId,
    kind: beatKind(row, ctx, fallback),
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
  if (isCurrent) return `${CONCIERGE_HOME_PATH}#${currentProjectToggleId(projectId)}`;
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
        ? payload.isoDate
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
    }));
}

function actionsFor(input: {
  projectId: string | null;
  isCurrent: boolean;
  personName: string | null;
  gmailHref: string | null;
  createProject: boolean;
  addToTop5: boolean;
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
  if (!input.personName) {
    actions.push({
      kind: "confirm_person",
      label: "Confirm person",
      href: CONCIERGE_GMAIL_INTAKE_PATH,
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

function classifySituation(input: {
  key: string;
  rows: readonly ContinuumCandidate[];
  ctx: FounderAttentionContext;
  projects: ReadonlyMap<string, CosProjectContext>;
  jobs: readonly ProjectJob[];
  top5: readonly CosTop5Item[];
  proposedActions: readonly CosProposedAction[];
  association: ReadonlyMap<string, SupportedThreadProject>;
  nowMs: number;
}): RankedSituation | null {
  const groupedProjectId = input.key.startsWith("project:")
    ? input.key.slice("project:".length)
    : null;
  const projectId =
    groupedProjectId ??
    input.rows.map(candidateProjectId).find((id): id is string => Boolean(id)) ??
    null;
  const attribution = resolveProjectAttribution(input.rows, projectId, input.projects);
  const project = attribution.projectId
    ? (input.projects.get(attribution.projectId) ?? null)
    : null;
  const vendorName = pickVendorName(project);
  const person = attribution.personName;
  const title = displayTitle(person, attribution.projectTitle);
  const client = pickClientPerson(project);
  const clientConfirmed = Boolean(
    client &&
      input.rows.some((row) => confirmedPersonId(row) === client.personId),
  );
  const fallbackSpeaker: CosBriefSpeaker =
    vendorSourcedThread(input.association, input.rows) && !clientConfirmed
      ? "vendor"
      : "client";
  const usable = input.rows.filter(
    (row) => row.candidateState !== "superseded" && row.reviewStatus !== "discarded",
  );
  const sorted = [...usable].sort(
    (a, b) => parseMs(a.sourceTimestamp) - parseMs(b.sourceTimestamp),
  );
  const beats = sorted.map((row) =>
    toBeat(row, input.ctx, person, vendorName, fallbackSpeaker),
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
    };
  }

  const conflicts = materialSpecConflicts(usable, input.ctx);
  const spec = specCopy(conflicts);
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
    (row) => beatKind(row, input.ctx, fallbackSpeaker) === "deadline",
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
  const newWork =
    !attribution.projectId &&
    current.some((beat) => beat.kind === "new_project" || beat.kind === "client_request");
  const founderAsked = beats.some(
    (beat) =>
      !beat.superseded &&
      beat.speaker === "founder" &&
      parseMs(beat.timestamp) < parseMs(meaningful.timestamp) &&
      (CLIENT_QUESTION_ASK.test(beat.summary) || FOUNDER_QUESTION.test(beat.summary)),
  );
  const yourTurn =
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
    meaningful.kind === "commitment" &&
    meaningful.speaker === "founder" &&
    !input.jobs.some(
      (job) =>
        job.projectId === attribution.projectId &&
        isUnresolvedOpenJobState(job.state) &&
        tokenOverlap(job.subject, meaningful.summary),
    );
  const handledByFounder =
    meaningful.speaker === "founder" &&
    beats.some(
      (beat) =>
        !beat.superseded &&
        beat.speaker === "client" &&
        parseMs(beat.timestamp) < parseMs(meaningful.timestamp),
    );
  const awaitingVendor =
    production && vendorAckAfterSend && !missingVendorAck && deadlineUrg === 0;
  const allBoilerplate = beats.every(
    (beat) => beat.kind === "boilerplate" || beat.superseded,
  );
  if (allBoilerplate) return null;

  const commercial =
    spec != null ||
    missingVendorAck ||
    quietProductionAge ||
    payment ||
    yourTurn ||
    founderCommitment ||
    newWork ||
    reactivation ||
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

  if (spec) {
    rankClass = "founder_commitment";
    headline = spec.headline;
    explanation = spec.explanation;
    recommended = spec.recommended;
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
  } else if (yourTurn) {
    rankClass = "client_reply";
    headline = "Your turn";
    explanation = founderAsked
      ? `${person || "The client"} answered after your last question. The latest meaningful turn is theirs.`
      : `${person || "The client"} answered a design question. The latest meaningful turn is theirs.`;
    recommended = "Send the recap / next step.";
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
  } else if (reactivation && attribution.projectId) {
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
  } else {
    disposition = "suppress";
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

  return {
    id: `brief:${input.key}`,
    disposition,
    rankClass,
    urgency,
    confidence: confidenceOf(usable),
    novelty: noveltyOf(latestMs, input.nowMs),
    latestMs,
    personName: person,
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

function presentBrief(item: RankedSituation, rank: number): CosBriefItem {
  const gmailHref =
    item.beats.map((beat) => beat.sourceHref).find((href): href is string => Boolean(href)) ??
    null;
  const project = item.projectId;
  const createProject = !project && item.rankClass === "new_opportunity";
  const addToTop5 =
    Boolean(project) &&
    (item.rankClass === "founder_commitment" ||
      item.rankClass === "production_blocker" ||
      item.rankClass === "deadline_risk" ||
      item.rankClass === "client_reply" ||
      item.rankClass === "follow_up");
  return {
    id: item.id,
    rank,
    rankClass: item.rankClass,
    personLabel: item.personName,
    projectTitle: item.projectTitle,
    projectId: item.projectId,
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
      createProject,
      addToTop5,
    }),
    evidence: item.beats,
    openJobLabel: item.openJobLabel,
    projectStateLabel: item.projectStateLabel,
    candidateIds: item.candidateIds,
    proposedAction: item.proposedAction,
  };
}

export type ComposeConciergeBriefInput = {
  candidates: readonly ContinuumCandidate[];
  jobs: readonly ProjectJob[];
  projects: ReadonlyMap<string, CosProjectContext>;
  nowIso: string;
  top5: readonly CosTop5Item[];
  proposedActions?: readonly CosProposedAction[];
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
  const association = projectBySupportedAssociation(input.candidates, input.projects);
  const projectByThread = projectIdsByThread(association);
  const groups = new Map<string, ContinuumCandidate[]>();
  for (const row of input.candidates) {
    const key = groupingKey(row, projectByThread);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const nowMs = parseMs(input.nowIso);
  const situations: RankedSituation[] = [];
  for (const [key, rows] of groups) {
    const situation = classifySituation({
      key,
      rows,
      ctx,
      projects: input.projects,
      jobs: input.jobs,
      top5: input.top5,
      proposedActions: input.proposedActions ?? [],
      association,
      nowMs,
    });
    if (situation) situations.push(situation);
  }

  const briefSource = situations
    .filter((row) => row.disposition === "brief")
    .sort(compareSituations)
    .slice(0, COS_BRIEF_LIMIT);
  const watching = situations
    .filter((row) => row.disposition === "watching")
    .sort(compareSituations)
    .slice(0, COS_BRIEF_LIMIT)
    .map((row) => ({
      id: row.id,
      title: row.watchingTitle,
      detail: row.watchingDetail,
      projectId: row.projectId,
    }));

  return {
    brief: briefSource.map((row, index) => presentBrief(row, index + 1)),
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
  return brief.some((row) => row.candidateIds.some((id) => ids.has(id)));
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
