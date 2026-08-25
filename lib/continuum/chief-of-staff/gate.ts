import { MAX_NUMBERED_ATTENTION_ITEMS, NUMBERED_AUDIENCES, REASON } from "./constants";
import type {
  AttentionAudience,
  AttentionImportance,
  AttentionItem,
  AttentionUrgency,
} from "./types";

const URGENCY_RANK: Record<AttentionUrgency, number> = {
  now: 0,
  today: 1,
  "this-week": 2,
  watch: 3,
};

const IMPORTANCE_RANK: Record<AttentionImportance, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function isNumberedAudience(audience: AttentionAudience): boolean {
  return (NUMBERED_AUDIENCES as readonly string[]).includes(audience);
}

export function isCurrentlySnoozed(item: AttentionItem, nowIso: string): boolean {
  if (item.status !== "snoozed") return false;
  if (!item.snoozedUntil) return true;
  return Date.parse(item.snoozedUntil) > Date.parse(nowIso);
}

export function lifecycleSuppressReason(
  item: AttentionItem,
  nowIso: string,
): string | null {
  if (item.status === "resolved") return REASON.resolved;
  if (item.status === "expired") return REASON.expired;
  if (isCurrentlySnoozed(item, nowIso)) return REASON.snoozed;
  if (item.status === "acknowledged") return REASON.acknowledgedUnchanged;
  return null;
}

export function isLowConfidenceInference(item: AttentionItem): boolean {
  return item.confidence === "low" && item.epistemicClass === "inferred";
}

function noveltyRank(item: AttentionItem): number {
  if (item.reasonCodes.includes(REASON.worsened)) return 0;
  if (item.reasonCodes.includes(REASON.novel)) return 1;
  return 2;
}

function founderFocusRank(item: AttentionItem): number {
  return item.reasonCodes.includes(REASON.founderFocus) ? 0 : 1;
}

function relationshipRank(item: AttentionItem): number {
  return item.personId || item.projectId ? 0 : 1;
}

export function compareAttentionItems(a: AttentionItem, b: AttentionItem): number {
  const urgency = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
  if (urgency !== 0) return urgency;
  const importance = IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance];
  if (importance !== 0) return importance;
  const relationship = relationshipRank(a) - relationshipRank(b);
  if (relationship !== 0) return relationship;
  const novelty = noveltyRank(a) - noveltyRank(b);
  if (novelty !== 0) return novelty;
  const focus = founderFocusRank(a) - founderFocusRank(b);
  if (focus !== 0) return focus;
  return a.dedupeKey.localeCompare(b.dedupeKey);
}

export type GateDecision = {
  selected: AttentionItem[];
  suppressed: Array<{ item: AttentionItem; reason: string }>;
};

/**
 * Pure numbered-list gate. Does not fill slots with watch/FYI/delegate.
 */
export function gateNumberedAttention(
  items: AttentionItem[],
  nowIso: string,
  max = MAX_NUMBERED_ATTENTION_ITEMS,
): GateDecision {
  const suppressed: GateDecision["suppressed"] = [];
  const eligible: AttentionItem[] = [];
  const seenKeys = new Set<string>();

  for (const item of items) {
    const life = lifecycleSuppressReason(item, nowIso);
    if (life) {
      suppressed.push({ item, reason: life });
      continue;
    }
    if (!isNumberedAudience(item.audience)) {
      suppressed.push({ item, reason: REASON.audienceNotFounderAction });
      continue;
    }
    if (isLowConfidenceInference(item)) {
      suppressed.push({ item, reason: REASON.lowConfidenceInference });
      continue;
    }
    if (seenKeys.has(item.dedupeKey)) {
      suppressed.push({ item, reason: REASON.duplicate });
      continue;
    }
    seenKeys.add(item.dedupeKey);
    eligible.push(item);
  }

  eligible.sort(compareAttentionItems);
  const selected = eligible.slice(0, max);
  for (const item of eligible.slice(max)) {
    suppressed.push({ item, reason: REASON.numberedCap });
  }
  return { selected, suppressed };
}
