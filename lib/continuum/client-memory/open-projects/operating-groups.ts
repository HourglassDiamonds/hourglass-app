/**
 * Founder operating-board grouping for Current Projects.
 * Derives groups from canonical lifecycle + founder-owned Open Jobs.
 * Does not mutate Project lifecycle, membership, or Top 5 ranking.
 */

import {
  civilDateInZone,
  compareDateOnly,
  daysUntilDue,
  parseDateOnly,
  type DateOnly,
} from "@/lib/continuum/date-only";
import type { ProjectDeskOpenJob } from "../project-jobs/types";
import type { CurrentProjectCard } from "./card";
import {
  CURRENT_PROJECTS_OWNERSHIP_YOUR_TURN,
  currentProjectGroupPanelId,
  currentProjectGroupToggleId,
} from "./present";

export const CURRENT_PROJECT_OPERATING_GROUP_IDS = [
  "your_turn",
  "cad_design",
  "waiting_for_client",
  "waiting_on_shop",
  "ready_delivery",
  "in_production",
  "other_active",
] as const;

export type CurrentProjectOperatingGroupId =
  (typeof CURRENT_PROJECT_OPERATING_GROUP_IDS)[number];

export const CURRENT_PROJECT_OPERATING_GROUP_LABELS: Record<
  CurrentProjectOperatingGroupId,
  string
> = {
  your_turn: CURRENT_PROJECTS_OWNERSHIP_YOUR_TURN,
  cad_design: "CAD / DESIGN",
  waiting_for_client: "WAITING FOR CLIENT",
  waiting_on_shop: "WAITING ON SHOP / VENDOR",
  ready_delivery: "READY / DELIVERY",
  in_production: "IN PRODUCTION",
  other_active: "OTHER ACTIVE",
};

export type CurrentProjectOperatingViewport = "mobile" | "desktop";

export const CURRENT_PROJECTS_SHORT_LIST_LIMIT = 10;
export const CURRENT_PROJECTS_DUE_SOON_DAYS = 7;

const HIGH_ATTENTION_GROUPS = new Set<CurrentProjectOperatingGroupId>([
  "your_turn",
  "cad_design",
  "waiting_for_client",
  "waiting_on_shop",
  "ready_delivery",
]);

/**
 * Canonical Custom / Repair stages plus known aliases that may appear as
 * stored stage strings. Unknown active values map to OTHER ACTIVE.
 */
export const LIFECYCLE_STAGE_TO_OPERATING_GROUP = {
  design: "cad_design",
  cad: "cad_design",
  design_review: "cad_design",
  client_approval: "waiting_for_client",
  waiting_on_client: "waiting_for_client",
  awaiting_client_decision: "waiting_for_client",
  waiting_on_shop: "waiting_on_shop",
  waiting_on_vendor: "waiting_on_shop",
  external_dependency: "waiting_on_shop",
  ready: "ready_delivery",
  ready_for_pickup: "ready_delivery",
  ready_for_delivery: "ready_delivery",
  ready_for_return: "ready_delivery",
  delivery: "ready_delivery",
  production: "in_production",
  in_production: "in_production",
  manufacturing: "in_production",
  bench: "in_production",
} as const satisfies Record<string, CurrentProjectOperatingGroupId>;

export type CurrentProjectOperatingGroup = {
  id: CurrentProjectOperatingGroupId;
  label: string;
  count: number;
  defaultOpen: boolean;
  toggleId: string;
  panelId: string;
  heading: string;
  projects: CurrentProjectCard[];
};

function isFounderOwnedActor(actor: ProjectDeskOpenJob["waitingOnActor"]): boolean {
  return actor === "founder" || actor === "hourglass";
}

export function isFounderOwnedOpenJob(job: ProjectDeskOpenJob): boolean {
  return isFounderOwnedActor(job.waitingOnActor);
}

export function founderOwnedOpenJobPool(
  jobs: readonly ProjectDeskOpenJob[],
): ProjectDeskOpenJob[] {
  const founderOwned = jobs.filter(isFounderOwnedOpenJob);
  if (founderOwned.length === 0) return [];
  const active = founderOwned.filter((job) => job.state !== "snoozed");
  return active.length > 0 ? active : founderOwned;
}

export function hasFounderOwnedOpenJob(
  jobs: readonly ProjectDeskOpenJob[],
): boolean {
  return founderOwnedOpenJobPool(jobs).length > 0;
}

export function founderActionDueAt(
  jobs: readonly ProjectDeskOpenJob[],
): DateOnly | null {
  const dated = founderOwnedOpenJobPool(jobs)
    .map((job) => parseDateOnly(job.dueAt))
    .filter((due): due is DateOnly => due != null)
    .sort(compareDateOnly);
  return dated[0] ?? null;
}

export function mapLifecycleStageToOperatingGroup(
  stage: string | null | undefined,
): CurrentProjectOperatingGroupId {
  const trimmed = stage?.trim() ?? "";
  if (!trimmed) return "other_active";
  return LIFECYCLE_STAGE_TO_OPERATING_GROUP[
    trimmed as keyof typeof LIFECYCLE_STAGE_TO_OPERATING_GROUP
  ] ?? "other_active";
}

export function operatingGroupForProject(input: {
  lifecycleStage: string | null | undefined;
  founderOwnedUnresolved: boolean;
}): CurrentProjectOperatingGroupId {
  if (input.founderOwnedUnresolved) return "your_turn";
  return mapLifecycleStageToOperatingGroup(input.lifecycleStage);
}

export function operatingGroupHeading(label: string, count: number): string {
  return `${label} · ${count}`;
}

