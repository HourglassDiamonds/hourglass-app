/**
 * Slice A derived operational status and coverage.
 * Open Jobs may be connected as canonical rows. Files and email are not.
 * Never invent waiting-on from notes or job prose.
 */

import type {
  ProjectDeskCoverage,
  ProjectDeskOperationalStatus,
  ProjectSpecField,
} from "./types";
import {
  PROJECT_SPEC_FIELD_LABELS,
  PROJECT_SPEC_HISTORY_KEY,
} from "../project-spec/types";
import { EDITABLE_PROJECT_SPEC_FIELDS } from "../types";

export const SLICE_A_STATUS_EVIDENCE =
  "Open jobs, files, and email are not connected yet. Current operating state is unknown.";

export const JOBS_CONNECTED_STATUS_EVIDENCE =
  "Files and email are not connected yet. Current operating state is unknown.";

export function projectCoverage(input: {
  peopleCount: number;
  specCount: number;
  noteCount: number;
  jobs?: ProjectDeskCoverage["jobs"];
}): ProjectDeskCoverage {
  return {
    people: input.peopleCount > 0 ? "available" : "missing",
    specs: input.specCount > 0 ? "available" : "sparse",
    notes: input.noteCount > 0 ? "available" : "none",
    jobs: input.jobs ?? "not-connected",
    files: "not-connected",
    email: "not-connected",
  };
}

export function sliceAOperationalStatus(
  coverage?: ProjectDeskCoverage,
): ProjectDeskOperationalStatus {
  return {
    kind: "unknown",
    evidence:
      coverage && coverage.jobs !== "not-connected"
        ? JOBS_CONNECTED_STATUS_EVIDENCE
        : SLICE_A_STATUS_EVIDENCE,
  };
}

export function specFieldsFromHistory(history: {
  cadJobNumber: string | null;
  orderNumber: string | null;
  fingerSize: string | null;
  metal: string | null;
  centerStone: string | null;
  diamondSupplyNotes: string | null;
} | null): ProjectSpecField[] {
  if (!history) return [];
  const rows: ProjectSpecField[] = [];
  for (const fieldName of EDITABLE_PROJECT_SPEC_FIELDS) {
    const key = PROJECT_SPEC_HISTORY_KEY[fieldName];
    const trimmed = history[key]?.trim();
    if (!trimmed) continue;
    rows.push({
      fieldName,
      label: PROJECT_SPEC_FIELD_LABELS[fieldName],
      value: trimmed,
    });
  }
  return rows;
}

export function coverageRows(coverage: ProjectDeskCoverage): Array<{
  label: string;
  value: string;
}> {
  return [
    {
      label: "People",
      value: coverage.people === "available" ? "Linked" : "None linked",
    },
    {
      label: "Details",
      value: coverage.specs === "available" ? "Present" : "Sparse",
    },
    {
      label: "Notes",
      value: coverage.notes === "available" ? "Present" : "None yet",
    },
    {
      label: "Open Jobs",
      value:
        coverage.jobs === "available"
          ? "Present"
          : coverage.jobs === "none"
            ? "None recorded"
            : "Not connected yet",
    },
    { label: "Renders", value: "Not connected yet" },
    { label: "Email", value: "Not connected yet" },
  ];
}

export function notePreview(text: string, max = 88): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max).trimEnd()}…`;
}
