/**
 * Slice A derived operational status and coverage.
 * Open Jobs, files, and email are not connected. Never invent waiting-on.
 */

import type {
  ProjectDeskCoverage,
  ProjectDeskOperationalStatus,
  ProjectSpecField,
} from "./types";

export const SLICE_A_STATUS_EVIDENCE =
  "Open jobs, files, and email are not connected yet. Current operating state is unknown.";

export function projectCoverage(input: {
  peopleCount: number;
  specCount: number;
  noteCount: number;
}): ProjectDeskCoverage {
  return {
    people: input.peopleCount > 0 ? "available" : "missing",
    specs: input.specCount > 0 ? "available" : "sparse",
    notes: input.noteCount > 0 ? "available" : "none",
    jobs: "not-connected",
    files: "not-connected",
    email: "not-connected",
  };
}

export function sliceAOperationalStatus(): ProjectDeskOperationalStatus {
  return {
    kind: "unknown",
    evidence: SLICE_A_STATUS_EVIDENCE,
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
  const push = (label: string, value: string | null) => {
    const trimmed = value?.trim();
    if (trimmed) rows.push({ label, value: trimmed });
  };
  push("CAD", history.cadJobNumber);
  push("Order", history.orderNumber);
  push("Finger size", history.fingerSize);
  push("Metal", history.metal);
  push("Center stone", history.centerStone);
  push("Supply notes", history.diamondSupplyNotes);
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
    { label: "Open Jobs", value: "Not connected yet" },
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
