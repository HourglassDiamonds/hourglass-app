/**
 * Deterministic Project Book projection.
 * Reads source records and the existing work-loop reducer.
 * Does not call a model, write, or mint projects.
 */

import { authorOwnedText } from "@/lib/continuum/gmail/candidates/spec-provenance";
import { reduceWorkLoop } from "@/lib/continuum/chief-of-staff/operating-loop/work-loop-state";
import type { WorkLoopSemanticClass } from "@/lib/continuum/chief-of-staff/operating-loop/work-loop-state";
import { workLoopEventsFromSource } from "@/lib/continuum/source-events/work-loop";
import type {
  SourceCommunicationEvent,
  SourceCommunicationEventClass,
} from "@/lib/continuum/source-events/types";
import type {
  ProjectBookAssociationReview,
  ProjectBookCurrentState,
  ProjectBookEvidence,
  ProjectBookMilestone,
  ProjectBookRead,
  ProjectBookSourceCoverage,
  ProjectBookSourceRecord,
  ProjectBookSourceType,
  ProjectBookTimelineEntry,
  ProjectBookUnresolved,
} from "./types";
import {
  PROJECT_BOOK_FUTURE_SOURCE_TYPES,
  PROJECT_BOOK_MILESTONE_LIMIT,
  PROJECT_BOOK_TIMELINE_LIMIT,
} from "./types";

const MILESTONE_CLASSES = new Set<SourceCommunicationEventClass>([
  "client_requests",
  "client_approves",
  "founder_fulfills_commitment",
  "founder_requests_vendor",
  "founder_updates_client",
  "vendor_promises",
  "vendor_delivers_artifact",
  "vendor_order_confirmation",
  "workshop_started",
]);

const CHANNEL_LABEL: Record<ProjectBookSourceType, string> = {
  gmail: "Gmail",
  sms: "SMS",
  calendar: "Calendar",
  plaud: "PLAUD",
  founder_note: "Notes",
  artifact: "Artifacts",
  concierge_form: "Concierge forms",
};

export function projectBookChannelLabel(sourceType: ProjectBookSourceType): string {
  return CHANNEL_LABEL[sourceType];
}

