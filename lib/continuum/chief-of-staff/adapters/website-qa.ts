/**
 * Website QA → SpecialistObservation.
 * Critical open exception only. Healthy emits zero.
 */

import type { WebsiteQaSnapshot } from "@/lib/agent-os/bi/website-qa/types";
import type { SpecialistObservation } from "../types";

export function observationsFromWebsiteQa(
  snapshot: Pick<WebsiteQaSnapshot, "health" | "exception">,
  observedAt: string,
): SpecialistObservation[] {
  if (snapshot.health !== "critical") return [];
  const exception = snapshot.exception;
  if (!exception || exception.health !== "critical") return [];

  return [
    {
      specialist: "website-qa",
      kind: "critical-website",
      subject: {},
      summary: exception.summary,
      whyItMatters:
        "A revenue-critical production surface is not healthy.",
      recommendedAction:
        "Verify production health for the affected route(s).",
      epistemicClass: "observed",
      importanceHint: "high",
      urgencyHint: "now",
      audienceHint: "urgent-founder-action",
      confidence: "high",
      evidenceIds: [],
      observationIds: [],
      observedAt,
      dedupeKey: `website-qa:${exception.id}`,
      changeClass: "novel",
    },
  ];
}
