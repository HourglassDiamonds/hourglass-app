/**
 * Project Desk Slice A contracts.
 * Read model over existing Client Memory. No operating/lifecycle table.
 * Derived operational status is not Open Jobs / Gmail / artifacts.
 */

import type {
  EntityRelationship,
  ProjectHistory,
  ProjectHistoryRevision,
  ProjectProfile,
  SourceNote,
} from "../types";

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
  jobs: "not-connected";
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
  people: ProjectDeskPerson[];
  latestNoteAt: string | null;
  latestNotePreview: string | null;
  coverage: ProjectDeskCoverage;
  recordCreatedAt: string;
};

export type ProjectDeskRead = {
  projectId: string;
  title: string;
  recordCreatedAt: string;
  people: ProjectDeskPerson[];
  specs: ProjectSpecField[];
  specCorrections: ProjectHistoryRevision[];
  notes: ProjectDeskNote[];
  latestNoteAt: string | null;
  latestNotePreview: string | null;
  coverage: ProjectDeskCoverage;
  operationalStatus: ProjectDeskOperationalStatus;
  openJobs: { connected: false };
  artifacts: { connected: false };
};

export type ProjectDeskSnapshot = {
  projectProfiles: ProjectProfile[];
  projectHistories: ProjectHistory[];
  specRevisions?: ProjectHistoryRevision[];
  relationships: EntityRelationship[];
  people: Array<{
    personId: string;
    displayName: string;
  }>;
  sourceNotes: SourceNote[];
};

export type ListProjectsFilter = {
  limit?: number;
};

export type ProjectDeskGetResult =
  | { ok: true; desk: ProjectDeskRead }
  | { ok: false; reason: "not-found" };
