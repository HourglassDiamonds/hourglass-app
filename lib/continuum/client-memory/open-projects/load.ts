/**
 * Server-only Command Center Project work loader.
 * Uses the founder Project Desk reader. Does not activate CoS.
 */

import { getAuthenticatedProjectDeskReader } from "../project-desk/load";
import { selectOpenProjectWork } from "./select";
import type { OpenProjectWorkItem } from "./select";

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
