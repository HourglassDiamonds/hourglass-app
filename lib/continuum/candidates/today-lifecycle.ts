/**
 * CoS Today interpretation of canonical Project lifecycle.
 * Read-model only. Does not write lifecycle, Open Jobs, or Candidates.
 */

export const TODAY_LIFECYCLE_CLASSES = [
  "terminal",
  "production",
  "cad",
  "design",
  "ready",
  "queued",
  "unknown",
] as const;

export type TodayLifecycleClass = (typeof TODAY_LIFECYCLE_CLASSES)[number];

const TERMINAL_STAGES = new Set([
  "completed",
  "complete",
  "delivered",
  "closed",
  "archived",
]);

const PRODUCTION_STAGES = new Set([
  "production",
  "in_production",
  "manufacturing",
  "bench",
  "quality_control",
]);

const CAD_STAGES = new Set(["cad"]);

const DESIGN_STAGES = new Set(["design", "client_approval", "discovery"]);

const READY_STAGES = new Set(["ready_for_delivery", "ready_for_return"]);

const QUEUED_STAGES = new Set(["queued", "intake", "evaluation", "estimate"]);

const DESIGN_SPEC_FIELDS = new Set([
  "finger_size",
  "cad_job_number",
  "metal",
  "center_stone",
  "diamond_supply_notes",
]);

export function todayLifecycleClass(
  stage: string | null | undefined,
): TodayLifecycleClass {
  const value = stage?.trim().toLowerCase() ?? "";
  if (!value) return "unknown";
  if (TERMINAL_STAGES.has(value)) return "terminal";
  if (PRODUCTION_STAGES.has(value)) return "production";
  if (READY_STAGES.has(value)) return "ready";
  if (CAD_STAGES.has(value)) return "cad";
  if (DESIGN_STAGES.has(value)) return "design";
  if (QUEUED_STAGES.has(value)) return "queued";
  return "unknown";
}

export function isTerminalTodayLifecycle(
  stage: string | null | undefined,
): boolean {
  return todayLifecycleClass(stage) === "terminal";
}

export function isProductionTodayLifecycle(
  stage: string | null | undefined,
): boolean {
  return todayLifecycleClass(stage) === "production";
}

export function isDesignStageSpecField(fieldName: string): boolean {
  return DESIGN_SPEC_FIELDS.has(fieldName);
}

export function lifecycleAllowsHistoricalSpec(
  stage: string | null | undefined,
): boolean {
  const life = todayLifecycleClass(stage);
  return life === "design" || life === "cad" || life === "unknown";
}

const PERSON_BOUND_SIZE =
  /\b(?:actually (?:make|do) it|change (?:the )?size to|make it|i(?:'|’)m an?|i checked(?: my)?(?: ring| finger)? size|my (?:ring |finger )?size (?:is|to)|please (?:make|do) (?:it|the (?:ring|size)))\s*(?:a\s+)?(?:[1-9]|[12]\d|30)(?:\.\d+)?\b/i;

const POST_COMPLETION =
  /\b(repair|resize|service ticket|follow[- ]up request|payment (?:issue|due|failed)|invoice|broken|loose (?:stone|prong)|new (?:ring|project|piece))\b/i;

const PRODUCTION_EXCEPTION =
  /\b(approve|approval|eta|delay|blocked|cannot proceed|need you to|pickup|pick up|deliver|shipping exception|vendor asks)\b/i;

const DESIGN_STAGE_ACTION =
  /\b(send the recap|your turn|answered (?:a |the )?design|confirm the (?:finger size|cad|spec)|spec conflict|finger size differs|cad job number)\b/i;

export function isPersonBoundFingerSizeText(text: string): boolean {
  return PERSON_BOUND_SIZE.test(text);
}

export function isPostCompletionObligationText(text: string): boolean {
  return POST_COMPLETION.test(text);
}

export function isProductionExceptionText(text: string): boolean {
  return PRODUCTION_EXCEPTION.test(text);
}

export function isDesignStageActionText(text: string): boolean {
  return DESIGN_STAGE_ACTION.test(text);
}
