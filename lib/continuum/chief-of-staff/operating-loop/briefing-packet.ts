/**
 * Bounded Today briefing packet. Read-model facts only.
 * Continuum determines truth. Sol never receives raw Gmail bodies.
 */

import type { IdentifierRole } from "@/lib/continuum/candidates/identifier-role";
import {
  extractTypedIdentifiers,
  historicalQuotedIdentifiers,
  identifierBindsToCurrentProject,
} from "@/lib/continuum/gmail/identifier-role";
import {
  parseHgdClientLabel,
  currentCadTokensFromIdentityHay,
  clientLabelFromIdentityHay,
} from "@/lib/continuum/gmail/work-loop-identity";
import type { RemainingFounderCommitment, ThreadWaitingKind } from "./thread-truth";
import type { CosEvidenceBeat } from "./types";
import { isInternalQaCopy, isShopReviewFallbackText, reduceWorkLoop } from "./work-loop-state";

export const TODAY_BRIEFING_KINDS = [
  "founder_print_check",
  "vendor_cad_wait",
  "client_wait",
  "generic",
] as const;

export type TodayBriefingKind = (typeof TODAY_BRIEFING_KINDS)[number];

export const TODAY_BRIEFING_ENTITY_TYPES = [
  "client",
  "vendor",
  "project",
  "unknown",
] as const;

export type TodayBriefingEntityType = (typeof TODAY_BRIEFING_ENTITY_TYPES)[number];

export const TODAY_BALL_HOLDERS = [
  "founder",
  "client",
  "vendor_shop",
  "scheduled_future",
  "unknown",
] as const;

export type TodayBallHolder = (typeof TODAY_BALL_HOLDERS)[number];

export type TodayBriefingIdentifier = {
  value: string;
  role: IdentifierRole;
  current: boolean;
};

export type TodayBriefingEvent = {
  summary: string;
  speaker: "founder" | "client" | "vendor" | "system";
  at: string | null;
  sourceRef: string | null;
};

export type TodayBriefingPacket = {
  itemId: string;
  displayName: string;
  entityType: TodayBriefingEntityType;
  briefingKind: TodayBriefingKind;
  projectName: string | null;
  projectId: string | null;
  personId: string | null;
  organizationLabel: string | null;
  vendorContactName: string | null;
  identifiers: readonly TodayBriefingIdentifier[];
  lifecycle: string | null;
  latestMeaningfulExternalEvent: TodayBriefingEvent | null;
  latestMeaningfulFounderAction: TodayBriefingEvent | null;
  ballHolder: TodayBallHolder;
  unresolvedFounderObligation: string | null;
  externalCommitment: string | null;
  nextExpectedEvent: string | null;
  candidateNextAction: string | null;
  uncertainty: readonly string[];
  mustNotState: readonly string[];
  sourceRefs: readonly string[];
};

export type ComposeTodayBriefingPacketInput = {
  itemId: string;
  displayNameHint: string | null;
  organizationLabel: string | null;
  vendorContactName?: string | null;
  communication: string | null;
  identityKind?: string | null;
  projectName: string | null;
  projectId: string | null;
  personId: string | null;
  threadSubject: string | null;
  lifecycle: string | null;
  remainingFounderCommitment: RemainingFounderCommitment | null;
  waitingState: ThreadWaitingKind | string | null;
  noFounderAction: boolean;
  staleInboundSatisfied: boolean;
  declinedCurrentBeat?: boolean;
  openJobProven?: boolean;
  evidence: readonly CosEvidenceBeat[];
  founderOwnTexts?: readonly string[];
  vendorOwnTexts?: readonly string[];
  quotedTexts?: readonly string[];
  sourceRefs?: readonly string[];
  attachmentNames?: readonly string[];
};

const STL_DELIVERED =
  /\b(?:mod\s*\d+\s+)?stl\b.{0,80}\b(?:attached|delivered|sent|here|ready)\b|\b(?:attached|delivered|sent|here|ready).{0,80}\b(?:mod\s*\d+\s+)?stl\b/i;
