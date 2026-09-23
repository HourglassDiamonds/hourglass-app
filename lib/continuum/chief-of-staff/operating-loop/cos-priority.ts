/**
 * Today client-first ranking contract. Presentation order only.
 * Does not create work, change ball-holder, or change eligibility.
 *
 * Model: cos-today-priority-v1
 *
 * Category rank (1 is first):
 * 1 client_project_obligation
 * 2 deadline_sensitive_follow_up
 * 3 repair_fulfillment_delivery
 * 4 operational_business
 * 5 geo_seo
 * 6 ga4_analytics
 * 7 website_content
 * 8 marketing_internal
 *
 * Sort key, deterministic, no hidden weights:
 * 1. Tier 0 if the item carries a real hard deadline: job timing label
 *    produced from an explicit dueAt that is PAST DUE or DUE TODAY.
 *    Prose that merely says "urgent" is not a hard deadline.
 * 2. Otherwise the category rank above.
 * 3. Existing work-loop seed score, higher first (unchanged scale).
 * 4. Latest evidence activity, newer first.
 *
 * Visible Up next capacity is 3 current founder actions.
 * Internal categories (4–8) fill only leftover slots after client-facing
 * categories (1–3), unless the internal item is tier 0.
 * A future advisory checkpoint is not a current Up next item.
 * Master Sprint rows stay fillers behind live client work; they are not
 * re-scored with a new point system.
 */

export const COS_TODAY_PRIORITY_MODEL_ID = "cos-today-priority-v1" as const;

export const COS_PRIORITY_CATEGORIES = [
  "client_project_obligation",
  "deadline_sensitive_follow_up",
  "repair_fulfillment_delivery",
  "operational_business",
  "geo_seo",
  "ga4_analytics",
  "website_content",
  "marketing_internal",
] as const;

export type CosPriorityCategory = (typeof COS_PRIORITY_CATEGORIES)[number];

export const COS_PRIORITY_RANK: Record<CosPriorityCategory, number> = {
  client_project_obligation: 1,
  deadline_sensitive_follow_up: 2,
  repair_fulfillment_delivery: 3,
  operational_business: 4,
  geo_seo: 5,
  ga4_analytics: 6,
  website_content: 7,
  marketing_internal: 8,
};

export const COS_UP_NEXT_VISIBLE_LIMIT = 3 as const;

export type CosPriorityInput = {
  origin: string;
  subject: string;
  headline: string;
  context: string | null;
  projectId: string | null;
  projectName: string | null;
  entityType: string | null;
  briefingKind: string | null;
  ballHolder: string | null;
  /** Founder timing label from an explicit dueAt, e.g. "PAST DUE · AUG 1". */
  timingLabel: string | null;
};

export type CosRankedRow = {
  priority: CosPriorityInput;
  score: number;
  activityMs: number;
};

const INTERNAL_TEXT: Array<{ category: CosPriorityCategory; pattern: RegExp }> = [
  { category: "geo_seo", pattern: /\b(geo|seo|search console|\bgsc\b|google business profile|local pack)\b/i },
  { category: "ga4_analytics", pattern: /\b(ga4|google analytics|analytics dashboard)\b/i },
  { category: "website_content", pattern: /\b(website refresh|content update|landing page|blog post|site copy)\b/i },
  { category: "marketing_internal", pattern: /\b(marketing|newsletter|instagram|campaign|internal improvement)\b/i },
];

export function classifyCosPriority(input: CosPriorityInput): CosPriorityCategory {
  const hay = `${input.subject}\n${input.headline}\n${input.context ?? ""}\n${input.projectName ?? ""}`;
  const internal = INTERNAL_TEXT.find((row) => row.pattern.test(hay))?.category ?? null;
  const clientBound = isClientBound(input, hay);
  if (input.origin === "master_sprint") return internal ?? "marketing_internal";
  if (internal && !clientBound) return internal;
  if (clientBound && /\b(repair|resiz(?:e|ing)|ship(?:ping)?|fulfillment)\b/i.test(hay) && !/\b(cad|stl|design)\b/i.test(hay)) {
    return "repair_fulfillment_delivery";
  }
  if (
    clientBound &&
    input.ballHolder !== "founder" &&
    /\b(follow up|delivery|lead time|confirmation missing)\b/i.test(hay)
  ) {
    return "deadline_sensitive_follow_up";
  }
  if (clientBound) return "client_project_obligation";
  if (internal) return internal;
  return "operational_business";
}

export function hasHardDeadline(input: CosPriorityInput): boolean {
  return /^(?:PAST DUE|DUE TODAY)\b/.test(input.timingLabel?.trim() ?? "");
}

/** 0 = hard deadline. Otherwise the category rank 1–8. */
export function cosPriorityTier(input: CosPriorityInput): number {
  if (hasHardDeadline(input)) return 0;
  return COS_PRIORITY_RANK[classifyCosPriority(input)];
}

export function compareTodayRank(left: CosRankedRow, right: CosRankedRow): number {
  const tier = cosPriorityTier(left.priority) - cosPriorityTier(right.priority);
  if (tier !== 0) return tier;
  if (left.score !== right.score) return right.score - left.score;
  if (left.activityMs !== right.activityMs) return right.activityMs - left.activityMs;
  return 0;
}

export function clientFacingCategory(category: CosPriorityCategory): boolean {
  return COS_PRIORITY_RANK[category] <= COS_PRIORITY_RANK.repair_fulfillment_delivery;
}

/**
 * Live current actions first, then internal fillers into leftover visible slots.
 * Future advisory rows are not passed in here; callers keep them off this list.
 */
export function fillUpNextCapacity<T extends { priority: CosPriorityInput }>(
  live: readonly T[],
  fillers: readonly T[],
  visibleLimit = COS_UP_NEXT_VISIBLE_LIMIT,
): { visible: T[]; queuedLive: T[] } {
  const orderedLive = [...live];
  const visible = orderedLive.slice(0, visibleLimit);
  const queuedLive = orderedLive.slice(visibleLimit);
  const room = Math.max(0, visibleLimit - visible.length);
  if (room === 0) return { visible, queuedLive };
  const filler = fillers.filter((row) => !clientFacingCategory(classifyCosPriority(row.priority)));
  return { visible: [...visible, ...filler.slice(0, room)], queuedLive };
}

function isClientBound(input: CosPriorityInput, hay: string): boolean {
  if (input.projectId) return true;
  if (input.entityType === "client" || input.entityType === "project") return true;
  if (
    input.briefingKind === "founder_print_check" ||
    input.briefingKind === "vendor_cad_wait" ||
    input.briefingKind === "client_wait"
  ) {
    return true;
  }
  if (input.ballHolder === "client" || input.ballHolder === "vendor_shop") return true;
  if (/\b(?:C\d{5,}|RN\d{4,}|SP\d{4,})\b/.test(hay)) return true;
  return false;
}
