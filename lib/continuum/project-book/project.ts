/**
 * Deterministic Project Book projection.
 * Reads source records and the existing work-loop reducer.
 * Does not call a model, write, or mint projects.
 */

import { authorOwnedText } from "@/lib/continuum/gmail/candidates/spec-provenance";
import { reduceWorkLoop } from "@/lib/continuum/chief-of-staff/operating-loop/work-loop-state";
import {
  admitProjectEvidence,
  attachmentLabels,
  meaningfulAttachmentNames,
  PROJECT_HISTORY_NEEDS_REVIEW,
  safeFounderCopy,
} from "./admit";
import type { WorkLoopSemanticClass } from "@/lib/continuum/chief-of-staff/operating-loop/work-loop-state";
import type {
  SourceCommunicationEvent,
  SourceCommunicationEventClass,
} from "@/lib/continuum/source-events/types";
import type {
  ProjectBookAssociationReview,
  ProjectBookCurrentState,
  ProjectBookEvidence,
  ProjectBookHistoryState,
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

function timelineSummary(record: ProjectBookSourceRecord): string {
  if (record.semanticClass === "client_replies_nonblocking") return "Client reply";
  if (record.semanticClass === "vendor_acknowledges") return "Shop acknowledgement";
  return "Source note";
}

function evidenceOf(
  record: ProjectBookSourceRecord,
  interpretation: ProjectBookEvidence["interpretation"],
): ProjectBookEvidence {
  return {
    channel: projectBookChannelLabel(record.sourceType),
    timestamp: record.timestamp,
    subject: safeFounderCopy(record.subject),
    attachmentNames: meaningfulAttachmentNames(record.attachmentFilenames).slice(0, 8),
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
  /** Stored thread exists, but the desk does not trust it. Events stay out of chronology. */
  associationTrusted?: boolean;
}): ProjectBookRead {
  const projectId = input.projectId.trim();
  const generatedAt = input.nowIso ?? new Date().toISOString();
  if (input.associationTrusted === false) {
    return withheldBook({
      projectId,
      projectLabel: input.projectLabel,
      generatedAt,
    });
  }
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
    if (record.association === "candidate" && (record.projectId === projectId || named)) {
      reviewCount += 1;
    }
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
  const reduced = reduceWorkLoop({ evidence: [], sourceEvents });
  const hasHistory = prepared.length > 0;

  const milestones: ProjectBookMilestone[] = [];
  const timeline: ProjectBookTimelineEntry[] = [];
  const seenDisplay = new Set<string>();
  for (const row of prepared) {
    const admitted = admitProjectEvidence(row.record);
    if (!admitted.render) continue;
    const displayKey = `${row.record.sourceType}\u0000${row.record.sourceRef}`;
    if (seenDisplay.has(displayKey)) continue;
    seenDisplay.add(displayKey);
    const milestone = isMilestone(row.record, admitted.own);
    const labels = attachmentLabels(admitted.files);
    const evidence = evidenceOf(row.record, milestone ? "interpreted" : "source_only");
    const summary = milestone ? admitted.summary : timelineSummary(row.record);
    const entry: ProjectBookTimelineEntry = {
      timestamp: row.record.timestamp,
      sourceType: row.record.sourceType,
      actor: row.record.actor,
      direction: row.record.direction,
      semanticClass: row.record.semanticClass,
      summary,
      excerpt: milestone ? null : admitted.excerpt,
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
      summary,
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
  const historyState: ProjectBookHistoryState =
    exact.length > 0 ? "trusted" : reviewCount > 0 ? "needs_review" : "none";
  const currentState: ProjectBookCurrentState = {
    semanticClass: historyState === "needs_review" ? "unknown" : reduced.semanticClass,
    headline:
      historyState === "needs_review"
        ? "Insufficient project history"
        : stateHeadline(reduced.semanticClass, hasHistory),
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
    unresolved:
      historyState === "trusted" ? unresolvedFromReducer(reduced.semanticClass, reduced) : [],
    sourceCoverage: coverage(exact),
    associationReview:
      historyState === "needs_review"
        ? {
            status: "needs_review",
            summary: PROJECT_HISTORY_NEEDS_REVIEW,
            count: Math.max(reviewCount, 1),
          }
        : associationReview,
    historyState,
    generatedAt,
  };
}

function withheldBook(input: {
  projectId: string;
  projectLabel: string;
  generatedAt: string;
}): ProjectBookRead {
  return {
    projectId: input.projectId,
    projectLabel: input.projectLabel.trim() || "Project",
    currentState: {
      semanticClass: "unknown",
      headline: "Insufficient project history",
      lastMeaningfulChange: null,
      nextCheckpoint: null,
    },
    milestones: [],
    evidenceTimeline: [],
    evidenceOmittedCount: 0,
    unresolved: [],
    sourceCoverage: { represented: [], future: [...PROJECT_BOOK_FUTURE_SOURCE_TYPES] },
    associationReview: {
      status: "needs_review",
      summary: PROJECT_HISTORY_NEEDS_REVIEW,
      count: 1,
    },
    historyState: "needs_review",
    generatedAt: input.generatedAt,
  };
}
