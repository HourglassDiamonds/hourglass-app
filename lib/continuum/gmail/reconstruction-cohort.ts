/**
 * Founder-only Cohort 1 adapter. Temporary bounded review set.
 * Does not hardcode these IDs into the reconstruction engine.
 * Does not write Persons, specs, artifacts, lifecycle, Open Jobs, or CoS.
 * Alea / Achedekal remains a separate regression harness and is not a
 * Cohort 1 member.
 */

import { ACHEDEKAL_PROJECT_ID } from "./achedekal-acceptance";

export const RECONSTRUCTION_COHORT_1_ID = "cohort-1" as const;

export const RECONSTRUCTION_COHORT_1_PATH =
  "/executive-dashboard/concierge/project-reconstruction/cohort-1" as const;

export const RECONSTRUCTION_COHORT_1_HEADING =
  "Project Reconstruction — Cohort 1" as const;

export const RECONSTRUCTION_COHORT_1_WARNING =
  "Evidence review only — no changes will be applied.";

export const RECONSTRUCTION_COHORT_1_LIFECYCLE_LABEL =
  "Review only — commercial state unknown" as const;

/**
 * Production Project Book IDs selected from stored evidence inventory.
 * Order is founder-facing Project A–E. Not a reconstruction-engine constant.
 */
export const RECONSTRUCTION_COHORT_1_PROJECT_IDS = [
  "449b8c0d-9c17-4beb-aa28-0b6db798f39d",
  "30fc771f-87d1-4fe2-b05f-dcf8c9afa22c",
  "932805a8-025c-4dec-b542-23be8132fef7",
  "7bbd15bb-9c5a-4e4c-b8a6-3dc0cb407035",
  "9dc4fb4e-2444-46f9-803a-2bd8058c5457",
] as const;

export type ReconstructionCohort1ProjectId =
  (typeof RECONSTRUCTION_COHORT_1_PROJECT_IDS)[number];

export const RECONSTRUCTION_COHORT_1_LABELS = [
  "Project A",
  "Project B",
  "Project C",
  "Project D",
  "Project E",
] as const;

export const COHORT_DISCOVERY_HYDRATE_CAP = 80 as const;
export const COHORT_IDENTIFIER_TOKEN_LIMIT = 24 as const;

export const COHORT_MUTATION_BOUNDARY = {
  updatesPersons: false,
  updatesProjectSpecs: false,
  createsSpecRevisions: false,
  changesLifecycle: false,
  createsOpenJobs: false,
  writesHumanIntake: false,
  writesChiefOfStaff: false,
  createsToday5: false,
  fetchesAttachmentBytes: false,
  automaticApply: false,
  proposedCanonicalWrites: [] as const,
} as const;

const COHORT_ID_SET = new Set<string>(RECONSTRUCTION_COHORT_1_PROJECT_IDS);

export function isPermittedCohort1ProjectId(projectId: string): boolean {
  return COHORT_ID_SET.has(projectId.trim());
}

export function isAleaRegressionProjectId(projectId: string): boolean {
  return projectId.trim() === ACHEDEKAL_PROJECT_ID;
}

export function cohort1LabelFor(projectId: string): string | null {
  const index = RECONSTRUCTION_COHORT_1_PROJECT_IDS.indexOf(
    projectId.trim() as ReconstructionCohort1ProjectId,
  );
  if (index < 0) return null;
  return RECONSTRUCTION_COHORT_1_LABELS[index] ?? null;
}

export function cohort1ProjectPath(projectId: string): string {
  return `${RECONSTRUCTION_COHORT_1_PATH}/${projectId.trim()}`;
}
