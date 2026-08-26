/**
 * Project Desk reader port and in-memory adapter.
 * Separate from ClientMemoryReader. Slice A is read-only.
 */

import {
  getProjectDeskFromSnapshot,
  listProjectsFromSnapshot,
} from "./compose";
import type {
  ListProjectsFilter,
  ProjectDeskGetResult,
  ProjectDeskSnapshot,
  ProjectDeskSummary,
} from "./types";

export type ProjectDeskReader = {
  listProjects(filter?: ListProjectsFilter): Promise<ProjectDeskSummary[]>;
  getProjectDesk(projectId: string): Promise<ProjectDeskGetResult>;
};

export const PROJECT_DESK_READER_METHODS = [
  "listProjects",
  "getProjectDesk",
] as const satisfies readonly (keyof ProjectDeskReader)[];

export class InMemoryProjectDeskReader implements ProjectDeskReader {
  constructor(private readonly snapshot: ProjectDeskSnapshot) {}

  async listProjects(filter?: ListProjectsFilter): Promise<ProjectDeskSummary[]> {
    return listProjectsFromSnapshot(this.snapshot, filter);
  }

  async getProjectDesk(projectId: string): Promise<ProjectDeskGetResult> {
    return getProjectDeskFromSnapshot(this.snapshot, projectId);
  }
}

export function createInMemoryProjectDeskReader(
  snapshot: ProjectDeskSnapshot,
): ProjectDeskReader {
  return new InMemoryProjectDeskReader(snapshot);
}
