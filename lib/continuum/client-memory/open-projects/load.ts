/**
 * Server-only Command Center Current Projects loader.
 * Uses the founder Project Desk reader and the #13 selector.
 * Does not activate CoS. Does not write Open Jobs, Kind, or Lifecycle.
 */

import { getAuthenticatedProjectDeskReader } from "../project-desk/load";
import { selectOpenProjectWork } from "./select";
import type { OpenProjectWorkItem } from "./select";
import { composeCurrentProjectCards } from "./card";
import type { CurrentProjectCard } from "./card";
import type { ProjectDeskRead } from "../project-desk/types";

export async function loadOpenProjectWork(): Promise<OpenProjectWorkItem[]> {
  const auth = await getAuthenticatedProjectDeskReader();
  if (!auth.ok) return [];
  try {
    const summaries = await auth.reader.listProjects();
    return selectOpenProjectWork(summaries);
  } catch {
    return [];
  }
}

export async function loadCurrentProjectCards(): Promise<CurrentProjectCard[]> {
  const auth = await getAuthenticatedProjectDeskReader();
  if (!auth.ok) return [];
  try {
    const summaries = await auth.reader.listProjects();
    const selected = selectOpenProjectWork(summaries);
    const desks = new Map<string, ProjectDeskRead>();
    const loaded = await Promise.all(
      selected.map(async (item) => {
        const result = await auth.reader.getProjectDesk(item.projectId);
        return result.ok ? result.desk : null;
      }),
    );
    for (const desk of loaded) {
      if (desk) desks.set(desk.projectId, desk);
    }
    return composeCurrentProjectCards(summaries, desks);
  } catch {
    return [];
  }
}
