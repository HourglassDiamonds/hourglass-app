/**
 * Founder-facing Project Desk copy. Does not invent provenance.
 */

export { coverageRows as coverageItems } from "./status";

import type { ProjectDeskCoverage } from "./types";

export function coverageLine(coverage: ProjectDeskCoverage): string {
  const people = coverage.people === "available" ? "People linked" : "No people linked";
  const specs = coverage.specs === "available" ? "details on file" : "few details";
  const notes = coverage.notes === "available" ? "notes on file" : "no notes yet";
  return `${people} · ${specs} · ${notes}`;
}
