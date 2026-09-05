/**
 * Project Desk contracts.
 * Read model over existing Client Memory.
 * Open Jobs are canonical Project work when connected. Artifacts and Gmail remain disconnected.
 */

import type {
  EntityRelationship,
  ProjectCustomDetails,
  ProjectHistory,
  ProjectHistoryRevision,
  ProjectLifecycleEvent,
  ProjectLifecycleState,
  ProjectProfile,
  ProjectRepairDetails,
  SourceNote,
} from "../types";
import type { ProjectKind } from "../project-kind";
import type { ProjectOperatingLayer } from "../project-operating/layer";
import type { ProjectLifecycleView } from "../project-lifecycle/view";
import type { ProjectDeskOpenJobs, ProjectJob } from "../project-jobs/types";
import type { ProjectWorkSummary } from "../project-jobs/intelligence";

export const PROJECT_DESK_NOTE_LIMIT = 25;
export const PROJECT_DESK_HOME_LIMIT = 5;

export type CoverageLevel =
  | "available"
  | "missing"
  | "sparse"
  | "none"
  | "not-connected";

export type ProjectDeskCoverage = {
  people: "available" | "missing";
  specs: "available" | "sparse";
  notes: "available" | "none";
  jobs: "not-connected" | "available" | "none";
  files: "not-connected";
  email: "not-connected";
};

export type ProjectDeskOperationalStatus = {
  kind: "unknown";
  evidence: string;
};

export type ProjectDeskPerson = {
  personId: string;
  displayName: string;
};

export type ProjectSpecField = {
  fieldName:
    | "finger_size"
    | "order_number"
    | "cad_job_number"
    | "metal"
    | "center_stone"
    | "diamond_supply_notes";
  label: string;
  value: string;
};

export type ProjectDeskNote = {
  id: string;
  personId: string | null;
  personName: string | null;
  contextLayer: SourceNote["contextLayer"];
  sourceSystem: SourceNote["sourceSystem"];
  sourceArtifact: string;
  sourceSheet: string;
  sourceField: string;
  noteText: string;
  createdAt: string;
};

export type ProjectDeskSummary = {
  projectId: string;
  title: string;
  projectKind: ProjectKind | null;
  people: ProjectDeskPerson[];
  latestNoteAt: string | null;
  latestNotePreview: string | null;
  coverage: ProjectDeskCoverage;
  recordCreatedAt: string;
  projectWork: ProjectWorkSummary;
  lifecycleStage: string | null;
  lifecycleLabel: string | null;
};

export type ProjectDeskRead = {
  projectId: string;
  title: string;
  projectKind: ProjectKind | null;
  recordCreatedAt: string;
  people: ProjectDeskPerson[];
  specs: ProjectSpecField[];
  specCorrections: ProjectHistoryRevision[];
  notes: ProjectDeskNote[];
  latestNoteAt: string | null;
  latestNotePreview: string | null;
  coverage: ProjectDeskCoverage;
  operationalStatus: ProjectDeskOperationalStatus;
  operatingLayer: ProjectOperatingLayer;
  lifecycle: ProjectLifecycleView;
  openJobs: ProjectDeskOpenJobs;
  projectWork: ProjectWorkSummary;
  artifacts: { connected: false };
};

export type ProjectDeskSnapshot = {
  projectProfiles: ProjectProfile[];
  projectHistories: ProjectHistory[];
  specRevisions?: ProjectHistoryRevision[];
  customDetails?: ProjectCustomDetails[];
  repairDetails?: ProjectRepairDetails[];
  lifecycleStates?: ProjectLifecycleState[];
  lifecycleEvents?: ProjectLifecycleEvent[];
  relationships: EntityRelationship[];
  people: Array<{
    personId: string;
    displayName: string;
  }>;
  sourceNotes: SourceNote[];
  projectJobs?: ProjectJob[] | null;
};

export type ListProjectsFilter = {
  limit?: number;
};

export type ProjectDeskGetResult =
  | { ok: true; desk: ProjectDeskRead }
  | { ok: false; reason: "not-found" };
