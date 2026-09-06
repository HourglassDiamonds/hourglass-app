/**
 * Command Center Current Projects accordion read model.
 * Membership is exactly #13 `selectOpenProjectWork`. This file does not
 * invent a second active-Project rule, ownership, or Gmail requests.
 */

import type {
  ProjectDeskRead,
  ProjectDeskSummary,
  ProjectSpecField,
} from "../project-desk/types";
import type { ProjectDeskOpenJob } from "../project-jobs/types";
import type { ProjectDeskArtifact } from "../project-artifacts/types";
import { projectArtifactKindLabel } from "../project-artifacts/present";
import {
  isLifecycleKind,
  lifecycleStageLabel,
  type LifecycleKind,
} from "../project-lifecycle";
import { selectOpenProjectWork, type OpenProjectWorkItem } from "./select";
import {
  CURRENT_PROJECTS_ACTION_UNRECORDED,
  CURRENT_PROJECTS_CREATED_LABEL,
  CURRENT_PROJECTS_OWNERSHIP_CLIENT,
  CURRENT_PROJECTS_OWNERSHIP_SHOP,
  CURRENT_PROJECTS_OWNERSHIP_YOUR_TURN,
} from "./present";

export type CurrentProjectOwnershipLabel =
  | typeof CURRENT_PROJECTS_OWNERSHIP_YOUR_TURN
  | typeof CURRENT_PROJECTS_OWNERSHIP_CLIENT
  | typeof CURRENT_PROJECTS_OWNERSHIP_SHOP;

export type CurrentProjectLineKind =
  | "ownership"
  | "job"
  | "lifecycle"
  | "unrecorded";

export type CurrentProjectFile = {
  artifactId: string;
  kindLabel: string;
  title: string;
  href: string;
  mimeType: string;
  thumbnailSrc: string | null;
};

export type CurrentProjectProgressEntry = {
  label: string;
  at: string | null;
};

export type CurrentProjectCard = {
  projectId: string;
  title: string;
  href: string;
  collapsedLine: string;
  collapsedLineKind: CurrentProjectLineKind;
  currentAction: {
    label: string;
    detail: string | null;
    source: CurrentProjectLineKind;
  };
  snapshot: ProjectSpecField[];
  latestFile: CurrentProjectFile | null;
  files: CurrentProjectFile[];
  fileCount: number;
  progress: CurrentProjectProgressEntry[];
};

const THUMBNAIL_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const CAD_RENDER_KINDS = new Set(["cad", "render"]);

const LIFECYCLE_SCAN_LABELS: Record<string, string> = {
  design: "CAD / DESIGN",
  cad: "CAD / DESIGN",
  client_approval: "WAITING FOR CLIENT APPROVAL",
  production: "IN PRODUCTION",
  ready_for_delivery: "READY / DELIVERY",
  ready_for_return: "READY / DELIVERY",
};

function ownershipLabel(
  actor: ProjectDeskOpenJob["waitingOnActor"],
): CurrentProjectOwnershipLabel | null {
  if (actor === "founder" || actor === "hourglass") {
    return CURRENT_PROJECTS_OWNERSHIP_YOUR_TURN;
  }
  if (actor === "client") return CURRENT_PROJECTS_OWNERSHIP_CLIENT;
  if (actor === "vendor") return CURRENT_PROJECTS_OWNERSHIP_SHOP;
  return null;
}

function isQuietSnooze(job: ProjectDeskOpenJob): boolean {
  return job.state === "snoozed";
}

function dueMs(job: ProjectDeskOpenJob): number | null {
  if (!job.dueAt) return null;
  const parsed = Date.parse(job.dueAt);
  return Number.isFinite(parsed) ? parsed : null;
}

export function pickCurrentOpenJob(
  jobs: readonly ProjectDeskOpenJob[],
): ProjectDeskOpenJob | null {
  if (jobs.length === 0) return null;
  const active = jobs.filter((job) => !isQuietSnooze(job));
  const pool = active.length > 0 ? active : jobs;
  const dated = pool
    .map((job) => ({ job, due: dueMs(job) }))
    .filter((row): row is { job: ProjectDeskOpenJob; due: number } => row.due != null)
    .sort((a, b) => a.due - b.due);
  if (dated[0]) return dated[0].job;
  return pool[0] ?? null;
}

export function lifecycleScanLabel(input: {
  projectKind: string | null | undefined;
  stage: string | null | undefined;
  fallbackLabel: string | null | undefined;
}): string | null {
  if (!input.stage) return null;
  const mapped = LIFECYCLE_SCAN_LABELS[input.stage];
  if (mapped) return mapped;
  if (isLifecycleKind(input.projectKind)) {
    const label = lifecycleStageLabel(input.projectKind, input.stage);
    if (label && label !== "Not set") return label.toUpperCase();
  }
  const fallback = input.fallbackLabel?.trim();
  return fallback ? fallback.toUpperCase() : null;
}