const STATED_PRINT_CHECK =
  /\bI(?:'ll| will| am going to| planned to)?\s*(?:print|check|show|look at)[^.!?\n]{0,180}|\b(?:print(?:ing)?|check(?:ing)?)\s+(?:the\s+)?(?:updated\s+)?(?:model|stl|earring|huggie|size|proportion)/i;
const CAD_FORTHCOMING =
  /\b(?:updated CAD|CAD as soon as|CAD when it(?:'s| is) ready|(?:I|we|she|they)(?:'ll| will) send (?:you )?(?:the )?(?:updated )?(?:CAD|STL|file)|send (?:you )?(?:the )?updated CAD)\b/i;

export function textHasVendorCadCommitment(text: string | null | undefined): boolean {
  return CAD_FORTHCOMING.test(text ?? "");
}

export function isIdentifierOnlyProse(text: string | null | undefined): boolean {
  const trimmed = text?.replace(/\s+/g, " ").trim().replace(/[.:]+$/, "") ?? "";
  if (!trimmed) return true;
  return /^(?:C\d{5,}(?:-[A-Z0-9]+)?|[A-Z]{1,4}\d{4,}(?:-[A-Z0-9]+)?)$/i.test(trimmed);
}

export function isIdentityCleanupText(text: string | null | undefined): boolean {
  return /identify who this is from|confirm who (?:this|it) (?:is|belongs)|isn't attached to a person|confirm person/i.test(
    text ?? "",
  );
}

export function strongerWaitingState(
  left: ThreadWaitingKind | string | null | undefined,
  right: ThreadWaitingKind | string | null | undefined,
): ThreadWaitingKind | null {
  const asKind = (value: string | null | undefined): ThreadWaitingKind | null => {
    if (value === "cad" || value === "shop" || value === "production" || value === "client") {
      return value;
    }
    return null;
  };
  const leftKind = asKind(left);
  const rightKind = asKind(right);
  const rank = (value: ThreadWaitingKind | null): number => {
    if (value === "cad" || value === "shop" || value === "production") return 3;
    if (value === "client") return 1;
    return 0;
  };
  if (rank(leftKind) > rank(rightKind)) return leftKind;
  if (rank(rightKind) > rank(leftKind)) return rightKind;
  return leftKind ?? rightKind;
}

export function packetHasUnresolvedVendorCommitment(
  packet: TodayBriefingPacket | null | undefined,
): boolean {
  if (!packet) return false;
  return (
    packet.ballHolder === "vendor_shop" ||
    packet.briefingKind === "vendor_cad_wait" ||
    Boolean(packet.externalCommitment)
  );
}

export function remainingIsPrintCheck(
  remaining: RemainingFounderCommitment | null | undefined,
): boolean {
  const hay = `${remaining?.matchedText ?? ""} ${remaining?.recommended ?? ""}`;
  return STATED_PRINT_CHECK.test(hay);
}
const COMPLETION_CLAIM =
  /\b(?:already printed|printing (?:is|was) done|approved|in production|job is complete|canonical open job)\b/i;
const VENDOR_ORG_NAME = /\b(?:vlora|workshop|atelier|engrav)/i;

export function clientLabelFromHgdSubject(subject: string | null | undefined): {
  name: string;
  cadId: string | null;
} | null {
  const parsed = parseHgdClientLabel(subject);
  if (!parsed) return null;
  return { name: parsed.name, cadId: parsed.cadId };
}

export function currentIdentifierValues(
  identifiers: readonly TodayBriefingIdentifier[],
): string[] {
  return identifiers.filter((row) => row.current).map((row) => row.value);
}

export function historicalIdentifierValues(
  identifiers: readonly TodayBriefingIdentifier[],
): string[] {
  return identifiers.filter((row) => !row.current).map((row) => row.value);
}

