import { CONCIERGE_PROJECTS_PATH } from "@/lib/continuum/client-memory/read/presentation";

export const OPEN_PROJECT_WORK_TITLE = "Current Projects";
export const OPEN_PROJECT_WORK_NONE_LABEL = "No current projects.";
export const OPEN_PROJECT_NEXT_DUE_LABEL = "Next due";
export const CURRENT_PROJECTS_ACTION_UNRECORDED = "Current action not recorded";
export const CURRENT_PROJECTS_OPEN_LABEL = "Open Project";
export const CURRENT_PROJECTS_ACTION_TITLE = "Current action";
export const CURRENT_PROJECTS_SNAPSHOT_TITLE = "Snapshot";
export const CURRENT_PROJECTS_LATEST_FILE_TITLE = "Latest file";
export const CURRENT_PROJECTS_FILES_TITLE = "Files";
export const CURRENT_PROJECTS_PROGRESS_TITLE = "Progress";
export const CURRENT_PROJECTS_CREATED_LABEL = "Project created";
export const CURRENT_PROJECTS_LATEST_REQUEST_TITLE = "Latest request / change";
export const CURRENT_PROJECTS_LATEST_REQUEST_EMPTY = "Not recorded yet";
export const CURRENT_PROJECTS_OWNERSHIP_YOUR_TURN = "YOUR TURN";
export const CURRENT_PROJECTS_OWNERSHIP_CLIENT = "WAITING ON CLIENT";
export const CURRENT_PROJECTS_OWNERSHIP_SHOP = "WAITING ON SHOP";
export const CURRENT_PROJECTS_CREATE_ACTION_LABEL = "Create action";
export const CURRENT_PROJECTS_EDIT_ACTION_LABEL = "Edit action";
export const CURRENT_PROJECTS_ADD_ACTION_LABEL = "Add action";

export function currentProjectToggleId(projectId: string): string {
  return `current-project-${projectId}-toggle`;
}

export const CURRENT_PROJECT_FOCUS_QUERY = "project";

export function currentProjectFocusHref(projectId: string): string {
  const id = projectId.trim();
  return `${CONCIERGE_PROJECTS_PATH}?${CURRENT_PROJECT_FOCUS_QUERY}=${encodeURIComponent(id)}#${currentProjectToggleId(id)}`;
}

export function currentProjectPanelId(projectId: string): string {
  return `current-project-${projectId}-panel`;
}

export function currentProjectGroupToggleId(groupId: string): string {
  return `current-projects-group-${groupId}-toggle`;
}

export function currentProjectGroupPanelId(groupId: string): string {
  return `current-projects-group-${groupId}-panel`;
}
