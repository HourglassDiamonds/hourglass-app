/**
 * One-project Achedekal acceptance harness constants.
 * Historical / closed. Exact stored Gmail pointer only.
 * Does not select other projects.
 */

export const ACHEDEKAL_PROJECT_ID =
  "df78419e-a81a-4522-9114-6cdf4a24388a" as const;

export const ACHEDEKAL_DISPLAY_NAME = "A. Achedekal";

export const ACHEDEKAL_LIFECYCLE_LABEL = "Historical / closed";

export const ACHEDEKAL_REVIEW_PATH =
  "/executive-dashboard/concierge/project-reconstruction/achedekal" as const;

export const ACHEDEKAL_REVIEW_WARNING =
  "Evidence review only — no changes will be applied.";

export function isPermittedAchedekalProjectId(projectId: string): boolean {
  return projectId.trim() === ACHEDEKAL_PROJECT_ID;
}
