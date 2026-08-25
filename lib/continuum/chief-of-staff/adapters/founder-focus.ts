/**
 * Transitional Founder Focus adapter.
 * CURRENT_OPERATING_BACKLOG remains the source. Do not migrate it here.
 */

import {
  isBackgroundItem,
  isFounderNowItem,
  isNonTerminalBacklogStatus,
  isWatchItem,
  resolveSurfacePolicy,
} from "@/lib/agent-os/operating-backlog/surface-policy";
import type {
  OperatingBacklog,
  OperatingBacklogItem,
} from "@/lib/agent-os/operating-backlog";
import { REASON } from "../constants";
import type { SpecialistObservation } from "../types";

function isPausedItem(item: OperatingBacklogItem): boolean {
  const blob = `${item.title}\n${item.watchLine ?? ""}\n${item.action}`.toLowerCase();
  return /\bpaused\b/.test(blob);
}

export function founderFocusEligible(item: OperatingBacklogItem): boolean {
  if (!isNonTerminalBacklogStatus(item.status)) return false;
  if (item.status === "completed") return false;
  if (isPausedItem(item)) return false;
  if (isWatchItem(item) || resolveSurfacePolicy(item) === "watch") return false;
  if (isBackgroundItem(item)) return false;
  return isFounderNowItem(item);
}

export function observationsFromOperatingBacklog(
  backlog: OperatingBacklog,
  observedAt: string,
): SpecialistObservation[] {
  const items = [
    ...backlog.masterSprint.items,
    ...backlog.deferred,
    ...backlog.recurring,
  ];
  const eligible = items
    .filter(founderFocusEligible)
    .sort((a, b) => a.rank - b.rank);

  return eligible.map((item) => ({
    specialist: "founder-focus" as const,
    kind: "founder-focus-now",
    subject: { focusId: item.id },
    summary: item.title,
    whyItMatters: item.why,
    recommendedAction: item.action,
    epistemicClass: "observed" as const,
    importanceHint: item.urgency === "low" ? "low" : "high",
    urgencyHint: item.urgency === "critical" ? "now" : "today",
    audienceHint: "founder-action" as const,
    confidence: "high" as const,
    evidenceIds: [],
    observationIds: [],
    observedAt,
    dedupeKey: `founder-focus:${item.id}`,
    changeClass: "novel" as const,
  }));
}

export function watchSuppressionReason(
  item: OperatingBacklogItem,
): string | null {
  if (!isNonTerminalBacklogStatus(item.status)) return REASON.completedSuppressed;
  if (isPausedItem(item)) return REASON.pausedSuppressed;
  if (isWatchItem(item)) return REASON.watchSuppressed;
  if (isBackgroundItem(item)) return REASON.backgroundSuppressed;
  return null;
}
