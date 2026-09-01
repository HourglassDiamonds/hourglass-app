/**
 * Canonical Project Lifecycle for Custom / New Jewelry and Repair / Service.
 * Founder-explicit only. Does not infer from Kind, specs, evidence, or artifacts.
 * Does not imply Open Jobs, waiting, CoS attention, or commercial state.
 */

export const LIFECYCLE_KINDS = [
  "custom_new_jewelry",
  "repair_service",
] as const;

export type LifecycleKind = (typeof LIFECYCLE_KINDS)[number];

export const CUSTOM_LIFECYCLE_STAGES = [
  "discovery",
  "design",
  "cad",
  "client_approval",
  "production",
  "quality_control",
  "ready_for_delivery",
  "completed",
] as const;

export const REPAIR_LIFECYCLE_STAGES = [
  "intake",
  "evaluation",
  "estimate",
  "client_approval",
  "bench",
  "quality_control",
  "ready_for_return",
  "completed",
] as const;

export type CustomLifecycleStage = (typeof CUSTOM_LIFECYCLE_STAGES)[number];
export type RepairLifecycleStage = (typeof REPAIR_LIFECYCLE_STAGES)[number];
export type ProjectLifecycleStage = CustomLifecycleStage | RepairLifecycleStage;

export const PROJECT_LIFECYCLE_NOT_SET_LABEL = "Not set";
export const PROJECT_LIFECYCLE_CLEAR_LABEL = "Clear / Not set";
export const PROJECT_LIFECYCLE_SECTION_TITLE = "Lifecycle";
export const PROJECT_LIFECYCLE_CURRENT_LABEL = "Current";
export const PROJECT_LIFECYCLE_HISTORY_TITLE = "Lifecycle history";
export const PROJECT_LIFECYCLE_EVENT_LIMIT = 20;

export const CUSTOM_LIFECYCLE_STAGE_LABELS: Record<CustomLifecycleStage, string> =
  {
    discovery: "Discovery",
    design: "Design",
    cad: "CAD",
    client_approval: "Client Approval",
    production: "Production",
    quality_control: "Quality Control",
    ready_for_delivery: "Ready for Delivery",
    completed: "Complete",
  };

export const REPAIR_LIFECYCLE_STAGE_LABELS: Record<RepairLifecycleStage, string> =
  {
    intake: "Intake",
    evaluation: "Evaluation",
    estimate: "Estimate",
    client_approval: "Client Approval",
    bench: "Bench",
    quality_control: "Quality Control",
    ready_for_return: "Ready for Return",
    completed: "Complete",
  };

export function isLifecycleKind(value: unknown): value is LifecycleKind {
  return (
    typeof value === "string" &&
    (LIFECYCLE_KINDS as readonly string[]).includes(value)
  );
}

export function isCustomLifecycleStage(
  value: unknown,
): value is CustomLifecycleStage {
  return (
    typeof value === "string" &&
    (CUSTOM_LIFECYCLE_STAGES as readonly string[]).includes(value)
  );
}

export function isRepairLifecycleStage(
  value: unknown,
): value is RepairLifecycleStage {
  return (
    typeof value === "string" &&
    (REPAIR_LIFECYCLE_STAGES as readonly string[]).includes(value)
  );
}

export function stagesForLifecycleKind(
  kind: LifecycleKind,
): readonly ProjectLifecycleStage[] {
  return kind === "custom_new_jewelry"
    ? CUSTOM_LIFECYCLE_STAGES
    : REPAIR_LIFECYCLE_STAGES;
}

export function isStageAllowedForKind(
  kind: LifecycleKind,
  stage: string | null,
): boolean {
  if (stage == null) return true;
  return (stagesForLifecycleKind(kind) as readonly string[]).includes(stage);
}

export function lifecycleStageLabel(
  kind: LifecycleKind,
  stage: string | null | undefined,
): string {
  if (!stage) return PROJECT_LIFECYCLE_NOT_SET_LABEL;
  if (kind === "custom_new_jewelry" && isCustomLifecycleStage(stage)) {
    return CUSTOM_LIFECYCLE_STAGE_LABELS[stage];
  }
  if (kind === "repair_service" && isRepairLifecycleStage(stage)) {
    return REPAIR_LIFECYCLE_STAGE_LABELS[stage];
  }
  return PROJECT_LIFECYCLE_NOT_SET_LABEL;
}

export type ParseLifecycleStageResult =
  | { ok: true; stage: ProjectLifecycleStage | null }
  | { ok: false; reason: "invalid-value" | "unsupported-project-kind" };

export function parseLifecycleStageInput(
  kind: unknown,
  value: unknown,
): ParseLifecycleStageResult {
  if (!isLifecycleKind(kind)) {
    return { ok: false, reason: "unsupported-project-kind" };
  }
  if (value == null) return { ok: true, stage: null };
  if (typeof value !== "string") {
    return { ok: false, reason: "invalid-value" };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, stage: null };
  if (!isStageAllowedForKind(kind, trimmed)) {
    return { ok: false, reason: "invalid-value" };
  }
  return { ok: true, stage: trimmed as ProjectLifecycleStage };
}

export function lifecycleTransitionLabel(
  kind: LifecycleKind,
  priorStage: string | null | undefined,
  newStage: string | null | undefined,
): string {
  return `${lifecycleStageLabel(kind, priorStage)} → ${lifecycleStageLabel(kind, newStage)}`;
}