export function operatingGroupDefaultOpen(input: {
  id: CurrentProjectOperatingGroupId;
  viewport: CurrentProjectOperatingViewport;
  totalCount: number;
}): boolean {
  if (HIGH_ATTENTION_GROUPS.has(input.id)) return true;
  if (input.viewport === "mobile") return false;
  if (input.id === "in_production") {
    return input.totalCount <= CURRENT_PROJECTS_SHORT_LIST_LIMIT;
  }
  return true;
}

function compareIsoAsc(left: string | null | undefined, right: string | null | undefined): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function compareTitleThenId(left: CurrentProjectCard, right: CurrentProjectCard): number {
  const title = left.title.localeCompare(right.title, "en", { sensitivity: "base" });
  if (title !== 0) return title;
  return left.projectId.localeCompare(right.projectId);
}

function dueBucket(due: DateOnly | null, today: DateOnly): number {
  if (!due) return 4;
  const until = daysUntilDue(due, today);
  if (!Number.isFinite(until)) return 4;
  if (until < 0) return 0;
  if (until === 0) return 1;
  if (until <= CURRENT_PROJECTS_DUE_SOON_DAYS) return 2;
  return 3;
}

function sortYourTurn(
  left: CurrentProjectCard,
  right: CurrentProjectCard,
  today: DateOnly,
): number {
  const leftDue = parseDateOnly(left.actionDueAt);
  const rightDue = parseDateOnly(right.actionDueAt);
  const bucket = dueBucket(leftDue, today) - dueBucket(rightDue, today);
  if (bucket !== 0) return bucket;
  if (leftDue && rightDue) {
    const due = compareDateOnly(leftDue, rightDue);
    if (due !== 0) return due;
  }
  return compareTitleThenId(left, right);
}

function sortWaiting(
  left: CurrentProjectCard,
  right: CurrentProjectCard,
): number {
  const leftDue = parseDateOnly(left.actionDueAt);
  const rightDue = parseDateOnly(right.actionDueAt);
  const duePresence = (leftDue ? 0 : 1) - (rightDue ? 0 : 1);
  if (duePresence !== 0) return duePresence;
  if (leftDue && rightDue) {
    const due = compareDateOnly(leftDue, rightDue);
    if (due !== 0) return due;
  }
  const waiting = compareIsoAsc(left.waitingSince, right.waitingSince);
  if (waiting !== 0) return waiting;
  return compareTitleThenId(left, right);
}

function sortCadDesign(
  left: CurrentProjectCard,
  right: CurrentProjectCard,
): number {
  const leftJob = left.currentJobId ? 0 : 1;
  const rightJob = right.currentJobId ? 0 : 1;
  if (leftJob !== rightJob) return leftJob - rightJob;
  const aging = compareIsoAsc(
    left.updatedAt ?? left.waitingSince,
    right.updatedAt ?? right.waitingSince,
  );
  if (aging !== 0) return aging;
  return compareTitleThenId(left, right);
}

function sortOldestState(
  left: CurrentProjectCard,
  right: CurrentProjectCard,
): number {
  const waiting = compareIsoAsc(left.waitingSince, right.waitingSince);
  if (waiting !== 0) return waiting;
  return compareTitleThenId(left, right);
}

function sortGroup(
  id: CurrentProjectOperatingGroupId,
  left: CurrentProjectCard,
  right: CurrentProjectCard,
  today: DateOnly,
): number {
  if (id === "your_turn") return sortYourTurn(left, right, today);
  if (id === "waiting_for_client" || id === "waiting_on_shop") {
    return sortWaiting(left, right);
  }
  if (id === "cad_design") return sortCadDesign(left, right);
  if (id === "ready_delivery" || id === "in_production") {
    return sortOldestState(left, right);
  }
  return compareTitleThenId(left, right);
}

export function groupCurrentProjects(
  cards: readonly CurrentProjectCard[],
  input: {
    nowIso: string;
    viewport?: CurrentProjectOperatingViewport;
  },
): CurrentProjectOperatingGroup[] {
  const viewport = input.viewport ?? "mobile";
  const today =
    civilDateInZone(input.nowIso) ?? parseDateOnly(input.nowIso) ?? "1970-01-01";
  const buckets = new Map<CurrentProjectOperatingGroupId, CurrentProjectCard[]>();
  for (const card of cards) {
    const id = operatingGroupForProject({
      lifecycleStage: card.lifecycleStage,
      founderOwnedUnresolved: card.founderOwnedUnresolved,
    });
    const list = buckets.get(id) ?? [];
    list.push(card);
    buckets.set(id, list);
  }

  const groups: CurrentProjectOperatingGroup[] = [];
  for (const id of CURRENT_PROJECT_OPERATING_GROUP_IDS) {
    const projects = [...(buckets.get(id) ?? [])].sort((left, right) =>
      sortGroup(id, left, right, today),
    );
    if (projects.length === 0) continue;
    const label = CURRENT_PROJECT_OPERATING_GROUP_LABELS[id];
    groups.push({
      id,
      label,
      count: projects.length,
      defaultOpen: operatingGroupDefaultOpen({
        id,
        viewport,
        totalCount: cards.length,
      }),
      toggleId: currentProjectGroupToggleId(id),
      panelId: currentProjectGroupPanelId(id),
      heading: operatingGroupHeading(label, projects.length),
      projects,
    });
  }
  return groups;
}

export function allGroupedProjectIds(
  groups: readonly CurrentProjectOperatingGroup[],
): string[] {
  return groups.flatMap((group) => group.projects.map((row) => row.projectId));
}