export function composeTodayBriefingPacket(
  input: ComposeTodayBriefingPacketInput,
): TodayBriefingPacket | null {
  if (input.declinedCurrentBeat) {
    return null;
  }

  const fromSubject =
    clientLabelFromHgdSubject(input.threadSubject) ??
    clientLabelFromIdentityHay(input.attachmentNames ?? []);
  const identifiers = composeIdentifiers(input, fromSubject?.cadId ?? null);
  const displayName = displayNameOf(input, fromSubject);
  if (!displayName) return null;

  const founderOwn = (input.founderOwnTexts ?? []).join("\n");
  const vendorOwn = (input.vendorOwnTexts ?? []).join("\n");
  const founderHay = [
    founderOwn,
    ...input.evidence.filter((beat) => beat.speaker === "founder").map((beat) => beat.summary),
  ].join("\n");
  const vendorHay = [
    vendorOwn,
    ...input.evidence.filter((beat) => beat.speaker === "vendor").map((beat) => beat.summary),
  ].join("\n");
  const nonFounderHay = [
    vendorOwn,
    ...input.evidence.filter((beat) => beat.speaker !== "founder").map((beat) => beat.summary),
  ].join("\n");
  const evidenceHay = input.evidence.map((beat) => beat.summary).join("\n");
  const printPlan = STATED_PRINT_CHECK.test(founderOwn) || STATED_PRINT_CHECK.test(founderHay);
  const stlDelivered = STL_DELIVERED.test(vendorOwn) || STL_DELIVERED.test(vendorHay);
  const cadForthcoming =
    CAD_FORTHCOMING.test(vendorOwn) ||
    CAD_FORTHCOMING.test(vendorHay) ||
    CAD_FORTHCOMING.test(nonFounderHay);
  const completion = COMPLETION_CLAIM.test(founderOwn) || COMPLETION_CLAIM.test(vendorOwn);
  const lifecycle = provenLifecycle(input.lifecycle);
  const external = latestEvent(input.evidence, (speaker) => speaker !== "founder");
  const founderAction = latestEvent(
    input.evidence.filter((beat) => !isIdentifierOnlyProse(beat.summary)),
    (speaker) => speaker === "founder",
  );
  const remainingRaw = input.remainingFounderCommitment;
  const remaining =
    remainingRaw &&
    !isShopReviewFallbackText(remainingRaw.matchedText) &&
    !isShopReviewFallbackText(remainingRaw.recommended) &&
    !isInternalQaCopy(remainingRaw.matchedText) &&
    !isInternalQaCopy(remainingRaw.recommended)
      ? remainingRaw
      : null;
  const currentIds = currentIdentifierValues(identifiers);
  const historicalIds = historicalIdentifierValues(identifiers);
  const cadLabel = currentIds.find((value) => /^C\d{5,}/i.test(value)) ?? fromSubject?.cadId ?? null;
  const reduced = reduceWorkLoop({
    evidence: input.evidence,
    founderOwnTexts: input.founderOwnTexts,
    vendorOwnTexts: input.vendorOwnTexts,
    remaining,
    waitingState: input.waitingState,
    communication: input.communication,
    noFounderAction: input.noFounderAction,
  });
  const ballHolder =
    reduced.ballHolder !== "unknown"
      ? reduced.ballHolder
      : ballHolderOf({
          remaining,
          printPlan,
          stlDelivered,
          completion,
          cadForthcoming,
          waitingState: input.waitingState,
          noFounderAction: input.noFounderAction,
          staleInboundSatisfied: input.staleInboundSatisfied,
          communication: input.communication,
        });

  const unresolvedFounderObligation =
    ballHolder === "founder"
      ? remaining
        ? remaining.matchedText
        : printPlan && !completion
          ? clip(statedPlanLine(founderOwn, evidenceHay), 180) || null
          : null
      : null;
  const candidateNextAction = nextActionOf({
    ballHolder,
    remaining: ballHolder === "founder" ? remaining : null,
    printPlan,
    stlDelivered,
    cadForthcoming,
    displayName,
  });
  const externalCommitment =
    ballHolder === "vendor_shop"
      ? cadForthcoming
        ? clip(cadForthcomingLine(vendorOwn, evidenceHay), 180) || null
        : reduced.latestExternalText
          ? clip(reduced.latestExternalText, 180)
          : external && /send|CAD|STL/i.test(external.summary)
            ? clip(external.summary, 180) || null
            : null
      : null;
  const nextExpectedEvent = reduced.nextExpectedEvent
    ?? (ballHolder === "vendor_shop" && cadForthcoming
      ? "Updated CAD from the shop"
      : ballHolder === "founder" && printPlan
        ? "Founder print/check, then client size update"
        : ballHolder === "client"
          ? "Client reply"
          : null);

  const entityType = entityTypeOf(input, fromSubject);
  const mustNotState = mustNotStateOf({
    historicalIds,
    completion,
    lifecycle,
    openJobProven: input.openJobProven === true,
    printPlan,
  });

  return {
    itemId: input.itemId,
    displayName,
    entityType,
    briefingKind:
      reduced.ballHolder !== "unknown"
        ? reduced.briefingKind
        : briefingKindOf({
            ballHolder,
            printPlan,
            stlDelivered,
            cadForthcoming,
          }),
    projectName: projectNameOf(input, cadLabel, displayName),
    projectId: input.projectId,
    personId: input.personId,
    organizationLabel: input.organizationLabel,
    vendorContactName: input.vendorContactName?.trim() || null,
    identifiers,
    lifecycle,
    latestMeaningfulExternalEvent: enrichExternal(external, {
      stlDelivered,
      cadForthcoming,
      cadLabel,
      vendorOwn,
      evidenceHay,
      vendorContactName: input.vendorContactName?.trim() || null,
    }),
    latestMeaningfulFounderAction: enrichFounder(founderAction, {
      printPlan,
      founderOwn,
      evidenceHay,
      displayName,
    }),
    ballHolder,
    unresolvedFounderObligation,
    externalCommitment,
    nextExpectedEvent,
    candidateNextAction,
    uncertainty: uncertaintyOf({
      remaining,
      printPlan,
      lifecycle,
      openJobProven: input.openJobProven === true,
    }),
    mustNotState,
    sourceRefs: uniqueRefs([
      ...(input.sourceRefs ?? []),
      ...input.evidence.map((beat) => beat.sourceHref).filter((row): row is string => Boolean(row)),
    ]),
  };
}

