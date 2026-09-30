/**
 * Read-only ports available to provider-neutral agent contracts.
 * No writer is representable on this interface.
 */

import type { CurrentProjectOperatingGroup } from "@/lib/continuum/client-memory/open-projects/operating-groups";
import type {
  ProjectDeskGetResult,
  ProjectDeskSummary,
} from "@/lib/continuum/client-memory/project-desk/types";
import type {
  ClientSearchResult,
  ConciergePersonProfileResult,
} from "@/lib/continuum/client-memory/read/types";

export type AgentTodayItem = {
  title: string;
  detail: string;
  projectTitle: string | null;
  personName: string | null;
};

export type ContinuumAgentWorld = {
  searchPeople(query: string): Promise<ClientSearchResult[]>;
  getPersonProfile(personId: string): Promise<ConciergePersonProfileResult>;
  listProjects(): Promise<ProjectDeskSummary[]>;
  getProjectDesk(projectId: string): Promise<ProjectDeskGetResult>;
  groupCurrentProjects(nowIso: string): Promise<CurrentProjectOperatingGroup[]>;
  loadTodayItems(limit: number): Promise<AgentTodayItem[]>;
};