function folded(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function ownText(record: ProjectBookSourceRecord): string {
  return folded(authorOwnedText(record.authorOwnedText));
}

function safePerson(label: string | null): string | null {
  const trimmed = folded(label);
  if (!trimmed || trimmed.includes("@")) return null;
  return trimmed.slice(0, 80);
}

function safeSubject(subject: string | null): string | null {
  const trimmed = folded(subject);
  if (!trimmed) return null;
  return trimmed.slice(0, 180);
}

export function attachmentLabels(filenames: readonly string[]): string[] {
  const labels: string[] = [];
  const add = (label: string) => {
    if (!labels.includes(label)) labels.push(label);
  };
  for (const name of filenames) {
    const file = name.trim();
    if (!file) continue;
    if (/\.stl\b|\bstl\b/i.test(file)) add("STL");
    else if (/quote/i.test(file)) add("Quote");
    else if (/order|confirmation|\bSP\d{4,}\b/i.test(file)) add("Order confirmation");
    else if (/render/i.test(file)) add("Render");
    else if (/NL-H017-|\bcad\b/i.test(file)) add("CAD");
  }
  return labels;
}

function substantive(record: ProjectBookSourceRecord, own: string): boolean {
  if (!own) return false;
  const subject = folded(record.subject);
  if (subject && own.toLowerCase() === subject.toLowerCase()) return false;
  if (/^(?:re|fw|fwd)\s*:/i.test(own)) return false;
  if (/sent from my iphone|this (?:email|message) and any attachments|confidential/i.test(own)) {
    return false;
  }
  return own.length >= 12;
}

function structuralMilestone(record: ProjectBookSourceRecord, own: string): boolean {
  const hay = `${folded(record.subject)}\n${own}\n${record.attachmentFilenames.join("\n")}`;
  switch (record.semanticClass) {
    case "vendor_delivers_artifact":
      return attachmentLabels(record.attachmentFilenames).length > 0 || /\b(?:cad|stl)\b/i.test(hay);
    case "vendor_order_confirmation":
      return /\bSP\d{4,}\b|\border confirmation\b/i.test(hay);
    case "workshop_started":
      return /\bRN\d{4,}\b|\bworkshop\b/i.test(hay);
    case "founder_requests_vendor":
      return /\bHGD\s*x\s+.+-C\d{5,}/i.test(hay) || substantive(record, own);
    case "vendor_promises":
    case "client_requests":
    case "client_approves":
    case "founder_fulfills_commitment":
    case "founder_updates_client":
      return substantive(record, own);
    default:
      return false;
  }
}

function isMilestone(record: ProjectBookSourceRecord, own: string): boolean {
  if (!record.semanticClass || !MILESTONE_CLASSES.has(record.semanticClass)) return false;
  return structuralMilestone(record, own);
}

function firstSentence(text: string): string {
  const clean = folded(text);
  const cut = clean.split(/(?<=[.!])\s/)[0] ?? clean;
  return cut.slice(0, 180);
}

function milestoneLabel(semanticClass: SourceCommunicationEventClass): string {
  switch (semanticClass) {
    case "client_requests":
      return "Client request";
    case "client_approves":
      return "Client approved";
    case "founder_fulfills_commitment":
      return "Founder fulfillment";
    case "founder_requests_vendor":
      return "Sent to shop";
    case "founder_updates_client":
      return "Client follow-up";
    case "vendor_promises":
      return "Shop promise";
    case "vendor_delivers_artifact":
      return "Shop delivered";
    case "vendor_order_confirmation":
      return "Order confirmation";
    case "workshop_started":
      return "Workshop started";
    default:
      return "Source note";
  }
}

function classFallback(semanticClass: SourceCommunicationEventClass): string {
  switch (semanticClass) {
    case "client_requests":
      return "Client asked for a change.";
    case "client_approves":
      return "Client approved the current direction.";
    case "founder_fulfills_commitment":
      return "Founder fulfilled the current commitment.";
    case "founder_requests_vendor":
      return "Founder sent the current request to the shop.";
    case "founder_updates_client":
      return "Founder sent an update to the client.";
    case "vendor_promises":
      return "Shop promised the next delivery.";
    case "vendor_delivers_artifact":
      return "Shop delivered files.";
    case "vendor_order_confirmation":
      return "Order confirmation is in.";
    case "workshop_started":
      return "Workshop started.";
    default:
      return "Source note.";
  }
}

function timelineSummary(record: ProjectBookSourceRecord): string {
  if (record.semanticClass === "client_replies_nonblocking") return "Client reply";
  if (record.semanticClass === "vendor_acknowledges") return "Shop acknowledgement";
  return "Source note";
}

function excerptOf(record: ProjectBookSourceRecord, own: string): string | null {
  if (!substantive(record, own)) return null;
  if (/^(?:thanks|thank you|got it|perfect|sounds good)[!.\s]*$/i.test(own)) return null;
  return firstSentence(own);
}

function evidenceOf(
  record: ProjectBookSourceRecord,
  interpretation: ProjectBookEvidence["interpretation"],
): ProjectBookEvidence {
  return {
    channel: projectBookChannelLabel(record.sourceType),
    timestamp: record.timestamp,
    subject: safeSubject(record.subject),
    attachmentNames: record.attachmentFilenames.map((name) => name.trim()).filter(Boolean).slice(0, 8),
    classification: record.semanticClass ?? "unclassified",
    interpretation,
  };
}

function asSourceEvent(record: ProjectBookSourceRecord, own: string): SourceCommunicationEvent {
  return {
    sourceType: record.sourceType === "calendar" || record.sourceType === "artifact" ? "gmail" : record.sourceType,
    sourceRef: record.sourceRef,
    messageId: null,
    threadId: null,
    timestamp: record.timestamp,
    direction: record.direction ?? "unknown",
    actor: record.actor,
    subject: record.subject,
    authorOwnedText: own,
    quotedText: "",
    attachmentFilenames: record.attachmentFilenames,
    hasAttachments: record.attachmentFilenames.length > 0,
    cadIds: record.cadIds,
    orderIds: [],
    productionJobIds: [],
    personLabel: safePerson(record.personLabel),
    projectId: record.projectId,
    workLoopId: record.projectId ? `project:${record.projectId}` : null,
    semanticClass: record.semanticClass ?? "unknown_communication",
    provenance: record.provenance === "indexed_gmail+interpretation" ? "indexed_gmail+interpretation" : "indexed_gmail",
  };
}

function milestoneSummary(
  record: ProjectBookSourceRecord,
  own: string,
  loopText: string | undefined,
): string {
  if (substantive(record, own)) return firstSentence(own);
  const usefulLoop = loopText && loopText.toLowerCase() !== folded(record.subject).toLowerCase() && !/^re:/i.test(loopText);
  if (
    usefulLoop &&
    (record.semanticClass === "vendor_delivers_artifact" ||
      record.semanticClass === "vendor_order_confirmation" ||
      record.semanticClass === "workshop_started")
  ) {
    return loopText.slice(0, 180);
  }
  const files = attachmentLabels(record.attachmentFilenames);
  if (record.semanticClass === "vendor_delivers_artifact" && files.length > 0) {
    return `${files.join(" and ")} received.`;
  }
  if (record.semanticClass) return classFallback(record.semanticClass);
  return "Source note.";
}

function stateHeadline(
  semanticClass: WorkLoopSemanticClass,
  hasHistory: boolean,
): string {
  switch (semanticClass) {
    case "vendor_shop_wait":
      return "Waiting on shop";
    case "founder_review":
      return "Founder review";
    case "founder_print_check":
      return "Founder print check";
    case "founder_communication":
      return "Founder action";
    case "client_wait":
      return "Waiting on client";
    default:
      return hasHistory ? "No open obligation" : "No history yet";
  }
}

function unresolvedFromReducer(
  semanticClass: WorkLoopSemanticClass,
  flags: { founderOpen: boolean; clientOpen: boolean; vendorOpen: boolean },
): ProjectBookUnresolved[] {
  const rows: ProjectBookUnresolved[] = [];
  if (flags.vendorOpen) rows.push({ holder: "vendor_shop", label: "Waiting on shop" });
  if (flags.clientOpen) rows.push({ holder: "client", label: "Waiting on client" });
  if (flags.founderOpen) {
    rows.push({
      holder: "founder",
      label:
        semanticClass === "founder_review"
          ? "Founder owes review"
          : semanticClass === "founder_print_check"
            ? "Founder owes a print check"
            : "Founder owes the next turn",
    });
  }
  return rows;
}

function sortRecords(records: readonly ProjectBookSourceRecord[]): ProjectBookSourceRecord[] {
  return [...records].sort((left, right) => {
    const delta = Date.parse(left.timestamp) - Date.parse(right.timestamp);
    if (delta !== 0 && Number.isFinite(delta)) return delta;
    const type = left.sourceType.localeCompare(right.sourceType);
    if (type !== 0) return type;
    return left.sourceRef.localeCompare(right.sourceRef);
  });
}

function dedupe(records: readonly ProjectBookSourceRecord[]): ProjectBookSourceRecord[] {
  const byKey = new Map<string, ProjectBookSourceRecord>();
  const order: string[] = [];
  for (const record of records) {
    if (!record.sourceRef) continue;
    const key = `${record.sourceType}\u0000${record.sourceRef}`;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, record);
      order.push(key);
      continue;
    }
    if (current.association !== "exact" && record.association === "exact") {
      byKey.set(key, record);
    }
  }
  return order.flatMap((key) => {
    const record = byKey.get(key);
    return record ? [record] : [];
  });
}

