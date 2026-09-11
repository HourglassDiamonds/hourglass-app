/**
 * Founder-facing copy for the CoS operating loop.
 * No scores, percentages, or hidden chain-of-thought.
 */

import { CONTINUUM_FOUNDER_TIME_ZONE } from "@/lib/continuum/dashboard/compose";
import { formatDueTiming } from "@/lib/continuum/date-only";
import {
  CURRENT_PROJECTS_OWNERSHIP_CLIENT,
  CURRENT_PROJECTS_OWNERSHIP_SHOP,
  CURRENT_PROJECTS_OWNERSHIP_YOUR_TURN,
  currentProjectFocusHref,
} from "@/lib/continuum/client-memory/open-projects/present";
import {
  conciergeEditActionPath,
  conciergeOpenJobPath,
} from "@/lib/continuum/client-memory/read/presentation";
import type { OpenJobActor } from "@/lib/continuum/client-memory/project-jobs/types";
import { completionWriterFor } from "./complete";
import type { CosTop5Item, RankedActionable } from "./types";

const WHY_ORDER = [
  "overdue",
  "blocked",
  "founder_action",
  "client_owed",
  "founder_commitment",
  "hourglass_action",
  "due_soon",
  "aging",
  "active_project",
  "vendor_waiting",
  "client_waiting",
] as const;

export const COS_CAUGHT_UP_HEADING = "You're caught up.";
export const COS_CAUGHT_UP_DETAIL =
  "When new work is recorded, the next actions will appear here.";
export const COS_DISCONNECTED_HEADING = "Open Jobs are not connected yet.";
export const COS_DISCONNECTED_DETAIL =
  "Current Projects can still open. Today's queue waits on canonical Open Jobs.";
export const COS_ACTIVE_HEADING = "Today";
export const COS_ANOMALY_TITLE = "Something seems off";
export const COS_RECAP_TITLE = "End of day";
/** Internal ranking label. Not founder-facing on Today. */
export const COS_TOP5_TITLE = "Top 5";
export const COS_DECISION_TITLE = "Needs your decision";
export const COS_WORTH_KNOWING_TITLE = "Worth knowing";
/** Internal moderator label. Not founder-facing on Today. */
export const COS_BRIEF_TITLE = "Concierge Brief";
export const COS_WATCHING_TITLE = "Already handled / Watching";
export const COS_FALLBACK_ATTENTION_TITLE = "Earlier attention view";

export function ownershipLabel(actor: OpenJobActor): string {
  if (actor === "founder") return CURRENT_PROJECTS_OWNERSHIP_YOUR_TURN;
  if (actor === "client") return CURRENT_PROJECTS_OWNERSHIP_CLIENT;
  if (actor === "vendor") return CURRENT_PROJECTS_OWNERSHIP_SHOP;
  if (actor === "hourglass") return "Hourglass";
  return "Unassigned";
}

export function formatDueDay(iso: string, nowIso: string): string {
  return formatDueTiming(iso, nowIso, CONTINUUM_FOUNDER_TIME_ZONE);
}

export function timingLabel(dueAt: string | null, nowIso: string): string {
  if (!dueAt) return "No due date";
  return formatDueDay(dueAt, nowIso);
}

export function whyLabel(item: RankedActionable): string {
  const byId = new Map(item.factors.map((row) => [row.id, row.label]));
  const phrases: string[] = [];
  for (const id of WHY_ORDER) {
    const label = byId.get(id);
    if (label) phrases.push(label);
    if (phrases.length >= 2) break;
  }
  if (phrases.length === 0) return "Recorded Open Job";
  return phrases.join(" · ");
}

export function presentTop5Item(
  item: RankedActionable,
  nowIso: string,
  mutationId: string,
): CosTop5Item {
  const writer = completionWriterFor(item.sourceType);
  return {
    id: item.id,
    sourceType: item.sourceType,
    action: item.action,
    clientLabel: item.personName,
    projectTitle: item.projectTitle,
    projectId: item.projectId,
    ownership: ownershipLabel(item.waitingOnActor),
    timing: timingLabel(item.dueAt, nowIso),
    why: whyLabel(item),
    accordionHref: currentProjectFocusHref(item.projectId),
    jobHref: conciergeOpenJobPath(item.projectId, item.id),
    editHref: conciergeEditActionPath(item.projectId, item.id),
    completable: writer != null,
    writer,
    mutationId,
  };
}