function thumbnailSrc(file: ProjectDeskArtifact): string | null {
  if (!THUMBNAIL_MIME.has(file.mimeType)) return null;
  return file.href;
}

function toFile(row: ProjectDeskArtifact): CurrentProjectFile {
  return {
    artifactId: row.artifactId,
    kindLabel: projectArtifactKindLabel(row.kind),
    title: row.title,
    href: row.href,
    mimeType: row.mimeType,
    thumbnailSrc: thumbnailSrc(row),
  };
}

function pickLatestFile(
  items: readonly ProjectDeskArtifact[],
): ProjectDeskArtifact | null {
  if (items.length === 0) return null;
  const preferred = items.find((row) => CAD_RENDER_KINDS.has(row.kind));
  return preferred ?? items[0] ?? null;
}

function progressFromDesk(desk: ProjectDeskRead): CurrentProjectProgressEntry[] {
  const rows: CurrentProjectProgressEntry[] = [
    { label: CURRENT_PROJECTS_CREATED_LABEL, at: desk.recordCreatedAt },
  ];
  if (desk.lifecycle.kind === "none") return rows;
  const kind: LifecycleKind = desk.lifecycle.kind;
  const chronological = [...desk.lifecycle.history].sort((a, b) => {
    if (a.changedAt === b.changedAt) return a.eventId.localeCompare(b.eventId);
    return a.changedAt < b.changedAt ? -1 : 1;
  });
  for (const event of chronological) {
    if (!event.newStage) continue;
    rows.push({
      label: lifecycleStageLabel(kind, event.newStage),
      at: event.changedAt,
    });
  }
  return rows;
}

function collapsedFromJob(job: ProjectDeskOpenJob): {
  line: string;
  kind: CurrentProjectLineKind;
  actionLabel: string;
  actionDetail: string | null;
} {
  const ownership = ownershipLabel(job.waitingOnActor);
  const subject = job.subject.trim();
  if (ownership) {
    return {
      line: `${ownership} — ${subject}`,
      kind: "ownership",
      actionLabel: ownership,
      actionDetail: subject,
    };
  }
  return {
    line: subject,
    kind: "job",
    actionLabel: subject,
    actionDetail: null,
  };
}

export function composeCurrentProjectCard(
  work: OpenProjectWorkItem,
  desk: ProjectDeskRead,
): CurrentProjectCard {
  const unresolved =
    desk.openJobs.connected && desk.openJobs.unresolvedCount > 0
      ? desk.openJobs.unresolved
      : [];
  const currentJob = pickCurrentOpenJob(unresolved);
  const lifecycleLine = lifecycleScanLabel({
    projectKind: desk.projectKind,
    stage: desk.lifecycle.kind === "none" ? work.lifecycleStage : desk.lifecycle.stage,
    fallbackLabel: work.lifecycleLabel,
  });

  let collapsedLine = CURRENT_PROJECTS_ACTION_UNRECORDED;
  let collapsedLineKind: CurrentProjectLineKind = "unrecorded";
  let actionLabel = CURRENT_PROJECTS_ACTION_UNRECORDED;
  let actionDetail: string | null = lifecycleLine;

  if (currentJob) {
    const fromJob = collapsedFromJob(currentJob);
    collapsedLine = fromJob.line;
    collapsedLineKind = fromJob.kind;
    actionLabel = fromJob.actionLabel;
    actionDetail = fromJob.actionDetail;
  } else if (lifecycleLine) {
    collapsedLine = lifecycleLine;
    collapsedLineKind = "lifecycle";
    actionLabel = lifecycleLine;
    actionDetail = null;
  }

  const artifactItems = desk.artifacts.connected ? desk.artifacts.items : [];
  const files = artifactItems.map(toFile);
  const latest = pickLatestFile(artifactItems);

  return {
    projectId: work.projectId,
    title: work.title,
    href: work.href,
    collapsedLine,
    collapsedLineKind,
    currentAction: {
      label: actionLabel,
      detail: actionDetail,
      source: collapsedLineKind,
    },
    snapshot: desk.specs,
    latestFile: latest ? toFile(latest) : null,
    files,
    fileCount: files.length,
    progress: progressFromDesk(desk),
  };
}

export function composeCurrentProjectCards(
  summaries: readonly ProjectDeskSummary[],
  desks: ReadonlyMap<string, ProjectDeskRead>,
): CurrentProjectCard[] {
  return selectOpenProjectWork(summaries).flatMap((work) => {
    const desk = desks.get(work.projectId);
    if (!desk || desk.projectId !== work.projectId) return [];
    return [composeCurrentProjectCard(work, desk)];
  });
}