function displayNameOf(
  input: ComposeTodayBriefingPacketInput,
  fromSubject: { name: string; cadId: string | null } | null,
): string | null {
  if (fromSubject && !/^\d/.test(fromSubject.name) && !VENDOR_ORG_NAME.test(fromSubject.name)) {
    return firstName(fromSubject.name);
  }
  const hint = input.displayNameHint?.trim() || null;
  if (hint && !VENDOR_ORG_NAME.test(hint) && !/^unassigned$/i.test(hint)) return hint;
  const org = input.organizationLabel?.trim() || null;
  if (org) return org;
  const project = input.projectName?.trim() || null;
  if (project && !/^project$/i.test(project)) return project;
  return hint;
}

function firstName(value: string): string {
  const token = value.trim().split(/\s+/)[0] ?? value.trim();
  return token.replace(/\.$/, "");
}

function briefingKindOf(input: {
  ballHolder: TodayBallHolder;
  printPlan: boolean;
  stlDelivered: boolean;
  cadForthcoming: boolean;
}): TodayBriefingKind {
  if (input.ballHolder === "founder" && (input.printPlan || input.stlDelivered)) {
    return "founder_print_check";
  }
  if (input.ballHolder === "vendor_shop" && input.cadForthcoming) return "vendor_cad_wait";
  if (input.ballHolder === "client") return "client_wait";
  return "generic";
}

function entityTypeOf(
  input: ComposeTodayBriefingPacketInput,
  fromSubject: { name: string; cadId: string | null } | null,
): TodayBriefingEntityType {
  if (fromSubject && !VENDOR_ORG_NAME.test(fromSubject.name)) return "client";
  if (input.identityKind === "vendor" && !fromSubject) return "vendor";
  if (input.communication === "vendor" && !input.displayNameHint) return "vendor";
  if (/^unassigned$/i.test(input.displayNameHint ?? "")) return "unknown";
  if (input.displayNameHint) return "client";
  if (input.projectId || input.projectName) return "project";
  return "unknown";
}

function projectNameOf(
  input: ComposeTodayBriefingPacketInput,
  cadLabel: string | null,
  displayName: string,
): string | null {
  const title = input.projectName?.trim() || null;
  if (title && !/^project$/i.test(title) && title.toLowerCase() !== displayName.toLowerCase()) {
    return title;
  }
  return cadLabel;
}

function provenLifecycle(stage: string | null | undefined): string | null {
  const value = stage?.trim() || null;
  if (!value) return null;
  if (value === "unknown" || value === "unspecified") return null;
  return value;
}

