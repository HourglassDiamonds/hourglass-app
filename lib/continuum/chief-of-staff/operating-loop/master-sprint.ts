/**
 * Master Sprint → Today unused-capacity adapter.
 * Presentation only. Does not invent sprint work or write backlog status.
 */

import { founderFocusEligible } from "@/lib/continuum/chief-of-staff/adapters/founder-focus";
import type { OperatingBacklog } from "@/lib/agent-os/operating-backlog";
import type { CosMasterSprintItem } from "./types";

export const COS_SPRINT_CLEAR_COPY =
  "Client work is clear. Continuing with the sprint." as const;

export function selectMasterSprintCapacityItems(
  backlog: OperatingBacklog,
): CosMasterSprintItem[] {
  return [...backlog.masterSprint.items]
    .filter(founderFocusEligible)
    .sort((a, b) => a.rank - b.rank)
    .map((item) => ({
      id: item.id,
      title: item.title,
      action: item.action,
      why: item.why,
    }));
}
