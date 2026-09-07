/**
 * #23 handoff interface.
 * #22 Calendar evidence is source truth only. Association is always unassociated.
 * Do not invent Person/Project links here.
 */

import type { CalendarEventEvidence } from "./types";

export const CALENDAR_ASSOCIATION_HANDOFF_VERSION = 1 as const;

export type CalendarAssociationHandoff = {
  version: typeof CALENDAR_ASSOCIATION_HANDOFF_VERSION;
  source_system: "google_calendar";
  evidence: CalendarEventEvidence;
  person_id: null;
  project_id: null;
  relationship_id: null;
  association_status: "unassociated";
  association_candidates: readonly [];
  requires_founder_review: true;
};

export function toCalendarAssociationHandoff(
  evidence: CalendarEventEvidence,
): CalendarAssociationHandoff {
  return {
    version: CALENDAR_ASSOCIATION_HANDOFF_VERSION,
    source_system: "google_calendar",
    evidence,
    person_id: null,
    project_id: null,
    relationship_id: null,
    association_status: "unassociated",
    association_candidates: [],
    requires_founder_review: true,
  };
}
