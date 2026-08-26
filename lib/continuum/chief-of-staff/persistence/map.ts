import type { AttentionItem, ChiefOfStaffBrief, WorthKnowingItem } from "../types";
import type { AttentionLifecyclePatch } from "./contract";

export type AttentionItemRow = {
  id: string;
  dedupe_key: string;
  kind: AttentionItem["kind"];
  headline: string;
  why_it_matters: string;
  recommended_action: string;
  urgency: AttentionItem["urgency"];
  importance: AttentionItem["importance"];
  audience: AttentionItem["audience"];
  confidence: AttentionItem["confidence"];
  epistemic_class: AttentionItem["epistemicClass"];
  person_id: string | null;
  project_id: string | null;
  observation_ids: string[];
  evidence_ids: string[];
  due_at: string | null;
  status: AttentionItem["status"];
  snoozed_until: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  reason_codes: string[];
  created_at: string;
  updated_at: string;
};

export type AttentionBriefRow = {
  id: string;
  local_date: string;
  generated_at: string;
  attention_item_ids: string[];
  worth_knowing: WorthKnowingItem[];
  silence_reason: string | null;
  created_at: string;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

export function itemToRow(item: AttentionItem, updatedAt: string): AttentionItemRow {
  return {
    id: item.id,
    dedupe_key: item.dedupeKey,
    kind: item.kind,
    headline: item.headline,
    why_it_matters: item.whyItMatters,
    recommended_action: item.recommendedAction,
    urgency: item.urgency,
    importance: item.importance,
    audience: item.audience,
    confidence: item.confidence,
    epistemic_class: item.epistemicClass,
    person_id: item.personId ?? null,
    project_id: item.projectId ?? null,
    observation_ids: [...item.observationIds],
    evidence_ids: [...item.evidenceIds],
    due_at: item.dueAt ?? null,
    status: item.status,
    snoozed_until: item.snoozedUntil ?? null,
    acknowledged_at: item.acknowledgedAt ?? null,
    resolved_at: item.resolvedAt ?? null,
    reason_codes: [...item.reasonCodes],
    created_at: item.createdAt,
    updated_at: updatedAt,
  };
}

export function rowToItem(row: Record<string, unknown>): AttentionItem {
  const item: AttentionItem = {
    id: String(row.id),
    dedupeKey: String(row.dedupe_key),
    kind: row.kind as AttentionItem["kind"],
    headline: String(row.headline),
    whyItMatters: String(row.why_it_matters),
    recommendedAction: String(row.recommended_action),
    urgency: row.urgency as AttentionItem["urgency"],
    importance: row.importance as AttentionItem["importance"],
    audience: row.audience as AttentionItem["audience"],
    confidence: row.confidence as AttentionItem["confidence"],
    epistemicClass: row.epistemic_class as AttentionItem["epistemicClass"],
    observationIds: asStringArray(row.observation_ids),
    evidenceIds: asStringArray(row.evidence_ids),
    status: row.status as AttentionItem["status"],
    createdAt: String(row.created_at),
    reasonCodes: asStringArray(row.reason_codes),
  };
  if (row.person_id) item.personId = String(row.person_id);
  if (row.project_id) item.projectId = String(row.project_id);
  if (row.due_at) item.dueAt = String(row.due_at);
  if (row.snoozed_until) item.snoozedUntil = String(row.snoozed_until);
  if (row.acknowledged_at) item.acknowledgedAt = String(row.acknowledged_at);
  if (row.resolved_at) item.resolvedAt = String(row.resolved_at);
  if (row.updated_at) item.updatedAt = String(row.updated_at);
  return item;
}

export function applyLifecyclePatch(
  item: AttentionItem,
  patch: AttentionLifecyclePatch,
  updatedAt: string,
): AttentionItem {
  const next: AttentionItem = {
    ...item,
    status: patch.status,
    reasonCodes: [...item.reasonCodes],
    observationIds: [...item.observationIds],
    evidenceIds: [...item.evidenceIds],
    updatedAt,
  };
  if (patch.snoozedUntil !== undefined) {
    if (patch.snoozedUntil) next.snoozedUntil = patch.snoozedUntil;
    else delete next.snoozedUntil;
  }
  if (patch.acknowledgedAt !== undefined) {
    if (patch.acknowledgedAt) next.acknowledgedAt = patch.acknowledgedAt;
    else delete next.acknowledgedAt;
  }
  if (patch.resolvedAt !== undefined) {
    if (patch.resolvedAt) next.resolvedAt = patch.resolvedAt;
    else delete next.resolvedAt;
  }
  return next;
}

export function briefToRow(
  brief: ChiefOfStaffBrief,
  createdAt: string,
): AttentionBriefRow {
  return {
    id: brief.id,
    local_date: brief.localDate,
    generated_at: brief.generatedAt,
    attention_item_ids: [...brief.attentionItemIds],
    worth_knowing: brief.worthKnowing.map((row) => ({ ...row })),
    silence_reason: brief.silenceReason ?? null,
    created_at: createdAt,
  };
}

export function rowToBrief(row: Record<string, unknown>): ChiefOfStaffBrief {
  const worthRaw = row.worth_knowing;
  const worthKnowing: WorthKnowingItem[] = Array.isArray(worthRaw)
    ? worthRaw.map((entry) => {
        const value = entry as WorthKnowingItem;
        return {
          headline: String(value.headline),
          ...(value.personId ? { personId: String(value.personId) } : {}),
          ...(value.projectId ? { projectId: String(value.projectId) } : {}),
          ...(value.reasonCodes ? { reasonCodes: [...value.reasonCodes] } : {}),
        };
      })
    : [];
  const brief: ChiefOfStaffBrief = {
    id: String(row.id),
    localDate: String(row.local_date).slice(0, 10),
    generatedAt: String(row.generated_at),
    attentionItemIds: asStringArray(row.attention_item_ids),
    worthKnowing,
  };
  if (row.silence_reason) brief.silenceReason = String(row.silence_reason);
  return brief;
}
