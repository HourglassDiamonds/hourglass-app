/**
 * Founder-controlled Current Projects → Open Job hydration.
 * Explicit next action only. Lifecycle / waiting-state is never a task.
 * Does not write. Callers use createProjectJob after founder confirmation.
 */

import {
  CURRENT_PROJECTS_ACTION_UNRECORDED,
  CURRENT_PROJECTS_OWNERSHIP_CLIENT,
  CURRENT_PROJECTS_OWNERSHIP_SHOP,
  CURRENT_PROJECTS_OWNERSHIP_YOUR_TURN,
} from "./present";
import type { CurrentProjectCard } from "./card";

export const LIFECYCLE_BUSYWORK_LABELS = [
  "WAITING FOR CLIENT APPROVAL",
  "IN PRODUCTION",
  "CAD / DESIGN",
  "READY / DELIVERY",
  CURRENT_PROJECTS_ACTION_UNRECORDED,
  CURRENT_PROJECTS_OWNERSHIP_YOUR_TURN,
  CURRENT_PROJECTS_OWNERSHIP_CLIENT,
  CURRENT_PROJECTS_OWNERSHIP_SHOP,
] as const;

function normalizeLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

const BUSYWORK_KEYS = new Set(
  LIFECYCLE_BUSYWORK_LABELS.map((label) => normalizeLabel(label)),
);

export function isLifecycleBusyworkLabel(value: string): boolean {
  const key = normalizeLabel(value);
  if (!key) return false;
  if (BUSYWORK_KEYS.has(key)) return true;
  return (
    key.startsWith("waiting for ") ||
    key === "in production" ||
    key === "cad / design"
  );
}

export type ExplicitCurrentAction = {
  projectId: string;
  subject: string;
  source: "job" | "ownership";
};

export function explicitActionFromCurrentProject(
  card: CurrentProjectCard,
): ExplicitCurrentAction | null {
  if (card.currentAction.source !== "job" && card.currentAction.source !== "ownership") {
    return null;
  }
  const subject = (card.currentAction.detail ?? card.currentAction.label).trim();
  if (!subject || isLifecycleBusyworkLabel(subject)) return null;
  if (isLifecycleBusyworkLabel(card.currentAction.label) && !card.currentAction.detail) {
    return null;
  }
  return {
    projectId: card.projectId,
    subject,
    source: card.currentAction.source,
  };
}

export function canPromoteCurrentAction(card: CurrentProjectCard): boolean {
  return explicitActionFromCurrentProject(card) != null;
}

export function lifecycleDoesNotCreateOpenJob(card: CurrentProjectCard): boolean {
  return (
    card.currentAction.source === "lifecycle" ||
    card.currentAction.source === "unrecorded"
  );
}
