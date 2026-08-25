/**
 * Concierge SLA → SpecialistObservation.
 * Real overdue count only. Healthy emits zero.
 */

import { CONCIERGE_SLA_OVERDUE_RECOMMENDATION_ID } from "@/lib/concierge/sla/types";
import type { SpecialistObservation } from "../types";

export type ConciergeSlaAdapterInput = {
  overdueCount: number;
  observedAt: string;
};

export function observationsFromConciergeSla(
  input: ConciergeSlaAdapterInput,
): SpecialistObservation[] {
  if (!Number.isFinite(input.overdueCount) || input.overdueCount <= 0) {
    return [];
  }

  const countLabel =
    input.overdueCount === 1
      ? "1 Concierge inquiry is"
      : `${input.overdueCount} Concierge inquiries are`;

  return [
    {
      specialist: "concierge-sla",
      kind: "sla-overdue",
      subject: {},
      summary: `${countLabel} beyond the 24-hour response window.`,
      whyItMatters:
        "The website promises a response within 24 hours. An unresolved Concierge lead is live revenue risk.",
      recommendedAction:
        "Make confirmed first contact on the overdue Concierge inquiry and mark the SLA task completed.",
      epistemicClass: "observed",
      importanceHint: "high",
      urgencyHint: "now",
      audienceHint: "urgent-founder-action",
      confidence: "high",
      evidenceIds: [],
      observationIds: [],
      observedAt: input.observedAt,
      dedupeKey: `concierge-sla:${CONCIERGE_SLA_OVERDUE_RECOMMENDATION_ID}`,
      changeClass: "novel",
    },
  ];
}