function ballHolderOf(input: {
  remaining: RemainingFounderCommitment | null;
  printPlan: boolean;
  stlDelivered: boolean;
  completion: boolean;
  cadForthcoming: boolean;
  waitingState: ThreadWaitingKind | string | null;
  noFounderAction: boolean;
  staleInboundSatisfied: boolean;
  communication?: string | null;
}): TodayBallHolder {
  if (input.remaining) return "founder";
  if (input.printPlan && input.stlDelivered && !input.completion) return "founder";
  if (input.printPlan && !input.completion && !input.cadForthcoming) return "founder";
  const shopWait =
    input.waitingState === "cad" ||
    input.waitingState === "shop" ||
    input.waitingState === "production" ||
    input.cadForthcoming;
  if (shopWait) return "vendor_shop";
  if (input.communication === "vendor" && (input.noFounderAction || input.staleInboundSatisfied)) {
    return "vendor_shop";
  }
  if (input.waitingState === "client") return "client";
  if (input.staleInboundSatisfied && input.noFounderAction) {
    if (input.communication === "vendor") return "vendor_shop";
    return "client";
  }
  if (input.noFounderAction && input.communication === "vendor") return "vendor_shop";
  return "unknown";
}

function nextActionOf(input: {
  ballHolder: TodayBallHolder;
  remaining: RemainingFounderCommitment | null;
  printPlan: boolean;
  stlDelivered: boolean;
  cadForthcoming: boolean;
  displayName: string;
}): string | null {
  if (input.ballHolder !== "founder") {
    if (input.cadForthcoming) return `Review the new CAD when it arrives.`;
    return null;
  }
  if (input.remaining) return input.remaining.recommended;
  if (input.printPlan || input.stlDelivered) {
    return `Print/check the model and send ${input.displayName} the size update.`;
  }
  return null;
}

function latestEvent(
  evidence: readonly CosEvidenceBeat[],
  ok: (speaker: CosEvidenceBeat["speaker"]) => boolean,
): TodayBriefingEvent | null {
  const row = [...evidence].reverse().find((beat) => ok(beat.speaker));
  if (!row) return null;
  return {
    summary: clip(row.summary, 220),
    speaker: row.speaker,
    at: row.at || null,
    sourceRef: row.sourceHref,
  };
}

function enrichExternal(
  event: TodayBriefingEvent | null,
  input: {
    stlDelivered: boolean;
    cadForthcoming: boolean;
    cadLabel: string | null;
    vendorOwn: string;
    evidenceHay: string;
    vendorContactName: string | null;
  },
): TodayBriefingEvent | null {
  if (input.stlDelivered) {
    const cad = input.cadLabel ? ` ${input.cadLabel}` : "";
    const who = input.vendorContactName || "The shop";
    return {
      summary: clip(
        stlLine(input.vendorOwn, input.evidenceHay) ??
          `${who} delivered the${cad} Mod 1 STL.`,
        220,
      ),
      speaker: "vendor",
      at: event?.at ?? null,
      sourceRef: event?.sourceRef ?? null,
    };
  }
  if (input.cadForthcoming) {
    return {
      summary: clip(
        cadForthcomingLine(input.vendorOwn, input.evidenceHay) ||
          "The shop will send the updated CAD when it's ready.",
        220,
      ),
      speaker: "vendor",
      at: event?.at ?? null,
      sourceRef: event?.sourceRef ?? null,
    };
  }
  return event;
}

function enrichFounder(
  event: TodayBriefingEvent | null,
  input: {
    printPlan: boolean;
    founderOwn: string;
    evidenceHay: string;
    displayName: string;
  },
): TodayBriefingEvent | null {
  if (input.printPlan) {
    return {
      summary: clip(
        statedPlanLine(input.founderOwn, input.evidenceHay) ||
          `You told ${input.displayName} you'd print the model to confirm the proportions before moving forward.`,
        220,
      ),
      speaker: "founder",
      at: event?.at ?? null,
      sourceRef: event?.sourceRef ?? null,
    };
  }
  return event;
}

function statedPlanLine(founderOwn: string, evidenceHay: string): string | null {
  const hay = `${founderOwn}\n${evidenceHay}`;
  const match = hay.match(
    /[^.!?\n]*(?:print(?:ing)?|check(?:ing)? (?:the )?(?:size|proportion|model|huggie))[^.!?\n]*/i,
  );
  return match ? match[0]!.replace(/\s+/g, " ").trim() : null;
}

