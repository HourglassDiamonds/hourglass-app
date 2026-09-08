/**
 * Person → Project choices for Create Action.
 * Current membership uses the existing Current Projects selector.
 */

import { selectOpenProjectWork } from "../open-projects/select";
import type { ProjectDeskSummary } from "../project-desk/types";
import type { ProjectKind } from "../project-kind";

export type PersonActionProject = {
  projectId: string;
  title: string;
  current: boolean;
  projectKind: ProjectKind | null;
  lifecycleLabel: string | null;
};

export function personProjectsForAction(
  summaries: readonly ProjectDeskSummary[],
  personId: string,
): PersonActionProject[] {
  const currentIds = new Set(
    selectOpenProjectWork(summaries).map((row) => row.projectId),
  );
  return summaries
    .filter((row) => row.people.some((person) => person.personId === personId))
    .map((row) => ({
      projectId: row.projectId,
      title: row.title,
      current: currentIds.has(row.projectId),
      projectKind: row.projectKind,
      lifecycleLabel: row.lifecycleLabel,
    }))
    .sort((a, b) => {
      if (a.current !== b.current) return a.current ? -1 : 1;
      return a.title.localeCompare(b.title, "en", { sensitivity: "base" });
    });
}
