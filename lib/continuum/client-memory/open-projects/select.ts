/**
 * Command Center Project work selection.
 * Derives from Project Desk + Open Jobs. Not CoS ranking. Not Agent OS.
 *
 * A Project qualifies when:
 * - jobs are connected and at least one unresolved Open Job exists
 *   (including snoozed-only work), or
 * - Custom / Repair Kind has an explicit current lifecycle stage that is
 *   not complete.
 * A Project row, Kind, or completed lifecycle alone is not current work.
 */

import type { ProjectKind } from "../project-kind";
import type { ProjectDeskSummary } from "../project-desk/types";
import { isLifecycleKind, isStageAllowedForKind } from "../project-lifecycle";
import { conciergeProjectPath } from "../read/presentation";
import type { ProjectWorkSummary } from "../project-jobs/intelligence";
import type { ProjectDeskPerson } from "../project-desk/types";

export type OpenProjectWorkItem = {
  projectId: string;
  title: string;
  people: ProjectDeskPerson[];
  lifecycleStage: string | null;
  lifecycleLabel: string | null;
  projectWork: ProjectWorkSummary;
  href: string;
};

export function isExplicitActiveLifecycle(input: {
  projectKind: ProjectKind | null;
  lifecycleStage: string | null;
}): boolean {
  if (!isLifecycleKind(input.projectKind)) return false;
  if (!input.lifecycleStage) return false;
  if (input.lifecycleStage === "completed") return false;
  return isStageAllowedForKind(input.projectKind, input.lifecycleStage);
}

export function selectOpenProjectWork(
  summaries: readonly ProjectDeskSummary[],
): OpenProjectWorkItem[] {
  return summaries
    .filter((row) => {
      const unresolved =
        row.projectWork.connected && row.projectWork.unresolvedCount > 0;
      const lifecycle = isExplicitActiveLifecycle({
        projectKind: row.projectKind,
        lifecycleStage: row.lifecycleStage,
      });
      return unresolved || lifecycle;
    })
    .map((row) => ({
      projectId: row.projectId,
      title: row.title,
      people: row.people,
      lifecycleStage: row.lifecycleStage,
      lifecycleLabel: row.lifecycleLabel,
      projectWork: row.projectWork,
      href: conciergeProjectPath(row.projectId),
    }))
    .sort((a, b) =>
      a.title.localeCompare(b.title, "en", { sensitivity: "base" }),
    );
}