function cadSet(records: readonly ProjectBookSourceRecord[]): Set<string> {
  const ids = new Set<string>();
  for (const record of records) {
    for (const cad of record.cadIds) {
      const token = cad.trim().toUpperCase();
      if (token) ids.add(token);
    }
  }
  return ids;
}

function sharesCad(record: ProjectBookSourceRecord, cads: ReadonlySet<string>): boolean {
  return record.cadIds.some((cad) => cads.has(cad.trim().toUpperCase()));
}

function coverage(records: readonly ProjectBookSourceRecord[]): ProjectBookSourceCoverage {
  const represented: ProjectBookSourceType[] = [];
  for (const record of records) {
    if (!represented.includes(record.sourceType)) represented.push(record.sourceType);
  }
  represented.sort();
  const future = PROJECT_BOOK_FUTURE_SOURCE_TYPES.filter((sourceType) => !represented.includes(sourceType));
  return { represented, future };
}

export function projectBook(input: {
  projectId: string;
  projectLabel: string;
  records: readonly ProjectBookSourceRecord[];
  nowIso?: string;
  timelineLimit?: number;
  milestoneLimit?: number;
}): ProjectBookRead {
  const projectId = input.projectId.trim();
  const generatedAt = input.nowIso ?? new Date().toISOString();
  const timelineLimit = input.timelineLimit ?? PROJECT_BOOK_TIMELINE_LIMIT;
  const milestoneLimit = input.milestoneLimit ?? PROJECT_BOOK_MILESTONE_LIMIT;
  const sorted = dedupe(sortRecords(input.records));
  const exact = sorted.filter(
    (record) => record.association === "exact" && record.projectId === projectId,
  );
  const exactCads = cadSet(exact);
  const otherExactCads = cadSet(
    sorted.filter((record) => record.association === "exact" && record.projectId && record.projectId !== projectId),
  );
  let reviewCount = 0;
  for (const record of sorted) {
    if (record.association === "exact" && record.projectId === projectId) continue;
    const named = record.plausibleProjectIds.includes(projectId);
    const cadHit = record.projectId == null && sharesCad(record, exactCads);
    const cadElsewhere = sharesCad(record, otherExactCads);
    const ambiguousCad = record.association === "unassigned" && cadHit && cadElsewhere;
    const plausibleCad = record.association === "unassigned" && cadHit && !cadElsewhere;
    if ((record.association === "ambiguous" && named) || ambiguousCad || plausibleCad) {
      reviewCount += 1;
    }
  }
  const associationReview: ProjectBookAssociationReview | null =
    reviewCount > 0
      ? {
          status: "needs_review",
          summary: "Identity / project match needs review",
          count: reviewCount,
        }
      : null;

  const prepared = exact.map((record) => ({ record, own: ownText(record) }));
  const sourceEvents = prepared.map((row) => asSourceEvent(row.record, row.own));
  const loopEvents = workLoopEventsFromSource(sourceEvents);
  const loopText = new Map<string, string>();
  sourceEvents.forEach((event, index) => {
    const text = loopEvents[index]?.text ?? "";
    if (text) loopText.set(event.sourceRef, text);
  });
  const reduced = reduceWorkLoop({ evidence: [], sourceEvents });
  const hasHistory = prepared.length > 0;

  const milestones: ProjectBookMilestone[] = [];
  const timeline: ProjectBookTimelineEntry[] = [];
  for (const row of prepared) {
    const milestone = isMilestone(row.record, row.own);
    const labels = attachmentLabels(row.record.attachmentFilenames);
    const evidence = evidenceOf(row.record, milestone ? "interpreted" : "source_only");
    const entry: ProjectBookTimelineEntry = {
      timestamp: row.record.timestamp,
      sourceType: row.record.sourceType,
      actor: row.record.actor,
      direction: row.record.direction,
      semanticClass: row.record.semanticClass,
      summary: milestone
        ? milestoneSummary(row.record, row.own, loopText.get(row.record.sourceRef))
        : timelineSummary(row.record),
      excerpt: excerptOf(row.record, row.own),
      sourceRefs: [row.record.sourceRef],
      evidence,
      attachmentLabels: labels,
      personLabel: safePerson(row.record.personLabel),
      milestone,
    };
    timeline.push(entry);
    if (!milestone || !row.record.semanticClass) continue;
    milestones.push({
      timestamp: row.record.timestamp,
      semanticClass: row.record.semanticClass,
      label: milestoneLabel(row.record.semanticClass),
      summary: entry.summary,
      actor: row.record.actor,
      sourceRefs: [row.record.sourceRef],
      evidence: [evidence],
      attachmentLabels: labels,
      personLabel: entry.personLabel,
    });
  }

  const milestoneWindow =
    milestones.length > milestoneLimit ? milestones.slice(milestones.length - milestoneLimit) : milestones;
  const omittedMilestones = milestones.length - milestoneWindow.length;
  const timelineWindow =
    timeline.length > timelineLimit ? timeline.slice(timeline.length - timelineLimit) : timeline;
  const evidenceOmittedCount = timeline.length - timelineWindow.length + omittedMilestones;

  const last = milestoneWindow[milestoneWindow.length - 1] ?? null;
  const currentState: ProjectBookCurrentState = {
    semanticClass: reduced.semanticClass,
    headline: stateHeadline(reduced.semanticClass, hasHistory),
    lastMeaningfulChange: last
      ? { label: last.label, summary: last.summary, timestamp: last.timestamp }
      : null,
    nextCheckpoint: reduced.nextExpectedEvent
      ? { summary: reduced.nextExpectedEvent, basis: "work_loop" }
      : null,
  };

  return {
    projectId,
    projectLabel: input.projectLabel.trim() || "Project",
    currentState,
    milestones: milestoneWindow,
    evidenceTimeline: timelineWindow,
    evidenceOmittedCount,
    unresolved: unresolvedFromReducer(reduced.semanticClass, reduced),
    sourceCoverage: coverage(exact),
    associationReview,
    generatedAt,
  };
}
