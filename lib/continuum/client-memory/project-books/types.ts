/**
 * Person → Project Books presentation contracts.
 * Read model over existing Client Memory. No schema. No mutation.
 * Project ID is identity. Title is display only.
 */

import type { EditableProjectSpecField } from "../types";
import type { SourceNoteSummary } from "../read/types";
import type { ProjectKind } from "../project-kind";
import type { ProjectOperatingLayer } from "../project-operating/layer";

export const PERSON_PROJECT_BOOK_SECTIONS = [
  "overview",
  "items-and-specs",
  "communication",
  "decisions-and-approvals",
  "cad-design",
  "artifacts",
  "commercial",
  "history-sources",
] as const;

export type PersonProjectBookSectionId =
  (typeof PERSON_PROJECT_BOOK_SECTIONS)[number];

export type PersonProjectBookPerson = {
  personId: string;
  displayName: string;
};

export type PersonProjectBookStoredField = {
  fieldName: EditableProjectSpecField;
  label: string;
  value: string;
  plane: "stored";
};

export type PersonProjectBookHistoryEntry = Pick<
  SourceNoteSummary,
  "id" | "projectId" | "sourceSystem" | "noteText" | "createdAt"
>;

export type PersonProjectBookOverview = {
  title: string;
  projectKind: ProjectKind | null;
  cadIdentifier: string | null;
  storedOrderIdentifier: string | null;
  fingerSize: string | null;
  metal: string | null;
  centerStone: string | null;
  linkedPeople: PersonProjectBookPerson[];
  indexedEmailOnFile: boolean;
};

export type PersonProjectBook = {
  projectId: string;
  title: string;
  projectKind: ProjectKind | null;
  cadIdentifier: string | null;
  storedOrderIdentifier: string | null;
  lastMeaningfulAt: string | null;
  sourceCount: number;
  indexedEmailOnFile: boolean;
  createdAt: string;
  updatedAt: string;
  overview: PersonProjectBookOverview;
  itemsAndSpecs: {
    itemType: null;
    specs: PersonProjectBookStoredField[];
  };
  communication: {
    indexedEmailOnFile: boolean;
    sourceCount: number;
  };
  decisionsAndApprovals: [];
  cadDesign: {
    cadIdentifier: string | null;
  };
  artifacts: {
    connected: false;
    canonicalCount: 0;
  };
  commercial: {
    storedOrderIdentifier: string | null;
    founderReviewRequired: boolean;
  };
  operatingLayer: ProjectOperatingLayer;
  history: PersonProjectBookHistoryEntry[];
};

export type PersonProjectBookComposeOptions = {
  recoveredOrderConflicts?: Readonly<Record<string, readonly string[]>>;
};

export const CLIENT_MEMORY_PROJECT_BOOK_NOTE_LIMIT = 8;
export const CLIENT_MEMORY_PROJECT_BOOK_NOTE_QUERY_CAP = 40;