function stlLine(vendorOwn: string, evidenceHay: string): string | null {
  const hay = `${vendorOwn}\n${evidenceHay}`;
  const match = hay.match(/[^.!?\n]*\b(?:mod\s*\d+\s+)?stl\b[^.!?\n]*/i);
  return match ? match[0]!.replace(/\s+/g, " ").trim() : null;
}

function cadForthcomingLine(vendorOwn: string, evidenceHay: string): string | null {
  const hay = `${vendorOwn}\n${evidenceHay}`;
  const match = hay.match(
    /[^.!?\n]*(?:updated CAD|(?:I|we|she|they)(?:'ll| will) send (?:you )?(?:the )?(?:updated )?(?:CAD|STL|file)|CAD when it(?:'s| is) ready)[^.!?\n]*/i,
  );
  return match ? match[0]!.replace(/\s+/g, " ").trim() : null;
}

function composeIdentifiers(
  input: ComposeTodayBriefingPacketInput,
  subjectCad: string | null,
): TodayBriefingIdentifier[] {
  const subject = input.threadSubject ?? "";
  const own = [...(input.founderOwnTexts ?? []), ...(input.vendorOwnTexts ?? [])].join("\n");
  const quoted = (input.quotedTexts ?? []).join("\n");
  const currentHits = [
    ...extractTypedIdentifiers(subject),
    ...extractTypedIdentifiers(own),
    ...extractTypedIdentifiers(input.evidence.map((beat) => beat.summary).join("\n")),
    ...extractTypedIdentifiers((input.attachmentNames ?? []).join("\n")),
  ];
  const historical = historicalQuotedIdentifiers(own, quoted);
  const seen = new Set<string>();
  const rows: TodayBriefingIdentifier[] = [];
  const push = (value: string, role: IdentifierRole, current: boolean) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ value, role, current });
  };
  if (subjectCad) {
    const hit = extractTypedIdentifiers(subjectCad)[0];
    push(subjectCad, hit?.role ?? "cadId", true);
  }
  for (const cad of currentCadTokensFromIdentityHay([
    subject,
    ...(input.attachmentNames ?? []),
  ])) {
    push(cad, "cadId", true);
  }
  for (const hit of currentHits) {
    const current = identifierBindsToCurrentProject(hit.value, {
      subject,
      ownText: own,
      attachmentNames: input.attachmentNames,
    });
    push(hit.value, hit.role, current || hit.value.toUpperCase() === subjectCad);
  }
  for (const hit of historical) {
    push(hit.value, hit.role, false);
  }
  return rows;
}

function mustNotStateOf(input: {
  historicalIds: readonly string[];
  completion: boolean;
  lifecycle: string | null;
  openJobProven: boolean;
  printPlan: boolean;
}): string[] {
  const rows = [
    ...input.historicalIds.map((value) => `${value} is current`),
    "Abbey approved",
    "the job is in production",
    "this is a canonical Open Job",
  ];
  if (!input.completion) {
    rows.push("printing already happened");
    rows.push("the work is complete");
  }
  if (input.lifecycle !== "production" && input.lifecycle !== "in_production") {
    rows.push("this is in production");
  }
  if (!input.openJobProven) rows.push("canonical Open Job");
  if (input.printPlan) rows.push("the print already happened");
  return [...new Set(rows)];
}

function uncertaintyOf(input: {
  remaining: RemainingFounderCommitment | null;
  printPlan: boolean;
  lifecycle: string | null;
  openJobProven: boolean;
}): string[] {
  const rows: string[] = [];
  if (input.printPlan && !input.remaining) {
    rows.push("print/check is a stated founder plan, not a typed remaining-commitment");
  }
  if (!input.lifecycle) rows.push("lifecycle is not strongly proven");
  if (!input.openJobProven) rows.push("no proven canonical Open Job");
  return rows;
}

