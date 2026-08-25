import {
  MAX_WORTH_KNOWING_ITEMS,
  REASON,
  SILENCE_REASON,
} from "./constants";
import { gateNumberedAttention, lifecycleSuppressReason } from "./gate";
import { briefIdForLocalDate, stableAttentionId } from "./ids";
import type {
  AttentionItem,
  AttentionKind,
  ChiefOfStaffBrief,
  ObservationChangeClass,
  SpecialistObservation,
  WorthKnowingItem,
} from "./types";

const WORTH_KNOWING_KINDS = new Set(["birthday-upcoming"]);

const KIND_MAP: Record<string, AttentionKind> = {
  "founder-focus-now": "founder-action",
  "client-follow-up-due": "relationship-follow-through",
  "client-stalled": "relationship-follow-through",
  "client-missing-next-step": "relationship-follow-through",
  "client-new-inquiry": "relationship-follow-through",
  "critical-website": "material-risk",
  "sla-overdue": "material-risk",
  "birthday-upcoming": "milestone",
};

export type ComposeChiefOfStaffInput = {
  localDate: string;
  generatedAt: string;
  observations: SpecialistObservation[];
  existingItems?: AttentionItem[];
  nowIso?: string;
};

export type ComposeChiefOfStaffResult = {
  brief: ChiefOfStaffBrief;
  items: AttentionItem[];
};

function existingByDedupeKey(
  existing: AttentionItem[],
): Map<string, AttentionItem> {
  const map = new Map<string, AttentionItem>();
  for (const item of existing) {
    const prior = map.get(item.dedupeKey);
    if (!prior || Date.parse(item.createdAt) >= Date.parse(prior.createdAt)) {
      map.set(item.dedupeKey, item);
    }
  }
  return map;
}

function headlineFromObservation(observation: SpecialistObservation): string {
  const action = observation.recommendedAction?.trim();
  if (action) return action;
  return observation.summary.trim();
}

function applyChangeClass(
  observation: SpecialistObservation,
  existing: AttentionItem | undefined,
): ObservationChangeClass {
  if (observation.changeClass === "worsened") return "worsened";
  if (!existing) return "novel";
  return "unchanged";
}

function mergeCandidate(
  observation: SpecialistObservation,
  existing: AttentionItem | undefined,
  generatedAt: string,
): AttentionItem {
  const change = applyChangeClass(observation, existing);
  const kind = KIND_MAP[observation.kind] ?? "specialist-opportunity";
  const reasonCodes: string[] = [change === "worsened" ? REASON.worsened : REASON.novel];
  if (observation.specialist === "founder-focus") {
    reasonCodes.push(REASON.founderFocus);
  }
  if (observation.kind === "client-follow-up-due") {
    reasonCodes.push(REASON.clientFollowUpDue);
  }
  if (observation.kind === "critical-website") {
    reasonCodes.push(REASON.criticalWebsite);
  }
  if (observation.kind === "sla-overdue") {
    reasonCodes.push(REASON.slaOverdue);
  }
  if (observation.kind === "birthday-upcoming") {
    reasonCodes.push(REASON.birthdayUpcoming);
  }

  const reopened =
    change === "worsened" &&
    existing &&
    (existing.status === "acknowledged" ||
      existing.status === "resolved" ||
      existing.status === "snoozed" ||
      existing.status === "expired");

  const status = reopened ? "new" : (existing?.status ?? "new");

  return {
    id: existing?.id ?? stableAttentionId(observation.dedupeKey),
    dedupeKey: observation.dedupeKey,
    kind,
    headline: headlineFromObservation(observation),
    whyItMatters: (observation.whyItMatters ?? observation.summary).trim(),
    recommendedAction: (
      observation.recommendedAction ?? observation.summary
    ).trim(),
    urgency: observation.urgencyHint,
    importance: observation.importanceHint,
    audience: observation.audienceHint,
    confidence: observation.confidence,
    epistemicClass: observation.epistemicClass,
    personId: observation.subject.personId,
    projectId: observation.subject.projectId,
    observationIds: [...observation.observationIds],
    evidenceIds: [...observation.evidenceIds],
    status,
    snoozedUntil: reopened ? undefined : existing?.snoozedUntil,
    acknowledgedAt: reopened ? undefined : existing?.acknowledgedAt,
    resolvedAt: reopened ? undefined : existing?.resolvedAt,
    createdAt: existing?.createdAt ?? generatedAt,
    reasonCodes,
  };
}

function worthKnowingFromObservation(
  observation: SpecialistObservation,
): WorthKnowingItem {
  return {
    headline: headlineFromObservation(observation),
    personId: observation.subject.personId,
    projectId: observation.subject.projectId,
    reasonCodes: [REASON.birthdayUpcoming],
  };
}

export function composeChiefOfStaffBrief(
  input: ComposeChiefOfStaffInput,
): ComposeChiefOfStaffResult {
  const nowIso = input.nowIso ?? input.generatedAt;
  const existing = existingByDedupeKey(input.existingItems ?? []);
  const numberedCandidates: AttentionItem[] = [];
  const worthKnowing: WorthKnowingItem[] = [];

  for (const observation of input.observations) {
    if (WORTH_KNOWING_KINDS.has(observation.kind)) {
      if (worthKnowing.length < MAX_WORTH_KNOWING_ITEMS) {
        worthKnowing.push(worthKnowingFromObservation(observation));
      }
      continue;
    }

    const prior = existing.get(observation.dedupeKey);
    const change = applyChangeClass(observation, prior);
    const candidate = mergeCandidate(observation, prior, input.generatedAt);

    if (
      prior &&
      change !== "worsened" &&
      lifecycleSuppressReason(prior, nowIso)
    ) {
      numberedCandidates.push({
        ...prior,
        reasonCodes: [
          ...prior.reasonCodes,
          lifecycleSuppressReason(prior, nowIso)!,
        ],
      });
      continue;
    }

    numberedCandidates.push(candidate);
  }

  const gated = gateNumberedAttention(numberedCandidates, nowIso);
  const items = gated.selected;
  const silenceReason = items.length === 0 ? SILENCE_REASON : undefined;

  const brief: ChiefOfStaffBrief = {
    id: briefIdForLocalDate(input.localDate),
    localDate: input.localDate,
    generatedAt: input.generatedAt,
    attentionItemIds: items.map((item) => item.id),
    worthKnowing,
    silenceReason,
  };

  return { brief, items };
}