function uniqueRefs(rows: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const value = row.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function clip(text: string | null | undefined, max: number): string {
  const trimmed = (text ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

export function readTodayBriefingPacket(
  value: unknown,
): TodayBriefingPacket | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<TodayBriefingPacket>;
  if (typeof row.itemId !== "string" || !row.itemId.trim()) return null;
  if (typeof row.displayName !== "string" || !row.displayName.trim()) return null;
  const ballHolder = TODAY_BALL_HOLDERS.includes(row.ballHolder as TodayBallHolder)
    ? (row.ballHolder as TodayBallHolder)
    : null;
  if (!ballHolder) return null;
  const entityType = TODAY_BRIEFING_ENTITY_TYPES.includes(row.entityType as TodayBriefingEntityType)
    ? (row.entityType as TodayBriefingEntityType)
    : "unknown";
  return {
    itemId: row.itemId.trim(),
    displayName: row.displayName.trim().slice(0, 80),
    entityType,
    briefingKind:
      row.briefingKind === "founder_print_check" ||
      row.briefingKind === "vendor_cad_wait" ||
      row.briefingKind === "client_wait"
        ? row.briefingKind
        : "generic",
    projectName: typeof row.projectName === "string" ? row.projectName.slice(0, 80) : null,
    projectId: typeof row.projectId === "string" ? row.projectId : null,
    personId: typeof row.personId === "string" ? row.personId : null,
    organizationLabel: typeof row.organizationLabel === "string" ? row.organizationLabel.slice(0, 80) : null,
    vendorContactName: typeof row.vendorContactName === "string" ? row.vendorContactName.slice(0, 80) : null,
    identifiers: Array.isArray(row.identifiers)
      ? row.identifiers
          .filter((hit) => hit && typeof hit.value === "string")
          .slice(0, 8)
          .map((hit) => ({
            value: String(hit.value).slice(0, 40),
            role: hit.role === "workshopJobId" || hit.role === "productionJobId" || hit.role === "repairJobId" || hit.role === "vendorOrderId" ? hit.role : "cadId",
            current: hit.current === true,
          }))
      : [],
    lifecycle: typeof row.lifecycle === "string" ? row.lifecycle.slice(0, 40) : null,
    latestMeaningfulExternalEvent: readEvent(row.latestMeaningfulExternalEvent),
    latestMeaningfulFounderAction: readEvent(row.latestMeaningfulFounderAction),
    ballHolder,
    unresolvedFounderObligation:
      typeof row.unresolvedFounderObligation === "string"
        ? row.unresolvedFounderObligation.slice(0, 240)
        : null,
    externalCommitment:
      typeof row.externalCommitment === "string" ? row.externalCommitment.slice(0, 240) : null,
    nextExpectedEvent:
      typeof row.nextExpectedEvent === "string" ? row.nextExpectedEvent.slice(0, 240) : null,
    candidateNextAction:
      typeof row.candidateNextAction === "string" ? row.candidateNextAction.slice(0, 240) : null,
    uncertainty: Array.isArray(row.uncertainty)
      ? row.uncertainty.filter((line) => typeof line === "string").slice(0, 8)
      : [],
    mustNotState: Array.isArray(row.mustNotState)
      ? row.mustNotState.filter((line) => typeof line === "string").slice(0, 8)
      : [],
    sourceRefs: Array.isArray(row.sourceRefs)
      ? row.sourceRefs.filter((line) => typeof line === "string").slice(0, 12)
      : [],
  };
}

function readEvent(
  value: TodayBriefingPacket["latestMeaningfulExternalEvent"] | unknown,
): TodayBriefingEvent | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.summary !== "string") return null;
  const speaker =
    row.speaker === "founder" ||
    row.speaker === "client" ||
    row.speaker === "vendor" ||
    row.speaker === "system"
      ? row.speaker
      : "system";
  return {
    summary: row.summary.slice(0, 240),
    speaker,
    at: typeof row.at === "string" ? row.at : null,
    sourceRef: typeof row.sourceRef === "string" ? row.sourceRef : null,
  };
}

export function briefingPacketForSol(packet: TodayBriefingPacket): TodayBriefingPacket {
  return {
    ...packet,
    identifiers: packet.identifiers.map((row) => ({ ...row })),
    uncertainty: [...packet.uncertainty],
    mustNotState: [...packet.mustNotState],
    sourceRefs: [...packet.sourceRefs],
  };
}
